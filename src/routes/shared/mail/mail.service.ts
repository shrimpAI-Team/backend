// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type OtpKind = 'REGISTER' | 'LOGIN_2FA' | 'DISABLE_2FA' | 'RESET_PASSWORD';

const SUBJECTS: Record<OtpKind, string> = {
  REGISTER: 'Xác thực email đăng ký',
  LOGIN_2FA: 'Mã xác thực đăng nhập (2FA)',
  DISABLE_2FA: 'Mã xác nhận tắt 2FA',
  RESET_PASSWORD: 'Mã đặt lại mật khẩu',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    const mail = this.config.get('mail');
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.port === 465,
      auth: { user: mail.user, pass: mail.pass },
    });
  }

  async sendOtp(
    to: string,
    code: string,
    purpose: OtpKind,
    ttlMinutes: number,
  ) {
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#111827">${SUBJECTS[purpose]}</h2>
        <p style="color:#374151">Mã xác thực của bạn là:</p>
        <p style="font-size:34px;letter-spacing:10px;font-weight:700;color:#4f46e5">${code}</p>
        <p style="color:#6b7280;font-size:13px">Mã hết hạn sau ${ttlMinutes} phút. Không chia sẻ mã này cho bất kỳ ai.</p>
      </div>`;
    this.logger.log(
      `[OTP] Mã xác thực gửi tới ${to} (${purpose}): [ ${code} ] - Hết hạn sau ${ttlMinutes} phút`,
    );
    try {
      await this.transporter.sendMail({
        from: this.config.get('mail.from'),
        to,
        subject: SUBJECTS[purpose],
        html,
      });
    } catch (e) {
      this.logger.error(`Không gửi được email tới ${to}: ${(e as Error).message}`);
      if (this.config.get('env') === 'production') {
        throw e;
      }
      this.logger.warn(
        `[DEV MODE] Bỏ qua lỗi gửi mail SMTP. Bạn có thể sử dụng mã OTP trên: ${code}`,
      );
    }
  }

  async sendNewDeviceAlert(to: string, deviceName: string, ip?: string) {
    await this.transporter.sendMail({
      from: this.config.get('mail.from'),
      to,
      subject: 'Phát hiện đăng nhập từ thiết bị mới',
      html: `<p>Tài khoản của bạn vừa đăng nhập trên <b>${deviceName}</b> (IP: ${ip ?? 'n/a'}).</p>
             <p>Các thiết bị khác đã bị đăng xuất tự động.</p>`,
    });
  }
}
