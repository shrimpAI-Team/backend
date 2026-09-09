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
export class GithubOAuthGuard extends AuthGuard('github') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const id = this.config.get<string>('oauth.github.clientID');
    if (!id || id === 'dummy-github-client-id') {
      const res = context.switchToHttp().getResponse<Response>();
      const front = this.config.get<string>('frontendUrl');
      res.redirect(
        `${front}/login?error=${encodeURIComponent('GitHub OAuth chưa được cấu hình (thiếu GITHUB_CLIENT_ID trong .env)')}`,
      );
      return false;
    }
    return super.canActivate(context);
  }
}
