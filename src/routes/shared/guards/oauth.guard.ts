import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

interface DeferredResolution {
  resolve: (url: string) => void;
  reject: (err: any) => void;
}

interface CodeCacheItem {
  redirectUrl?: string;
  promise: Promise<string>;
  deferred: DeferredResolution;
  expiresAt: number;
}

const oauthCodeCache = new Map<string, CodeCacheItem>();

// Tự động dọn dẹp cache sau mỗi 2 phút
setInterval(() => {
  const now = Date.now();
  for (const [code, item] of oauthCodeCache.entries()) {
    if (item.expiresAt < now) {
      oauthCodeCache.delete(code);
    }
  }
}, 120_000);

export function completeOAuthCode(code: string, redirectUrl: string) {
  const item = oauthCodeCache.get(code);
  if (item) {
    item.redirectUrl = redirectUrl;
    item.deferred.resolve(redirectUrl);
  } else {
    oauthCodeCache.set(code, {
      redirectUrl,
      promise: Promise.resolve(redirectUrl),
      deferred: { resolve: () => {}, reject: () => {} },
      expiresAt: Date.now() + 60_000,
    });
  }
}

export function failOAuthCode(code: string, errorUrl: string) {
  const item = oauthCodeCache.get(code);
  if (item) {
    item.redirectUrl = errorUrl;
    item.deferred.resolve(errorUrl);
  } else {
    oauthCodeCache.set(code, {
      redirectUrl: errorUrl,
      promise: Promise.resolve(errorUrl),
      deferred: { resolve: () => {}, reject: () => {} },
      expiresAt: Date.now() + 60_000,
    });
  }
}

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleOAuthGuard.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const id = this.config.get<string>('oauth.google.clientID');
    if (!id || id === 'dummy-google-client-id') {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      res.redirect(
        `${front}/login?error=${encodeURIComponent('Google OAuth chưa được cấu hình (thiếu GOOGLE_CLIENT_ID trong .env)')}`,
      );
      return false;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const code = req.query?.code as string | undefined;

    if (code && typeof code === 'string') {
      const existing = oauthCodeCache.get(code);
      if (existing) {
        if (existing.redirectUrl) {
          res.redirect(existing.redirectUrl);
          return false;
        }
        try {
          const redirectUrl = await existing.promise;
          res.redirect(redirectUrl);
          return false;
        } catch {}
      }

      let deferred!: DeferredResolution;
      const promise = new Promise<string>((resolve, reject) => {
        deferred = { resolve, reject };
      });
      oauthCodeCache.set(code, {
        promise,
        deferred,
        expiresAt: Date.now() + 60_000,
      });
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const code = req.query?.code as string | undefined;

    if (err || !user) {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      const rawMsg = err?.message || info?.message || 'Đăng nhập Google thất bại';
      this.logger.error(`[Google OAuth Error] ${rawMsg}`, err?.stack || err);
      const errorUrl = `${front}/login?error=${encodeURIComponent(`Google: ${rawMsg}`)}`;
      if (code) {
        failOAuthCode(code, errorUrl);
      }
      res.redirect(errorUrl);
      return null;
    }
    return user;
  }
}

@Injectable()
export class FacebookOAuthGuard extends AuthGuard('facebook') {
  private readonly logger = new Logger(FacebookOAuthGuard.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const id = this.config.get<string>('oauth.facebook.clientID');
    if (!id || id === 'dummy-facebook-client-id') {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      res.redirect(
        `${front}/login?error=${encodeURIComponent('Facebook OAuth chưa được cấu hình (thiếu FACEBOOK_APP_ID trong .env)')}`,
      );
      return false;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const code = req.query?.code as string | undefined;

    // Chống race condition khi browser / prefetch gửi trùng mã authorization code
    if (code && typeof code === 'string') {
      const existing = oauthCodeCache.get(code);
      if (existing) {
        if (existing.redirectUrl) {
          this.logger.log(`[Facebook OAuth] Tái sử dụng redirect cho mã code '${code.slice(0, 10)}...'`);
          res.redirect(existing.redirectUrl);
          return false;
        }

        this.logger.log(`[Facebook OAuth] Đợi request song song đang xử lý mã code '${code.slice(0, 10)}...'`);
        try {
          const redirectUrl = await existing.promise;
          res.redirect(redirectUrl);
          return false;
        } catch {}
      }

      let deferred!: DeferredResolution;
      const promise = new Promise<string>((resolve, reject) => {
        deferred = { resolve, reject };
      });
      oauthCodeCache.set(code, {
        promise,
        deferred,
        expiresAt: Date.now() + 60_000,
      });
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const code = req.query?.code as string | undefined;

    if (err || !user) {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      const rawMsg = err?.message || info?.message || 'Đăng nhập Facebook thất bại';
      this.logger.error(`[Facebook OAuth Error] ${rawMsg}`, err?.stack || err);
      const errorUrl = `${front}/login?error=${encodeURIComponent(`Facebook: ${rawMsg}`)}`;
      if (code) {
        failOAuthCode(code, errorUrl);
      }
      res.redirect(errorUrl);
      return null;
    }
    return user;
  }
}

@Injectable()
export class ZaloOAuthGuard extends AuthGuard('zalo') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const id = this.config.get<string>('oauth.zalo.clientID');
    if (!id || id === 'dummy-zalo-client-id') {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      res.redirect(
        `${front}/login?error=${encodeURIComponent('Zalo OAuth chưa được cấu hình (thiếu ZALO_APP_ID trong .env)')}`,
      );
      return false;
    }
    return super.canActivate(context);
  }
}
