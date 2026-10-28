import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../shared/prisma/prisma.service';
import { DeviceInfo } from '../shared/decorators/device.decorator';
import { Session, User } from 'src/generated/prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  session: Session;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Đăng nhập:
   * 1. Thu hồi toàn bộ session đang sống thuộc cùng portal (Client hoặc Admin)
   *    với lý do 'NEW_DEVICE_LOGIN'.
   * 2. Thiết bị đăng nhập trước sẽ bị out ngay lập tức và nhận cảnh báo:
   *    "Tài khoản của bạn vừa đăng nhập trên thiết bị khác".
   * 3. Phân tách Admin portal (Admin • ...) và User client để không đá lẫn nhau.
   */
  async createSessionForDevice(user: User, device: DeviceInfo) {
    const isAdmin =
      device.clientType === 'admin' || device.name?.startsWith('Admin');
    const scopeFilter = isAdmin
      ? { deviceName: { startsWith: 'Admin' } }
      : { NOT: { deviceName: { startsWith: 'Admin' } } };

    const revoked = await this.prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...scopeFilter,
      },
      data: { revokedAt: new Date(), revokedReason: 'NEW_DEVICE_LOGIN' },
    });

    const tokens = await this.issue(user, device);
    return { ...tokens, revokedOtherDevices: revoked.count };
  }

  private async issue(user: User, device: DeviceInfo): Promise<TokenPair> {
    const refreshToken = randomBytes(64).toString('hex');
    const hours =
      this.config.get<number>('jwt.refreshTtlHours') ??
      (this.config.get<number>('jwt.refreshTtlDays') ?? 30) * 24;

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hash(refreshToken),
        deviceId: device.id,
        deviceName: device.name,
        userAgent: device.userAgent,
        ip: device.ip,
        expiresAt: new Date(Date.now() + hours * 3_600_000),
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, sid: session.id },
      {
        secret: this.config.get<string>('jwt.accessSecret') as any,
        expiresIn: this.config.get<string>('jwt.accessTtl') as any,
      },
    );

    return { accessToken, refreshToken, expiresIn: 15 * 60, session };
  }

  /** Rotation: refresh token dùng 1 lần, tái sử dụng ⇒ khoá toàn bộ session */
  async rotate(refreshToken: string, device: DeviceInfo) {
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: this.hash(refreshToken) },
      include: { user: true },
    });

    if (!session) throw new UnauthorizedException('Refresh token không hợp lệ');

    if (session.revokedAt) {
      if (session.revokedReason === 'NEW_DEVICE_LOGIN') {
        throw new UnauthorizedException('SESSION_REVOKED');
      }
      if (session.revokedReason === 'ROTATED') {
        // Tái sử dụng token cũ ⇒ nghi ngờ bị tấn công ăn cắp token ⇒ khoá toàn bộ
        await this.revokeAll(session.userId, 'REFRESH_TOKEN_REUSE');
      }
      throw new UnauthorizedException(
        'Phiên đã bị thu hồi, vui lòng đăng nhập lại',
      );
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Phiên đã hết hạn');
    }
    if (session.deviceId !== device.id) {
      // Chỉ thu hồi phiên của thiết bị có token lệch này, không xoá phiên của các thiết bị khác
      await this.revokeSession(session.id, 'DEVICE_MISMATCH');
      throw new UnauthorizedException(
        'Thiết bị không khớp với phiên đăng nhập',
      );
    }
    if (!session.user.isActive)
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hoá');

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokedReason: 'ROTATED',
        lastUsedAt: new Date(),
      },
    });

    return this.issue(session.user, device);
  }

  async revokeSession(sessionId: string, reason = 'LOGOUT') {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAll(userId: string, reason = 'LOGOUT_ALL') {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        ip: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        revokedReason: true,
      },
    });
  }

  async validateActiveSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!session) {
      throw new UnauthorizedException('SESSION_INVALID');
    }
    if (session.revokedAt) {
      if (session.revokedReason === 'NEW_DEVICE_LOGIN') {
        throw new UnauthorizedException('SESSION_REVOKED');
      }
      throw new UnauthorizedException('SESSION_EXPIRED');
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('SESSION_EXPIRED');
    }
    if (!session.user.isActive) {
      throw new UnauthorizedException('USER_INACTIVE');
    }
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    return session;
  }
}
