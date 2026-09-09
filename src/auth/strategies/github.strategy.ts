import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { OAuthProfile } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('oauth.github.clientID') || 'dummy-github-client-id';
    const clientSecret = config.get<string>('oauth.github.clientSecret') || 'dummy-github-client-secret';
    const callbackURL = config.get<string>('oauth.github.callbackURL') || 'http://localhost:4000/auth/github/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user:email'],
    });
  }

  validate(
    _a: string,
    _r: string,
    profile: Profile,
    done: (err: unknown, user?: OAuthProfile) => void,
  ) {
    const email =
      profile.emails?.find((e: any) => e.primary || e.verified)?.value ??
      profile.emails?.[0]?.value ??
      '';
    done(null, {
      provider: 'github',
      providerAccountId: String(profile.id),
      email,
      name: profile.displayName ?? profile.username,
      avatarUrl: (profile.photos as any)?.[0]?.value,
    });
  }
}
