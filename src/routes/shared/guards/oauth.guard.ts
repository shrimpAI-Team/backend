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

function extractOAuthErrorMessage(err: any, info: any, defaultMsg: string): string {
  const data = err?.oauthError?.data || err?.response?.data || err?.data;
  if (data) {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {}
    if (typeof data === 'string' && data.length < 200) {
      return data;
    }
  }
  return err?.message || info?.message || (typeof err === 'string' ? err : defaultMsg);
}

// ───────── GOOGLE OAUTH GUARD ─────────
// Giữ nguyên thiết kế ban đầu hoạt động 100% ổn định
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const id = this.config.get<string>('oauth.google.clientID');
    if (!id || id === 'dummy-google-client-id') {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      res.redirect(
        `${front}/login?error=${encodeURIComponent('Google OAuth chưa được cấu hình (thiếu GOOGLE_CLIENT_ID trong .env)')}`,
      );
      return false;
    }
    return super.canActivate(context);
  }
}

// ───────── FACEBOOK OAUTH GUARD ─────────
@Injectable()
export class FacebookOAuthGuard extends AuthGuard('facebook') {
  private readonly logger = new Logger(FacebookOAuthGuard.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const id = this.config.get<string>('oauth.facebook.clientID');
    const res = context.switchToHttp().getResponse<Response>();

    if (!id || id === 'dummy-facebook-client-id') {
      const front = this.config.get<string>('frontendUrl');
      if (!res.headersSent) {
        res.redirect(
          `${front}/login?error=${encodeURIComponent('Facebook OAuth chưa được cấu hình (thiếu FACEBOOK_APP_ID trong .env)')}`,
        );
      }
      return false;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const code = req.query?.code as string | undefined;

    // Nếu là bước khởi tạo đăng nhập (/auth/facebook), KHÔNG PHẢI callback:
    // Để passport tự redirect trình duyệt sang trang đăng nhập của Facebook
    if (!req.path.includes('callback') && !code) {
      return super.canActivate(context) as Promise<boolean>;
    }

    // Chống race condition khi browser / prefetch gửi trùng mã authorization code
    if (code && typeof code === 'string') {
      const existing = oauthCodeCache.get(code);
      if (existing) {
        if (existing.redirectUrl) {
          this.logger.log(`[Facebook OAuth] Tái sử dụng redirect cho mã code '${code.slice(0, 10)}...'`);
          if (!res.headersSent) {
            res.redirect(existing.redirectUrl);
          }
          return true;
        }

        this.logger.log(`[Facebook OAuth] Đợi request song song đang xử lý mã code '${code.slice(0, 10)}...'`);
        try {
          const redirectUrl = await existing.promise;
          if (!res.headersSent) {
            res.redirect(redirectUrl);
          }
          return true;
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

    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err: any) {
      if (!res.headersSent) {
        const front = this.config.get<string>('frontendUrl');
        const rawMsg = extractOAuthErrorMessage(err, null, 'Đăng nhập Facebook thất bại');
        this.logger.error(`[Facebook OAuth Exception] ${rawMsg}`, err?.stack || err);
        const errorUrl = `${front}/login?error=${encodeURIComponent(`Facebook: ${rawMsg}`)}`;
        if (code) {
          failOAuthCode(code, errorUrl);
        }
        res.redirect(errorUrl);
      }
      return true;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    // Chỉ can thiệp ở route callback. Ở route /auth/facebook khởi tạo, user = undefined là bình thường!
    if (!req.path.includes('callback') && !req.query?.code && !req.query?.error) {
      return user;
    }

    const code = req.query?.code as string | undefined;

    if (err || !user) {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      const rawMsg = extractOAuthErrorMessage(err, info, 'Đăng nhập Facebook thất bại');
      this.logger.error(`[Facebook OAuth Error] ${rawMsg}`, err?.stack || err);
      const errorUrl = `${front}/login?error=${encodeURIComponent(`Facebook: ${rawMsg}`)}`;
      if (code) {
        failOAuthCode(code, errorUrl);
      }
      if (!res.headersSent) {
        res.redirect(errorUrl);
      }
      return null;
    }
    return user;
  }
}

// ───────── ZALO OAUTH GUARD ─────────
@Injectable()
export class ZaloOAuthGuard extends AuthGuard('zalo') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const id = this.config.get<string>('oauth.zalo.clientID');
    const res = context.switchToHttp().getResponse<Response>();
    if (!id || id === 'dummy-zalo-client-id') {
      const front = this.config.get<string>('frontendUrl');
      if (!res.headersSent) {
        res.redirect(
          `${front}/login?error=${encodeURIComponent('Zalo OAuth chưa được cấu hình (thiếu ZALO_APP_ID trong .env)')}`,
        );
      }
      return false;
    }
    return super.canActivate(context);
  }
}
