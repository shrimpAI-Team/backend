import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

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

@Injectable()
export class FacebookOAuthGuard extends AuthGuard('facebook') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const id = this.config.get<string>('oauth.facebook.clientID');
    if (!id || id === 'dummy-facebook-client-id') {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      res.redirect(
        `${front}/login?error=${encodeURIComponent('Facebook OAuth chưa được cấu hình (thiếu FACEBOOK_APP_ID trong .env)')}`,
      );
      return false;
    }
    return super.canActivate(context);
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
