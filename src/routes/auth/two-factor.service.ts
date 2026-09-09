import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { PrismaService } from '../shared/prisma/prisma.service';
import { generateSecret, generateURI, verifySync } from 'otplib';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async startTotpSetup(userId: string, email: string) {
    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpPendingSecret: secret },
    });
    const otpauthUrl = generateURI({
      secret,
      label: email,
      issuer: this.config.get<string>('totpIssuer') ?? 'AuthDemo',
    });
    return {
      secret,
      otpauthUrl,
      qrDataUrl: await QRCode.toDataURL(otpauthUrl),
    };
  }

  async confirmTotpSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.totpPendingSecret)
      throw new BadRequestException('Chưa khởi tạo cài đặt TOTP');
    const check = verifySync({
      token: code,
      secret: user.totpPendingSecret,
      epochTolerance: 30,
    });
    if (!check.valid) {
      throw new BadRequestException('Mã TOTP không đúng');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: user.totpPendingSecret,
        totpPendingSecret: null,
        twoFactorEnabled: true,
        twoFactorMethod: 'TOTP',
      },
    });
    return { twoFactorEnabled: true, method: 'TOTP' as const };
  }

  verifyTotp(secret: string, code: string) {
    const check = verifySync({
      token: code,
      secret,
      epochTolerance: 30,
    });
    return Boolean(check.valid);
  }
}
