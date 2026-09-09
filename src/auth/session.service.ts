import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceInfo } from '../common/decorators/device.decorator';
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
   * Đăng nhập thiết bị mới:
   * 1. Revoke toàn bộ session đang sống khác deviceId hiện tại
   * 2. Tạo session mới + cặp token
   */
  async createSessionForDevice(user: User, device: DeviceInfo) {
    const revoked = await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null, NOT: { deviceId: device.id } },
      data: { revokedAt: new Date(), revokedReason: 'NEW_DEVICE_LOGIN' },
    });

    // Cùng thiết bị đăng nhập lại: thu hồi session cũ của chính nó
    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null, deviceId: device.id },
      data: { revokedAt: new Date(), revokedReason: 'RE_LOGIN_SAME_DEVICE' },
    });

    const tokens = await this.issue(user, device);
    return { ...tokens, revokedOtherDevices: revoked.count };
  }

  private async issue(user: User, device: DeviceInfo): Promise<TokenPair> {
    const refreshToken = randomBytes(64).toString('hex');
    const days = this.config.get<number>('jwt.refreshTtlDays')!;

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hash(refreshToken),
        deviceId: device.id,
        deviceName: device.name,
        userAgent: device.userAgent,
        ip: device.ip,
        expiresAt: new Date(Date.now() + days * 86_400_000),
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
      await this.revokeAll(session.userId, 'REFRESH_TOKEN_REUSE');
      throw new UnauthorizedException(
        'Phiên đã bị thu hồi, vui lòng đăng nhập lại',
      );
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Phiên đã hết hạn');
    }
    if (session.deviceId !== device.id) {
      await this.revokeAll(session.userId, 'DEVICE_MISMATCH');
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
    if (!session || session.revokedAt || session.expiresAt < new Date())
      return null;
    if (!session.user.isActive) return null;
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    return session;
  }
}
