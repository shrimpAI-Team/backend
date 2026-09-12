// src/routes/auth/strategies/facebook.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { OAuthProfile } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    const clientID =
      config.get<string>('oauth.facebook.clientID') || 'dummy-facebook-client-id';
    const clientSecret =
      config.get<string>('oauth.facebook.clientSecret') ||
      'dummy-facebook-client-secret';
    const callbackURL =
      config.get<string>('oauth.facebook.callbackURL') ||
      'http://localhost:4000/auth/facebook/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: any, user?: OAuthProfile) => void,
  ) {
    const email =
      profile.emails?.[0]?.value || `facebook_${profile.id}@facebook.oauth.local`;
    const fullName =
      profile.displayName ||
      `${profile.name?.givenName ?? ''} ${profile.name?.familyName ?? ''}`.trim();

    const mapped: OAuthProfile = {
      provider: 'facebook',
      providerAccountId: profile.id,
      email,
      name: fullName || 'Facebook User',
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, mapped);
  }
}
