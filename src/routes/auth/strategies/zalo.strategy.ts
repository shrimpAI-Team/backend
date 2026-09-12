// src/routes/auth/strategies/zalo.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OAuth2Strategy, VerifyCallback } from 'passport-oauth2';
import { OAuthProfile } from '../auth.service';

@Injectable()
export class ZaloStrategy extends PassportStrategy(OAuth2Strategy, 'zalo') {
  private readonly logger = new Logger(ZaloStrategy.name);
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(config: ConfigService) {
    const clientID =
      config.get<string>('oauth.zalo.clientID') || 'dummy-zalo-client-id';
    const clientSecret =
      config.get<string>('oauth.zalo.clientSecret') || 'dummy-zalo-client-secret';
    const callbackURL =
      config.get<string>('oauth.zalo.callbackURL') ||
      'http://localhost:4000/auth/zalo/callback';

    super({
      authorizationURL: 'https://oauth.zaloapp.com/v4/permission',
      tokenURL: 'https://oauth.zaloapp.com/v4/access_token',
      clientID,
      clientSecret,
      callbackURL,
      pkce: true,
      state: true,
    });

    this.appId = clientID;
    this.appSecret = clientSecret;

    // Tùy biến hàm lấy access token theo đặc tả Zalo OpenAPI v4:
    // Zalo yêu cầu header "secret_key: <app_secret>" và body "app_id, grant_type=authorization_code, code"
    (this as any)._oauth2.getOAuthAccessToken = async (
      code: string,
      params: any,
      callback: (err: any, accessToken?: string, refreshToken?: string, results?: any) => void,
    ) => {
      try {
        const body = new URLSearchParams({
          app_id: this.appId,
          grant_type: 'authorization_code',
          code,
        });

        if (params?.code_verifier) {
          body.append('code_verifier', params.code_verifier);
        }

        const response = await fetch('https://oauth.zaloapp.com/v4/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            secret_key: this.appSecret,
          },
          body: body.toString(),
        });

        const data = (await response.json()) as any;
        if (data.error || !data.access_token) {
          const errMsg =
            data.message || `Lỗi Zalo OAuth: mã lỗi ${data.error ?? 'không xác định'}`;
          this.logger.error(`Đổi token Zalo thất bại: ${errMsg}`);
          return callback(new Error(errMsg));
        }

        return callback(null, data.access_token, data.refresh_token, data);
      } catch (err: any) {
        this.logger.error(`Gọi Zalo token API thất bại: ${err.message}`);
        return callback(err);
      }
    };
  }

  // Bổ sung tham số app_id vào URL cấp quyền của Zalo
  authorizationParams(_options: any): any {
    return {
      app_id: this.appId,
    };
  }

  // Tải profile người dùng từ Zalo Graph API
  userProfile(
    accessToken: string,
    done: (err?: Error | null, profile?: any) => void,
  ) {
    fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
      headers: { access_token: accessToken },
    })
      .then((res) => res.json())
      .then((data: any) => {
        if (data.error) {
          return done(
            new Error(data.message || `Lỗi lấy profile Zalo: ${data.error}`),
          );
        }
        const profile = {
          provider: 'zalo',
          id: String(data.id),
          displayName: data.name,
          photos: data.picture?.data?.url ? [{ value: data.picture.data.url }] : [],
          _raw: JSON.stringify(data),
          _json: data,
        };
        done(null, profile);
      })
      .catch((err) => done(err));
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const email =
      profile.emails?.[0]?.value || `zalo_${profile.id}@zalo.oauth.local`;
    const mapped: OAuthProfile = {
      provider: 'zalo',
      providerAccountId: String(profile.id),
      email,
      name: profile.displayName || 'Zalo User',
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, mapped);
  }
}
