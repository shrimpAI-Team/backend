// src/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shared/prisma/prisma.service';
import { MailService } from '../shared/mail/mail.service';
import { SessionService } from './session.service';
import { DeviceInfo } from '../shared/decorators/device.decorator';
import {
  ConfirmTotpDto,
  Disable2faDto,
  Enable2faDto,
  LoginDto,
  RegisterDto,
  Verify2faDto,
  VerifyEmailOtpDto,
} from './dto/auth.dto';
import { OtpPurpose, User } from 'src/generated/prisma/client';
import { TwoFactorService } from './two-factor.service';

export interface OAuthProfile {
  provider: 'google' | 'facebook' | 'zalo';
  providerAccountId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Số vòng băm bcrypt. 12 là mức cân bằng giữa an toàn và độ trễ
 * (khoảng 200–300ms trên CPU máy chủ phổ thông).
 */
const BCRYPT_SALT_ROUNDS = 12;

/** Mật khẩu giả dùng để cân bằng thời gian phản hồi khi email không tồn tại */
const TIMING_EQUALIZER_PASSWORD = 'dummy-password-to-equalize-timing';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
    private readonly twoFactor: TwoFactorService,
  ) { }

  // ═══════════════ HELPERS ═══════════════
  private hash(v: string) {
    return createHash('sha256').update(v).digest('hex');
  }

  /** Băm mật khẩu bằng bcrypt, salt được sinh và nhúng sẵn trong chuỗi hash */
  private hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
  }

  /**
   * So khớp mật khẩu thô với hash đã lưu.
   * ⚠️ Thứ tự tham số ngược với argon2.verify(hash, plain)
   */
  private comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  private async findByEmailOrFail(email: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) throw new BadRequestException('Không tìm thấy tài khoản');
    return user;
  }

  /** Sinh OTP 6 số, vô hiệu OTP cũ cùng purpose, gửi email */
  private async issueOtp(user: User, purpose: OtpPurpose) {
    const ttl = this.config.get<number>('otp.ttlMinutes')!;

    await this.prisma.otpToken.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    await this.prisma.otpToken.create({
      data: {
        userId: user.id,
        purpose,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + ttl * 60_000),
      },
    });

    await this.mail.sendOtp(user.email, code, purpose, ttl);
  }

  /** Xác thực + tiêu thụ OTP, đếm số lần sai */
  private async consumeOtp(userId: string, purpose: OtpPurpose, code: string) {
    const otp = await this.prisma.otpToken.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp)
      throw new BadRequestException(
        'Không có mã OTP hợp lệ, hãy yêu cầu gửi lại',
      );
    if (otp.expiresAt < new Date())
      throw new BadRequestException('Mã OTP đã hết hạn');

    const max = this.config.get<number>('otp.maxAttempts')!;
    if (otp.attempts >= max) {
      await this.prisma.otpToken.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException(
        'Nhập sai quá số lần cho phép, hãy yêu cầu mã mới',
      );
    }

    if (otp.codeHash !== this.hash(code)) {
      await this.prisma.otpToken.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException(
        `Mã OTP không đúng (còn ${max - otp.attempts - 1} lần thử)`,
      );
    }

    await this.prisma.otpToken.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }

  /** Cấp token + revoke thiết bị khác + cảnh báo email */
  private async grantTokens(user: User, device: DeviceInfo) {
    const {
      accessToken,
      refreshToken,
      expiresIn,
      session,
      revokedOtherDevices,
    } = await this.sessions.createSessionForDevice(user, device);

    if (revokedOtherDevices > 0) {
      this.mail
        .sendNewDeviceAlert(user.email, device.name, device.ip)
        .catch(() => void 0); // không chặn luồng login
    }

    return {
      status: 'AUTHENTICATED' as const,
      accessToken,
      refreshToken,
      expiresIn,
      revokedOtherDevices,
      session: { id: session.id, deviceName: session.deviceName },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorMethod: user.twoFactorMethod,
      },
    };
  }

  private signChallenge(user: User) {
    return this.jwt.signAsync(
      { sub: user.id, scope: '2fa', method: user.twoFactorMethod },
      {
        secret: this.config.get('jwt.challengeSecret') as any,
        expiresIn: this.config.get('jwt.challengeTtl') as any,
      },
    );
  }

  // ═══════════════ ĐĂNG KÝ ═══════════════
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing?.emailVerifiedAt)
      throw new ConflictException('Email đã được sử dụng');

    // ⬇️ bcrypt thay cho argon2.hash(dto.password, { type: argon2.argon2id })
    const passwordHash = await this.hashPassword(dto.password);

    const user = existing
      ? await this.prisma.user.update({
        where: { id: existing.id },
        data: { password: passwordHash, name: dto.name ?? existing.name },
      })
      : await this.prisma.user.create({
        data: { email, password: passwordHash, name: dto.name },
      });

    await this.issueOtp(user, 'REGISTER');
    return {
      status: 'OTP_SENT' as const,
      email,
      message: `Đã gửi mã OTP tới ${email}, hiệu lực ${this.config.get('otp.ttlMinutes')} phút`,
    };
  }

  async verifyRegistrationOtp(dto: VerifyEmailOtpDto, device: DeviceInfo) {
    const user = await this.findByEmailOrFail(dto.email);
    if (user.emailVerifiedAt)
      throw new BadRequestException('Email đã được xác thực');

    await this.consumeOtp(user.id, 'REGISTER', dto.code);

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });

    return this.grantTokens(verified, device);
  }

  async resendOtp(email: string, purpose: OtpPurpose = 'REGISTER') {
    const user = await this.findByEmailOrFail(email);
    await this.issueOtp(user, purpose);
    return { message: 'Đã gửi lại mã OTP' };
  }

  // ═══════════════ ĐĂNG NHẬP ═══════════════
  async login(dto: LoginDto, device: DeviceInfo) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user?.password) {
      // Vẫn tốn đúng chi phí băm như trường hợp email tồn tại ⇒ chống timing attack
      await bcrypt.hash(TIMING_EQUALIZER_PASSWORD, BCRYPT_SALT_ROUNDS);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!(await this.comparePassword(dto.password, user.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.isActive)
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hoá');

    if (!user.emailVerifiedAt) {
      await this.issueOtp(user, 'REGISTER');
      return {
        status: 'EMAIL_UNVERIFIED' as const,
        email: user.email,
        message: 'Email chưa xác thực, mã OTP mới đã được gửi',
      };
    }

    if (user.twoFactorEnabled) {
      if (user.twoFactorMethod === 'EMAIL_OTP') {
        await this.issueOtp(user, 'LOGIN_2FA');
      }
      return {
        status: 'TWO_FACTOR_REQUIRED' as const,
        method: user.twoFactorMethod,
        challengeToken: await this.signChallenge(user),
        message:
          user.twoFactorMethod === 'TOTP'
            ? 'Nhập mã 6 số từ ứng dụng Authenticator'
            : 'Nhập mã OTP vừa gửi tới email của bạn',
      };
    }

    return this.grantTokens(user, device);
  }

  async verifyTwoFactor(dto: Verify2faDto, device: DeviceInfo) {
    let payload: { sub: string; scope: string; method: string };
    try {
      payload = await this.jwt.verifyAsync(dto.challengeToken, {
        secret: this.config.get('jwt.challengeSecret'),
      });
    } catch {
      throw new UnauthorizedException(
        'Phiên xác thực 2FA đã hết hạn, hãy đăng nhập lại',
      );
    }
    if (payload.scope !== '2fa')
      throw new UnauthorizedException('Token không hợp lệ');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
    });

    if (user.twoFactorMethod === 'TOTP') {
      if (
        !user.totpSecret ||
        !this.twoFactor.verifyTotp(user.totpSecret, dto.code)
      ) {
        throw new UnauthorizedException('Mã TOTP không đúng');
      }
    } else {
      await this.consumeOtp(user.id, 'LOGIN_2FA', dto.code);
    }

    return this.grantTokens(user, device);
  }

  // ═══════════════ OAUTH2 ═══════════════
  /** Tìm hoặc tạo user từ profile OAuth, trả về one-time token cho frontend */
  async handleOAuthLogin(profile: OAuthProfile) {
    const email = (
      profile.email ||
      `${profile.provider}_${profile.providerAccountId}@${profile.provider}.oauth.local`
    )
      .toLowerCase()
      .trim();

    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    let user = linked?.user ?? null;

    if (!user) {
      user = await this.prisma.user.upsert({
        where: { email },
        update: {
          name: profile.name ?? undefined,
          avatarUrl: profile.avatarUrl ?? undefined,
          emailVerifiedAt: new Date(),
        },
        create: {
          email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          emailVerifiedAt: new Date(),
        },
      });

      await this.prisma.oAuthAccount.create({
        data: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          userId: user.id,
        },
      });
    }

    if (!user.isActive)
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hoá');

    // Token 1 lần, frontend sẽ đổi lấy access/refresh kèm X-Device-Id thật
    const oneTimeToken = await this.jwt.signAsync(
      { sub: user.id, scope: 'oauth_exchange', twofa: user.twoFactorEnabled },
      {
        secret: this.config.get('jwt.challengeSecret'),
        expiresIn: '2m',
      },
    );

    return { oneTimeToken };
  }

  async exchangeOAuthToken(oneTimeToken: string, device: DeviceInfo) {
    let payload: { sub: string; scope: string };
    try {
      payload = await this.jwt.verifyAsync(oneTimeToken, {
        secret: this.config.get('jwt.challengeSecret'),
      });
    } catch {
      throw new UnauthorizedException('Liên kết đăng nhập đã hết hạn');
    }
    if (payload.scope !== 'oauth_exchange')
      throw new UnauthorizedException('Token không hợp lệ');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
    });

    if (user.twoFactorEnabled) {
      if (user.twoFactorMethod === 'EMAIL_OTP')
        await this.issueOtp(user, 'LOGIN_2FA');
      return {
        status: 'TWO_FACTOR_REQUIRED' as const,
        method: user.twoFactorMethod,
        challengeToken: await this.signChallenge(user),
      };
    }

    return this.grantTokens(user, device);
  }

  // ═══════════════ SESSION ═══════════════
  refresh(refreshToken: string, device: DeviceInfo) {
    return this.sessions.rotate(refreshToken, device);
  }

  async logout(sessionId: string) {
    await this.sessions.revokeSession(sessionId, 'LOGOUT');
    return { message: 'Đã đăng xuất' };
  }

  async logoutAll(userId: string) {
    await this.sessions.revokeAll(userId, 'LOGOUT_ALL_DEVICES');
    return { message: 'Đã đăng xuất trên toàn bộ thiết bị' };
  }

  listSessions(userId: string) {
    return this.sessions.listSessions(userId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        createdAt: true,
        oauthAccounts: { select: { provider: true } },
      },
    });
    return user;
  }

  // ═══════════════ BẬT / TẮT 2FA ═══════════════
  async enable2fa(userId: string, dto: Enable2faDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.twoFactorEnabled)
      throw new BadRequestException('2FA đang được bật');

    if (dto.method === 'TOTP') {
      const setup = await this.twoFactor.startTotpSetup(user.id, user.email);
      return {
        status: 'TOTP_SETUP_PENDING' as const,
        otpauthUrl: setup.otpauthUrl,
        qrDataUrl: setup.qrDataUrl,
        secret: setup.secret,
        message: 'Quét QR rồi gửi mã 6 số để hoàn tất',
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorMethod: 'EMAIL_OTP' },
    });
    return {
      status: 'ENABLED' as const,
      method: 'EMAIL_OTP' as const,
      message: 'Đã bật 2FA qua email OTP',
    };
  }

  confirmTotp(userId: string, dto: ConfirmTotpDto) {
    return this.twoFactor.confirmTotpSetup(userId, dto.code);
  }

  /** Tắt 2FA: bắt buộc mật khẩu + OTP email để chống chiếm quyền */
  async requestDisable2fa(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorEnabled)
      throw new BadRequestException('2FA chưa được bật');
    await this.issueOtp(user, 'DISABLE_2FA');
    return { message: 'Đã gửi mã xác nhận tắt 2FA tới email' };
  }

  async disable2fa(userId: string, dto: Disable2faDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorEnabled)
      throw new BadRequestException('2FA chưa được bật');

    // ⬇️ bcrypt.compare(plain, hash) thay cho argon2.verify(hash, plain)
    if (
      user.password &&
      !(await this.comparePassword(dto.password, user.password))
    ) {
      throw new UnauthorizedException('Mật khẩu không đúng');
    }
    await this.consumeOtp(user.id, 'DISABLE_2FA', dto.code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorMethod: 'NONE',
        totpSecret: null,
        totpPendingSecret: null,
      },
    });
    return {
      status: 'DISABLED' as const,
      message: 'Đã tắt xác thực hai yếu tố',
    };
  }
}
