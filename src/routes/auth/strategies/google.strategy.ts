// src/auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { OAuthProfile } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('oauth.google.clientID') || 'dummy-google-client-id';
    const clientSecret = config.get<string>('oauth.google.clientSecret') || 'dummy-google-client-secret';
    const callbackURL = config.get<string>('oauth.google.callbackURL') || 'http://localhost:4000/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(_a: string, _r: string, profile: Profile, done: VerifyCallback) {
    const mapped: OAuthProfile = {
      provider: 'google',
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, mapped);
  }
}
