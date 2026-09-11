// src/config/configuration.ts
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:5174').split(',')[0].trim(),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    challengeSecret: process.env.JWT_CHALLENGE_SECRET!,
    challengeTtl: process.env.JWT_CHALLENGE_TTL ?? '5m',
    refreshTtlHours: Number(process.env.REFRESH_TTL_HOURS ?? 2),
    refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS ?? 30),
  },
  otp: {
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 5),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  },
  mail: {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    from: process.env.MAIL_FROM!,
  },
  oauth: {
    google: {
      clientID: process.env.GOOGLE_CLIENT_ID || 'dummy-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy-google-client-secret',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
    },
    github: {
      clientID: process.env.GITHUB_CLIENT_ID || 'dummy-github-client-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy-github-client-secret',
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/auth/github/callback',
    },
  },
  totpIssuer: process.env.TOTP_ISSUER ?? 'AuthDemo',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
  },
});
