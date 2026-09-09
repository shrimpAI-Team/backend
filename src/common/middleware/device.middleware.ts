import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class DeviceMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const ua = req.headers['user-agent'] ?? '';
    const headerId = (req.headers['x-device-id'] as string) || '';
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      undefined;

    // Ưu tiên deviceId do client sinh; fallback fingerprint từ UA + IP
    const id =
      headerId ||
      createHash('sha256')
        .update(`${ua}|${ip ?? randomUUID()}`)
        .digest('hex')
        .slice(0, 32);

    (req as any).device = {
      id,
      name: (req.headers['x-device-name'] as string) || parseDeviceName(ua),
      userAgent: ua,
      ip,
    };
    next();
  }
}

function parseDeviceName(ua: string): string {
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad/i.test(ua)
        ? 'iOS'
        : /Mac OS X/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Unknown OS';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua)
      ? 'Chrome'
      : /Safari\//i.test(ua)
        ? 'Safari'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : 'Unknown browser';
  return `${browser} trên ${os}`;
}
