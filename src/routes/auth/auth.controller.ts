// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, OAuthProfile } from './auth.service';
import { Public } from '../shared/decorators/public.decorator';
import {
  GoogleOAuthGuard,
  FacebookOAuthGuard,
  ZaloOAuthGuard,
} from '../shared/guards/oauth.guard';
import {
  type AuthUser,
  CurrentUser,
} from '../shared/decorators/current-user.decorator';
import {
  ConfirmTotpDto,
  Disable2faDto,
  Enable2faDto,
  LoginDto,
  RegisterDto,
  ResendOtpDto,
  Verify2faDto,
  VerifyEmailOtpDto,
} from './dto/auth.dto';
import { Device, type DeviceInfo } from '../shared/decorators/device.decorator';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    const hours =
      this.config.get<number>('jwt.refreshTtlHours') ??
      (this.config.get<number>('jwt.refreshTtlDays') ?? 30) * 24;

    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('env') === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: hours * 3_600_000,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }

  /** Tách refreshToken khỏi body trả về, chỉ đặt vào cookie */
  private respond(res: Response, result: any) {
    if (result?.refreshToken) {
      this.setRefreshCookie(res, result.refreshToken);
      const { refreshToken, ...safe } = result;
      return safe;
    }
    return result;
  }

  // ───────── ĐĂNG KÝ / OTP ─────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailOtpDto,
    @Device() device: DeviceInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.auth.verifyRegistrationOtp(dto, device),
    );
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto.email);
  }

  // ───────── ĐĂNG NHẬP ─────────
  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Device() device: DeviceInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.login(dto, device));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  async verify2fa(
    @Body() dto: Verify2faDto,
    @Device() device: DeviceInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.verifyTwoFactor(dto, device));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Device() device: DeviceInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return { authenticated: false, accessToken: null };
    }
    try {
      return this.respond(res, await this.auth.refresh(token, device));
    } catch (e) {
      this.clearRefreshCookie(res);
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshCookie(res);
    return this.auth.logout(user.sessionId);
  }

  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshCookie(res);
    return this.auth.logoutAll(userId);
  }

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }

  @Get('sessions')
  sessions(@CurrentUser('id') userId: string) {
    return this.auth.listSessions(userId);
  }

  // ───────── OAUTH2 GOOGLE ─────────
  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleAuth() {
    /* passport redirect */
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req.user as OAuthProfile, res);
  }

  // ───────── OAUTH2 FACEBOOK ─────────
  @Public()
  @Get('facebook')
  @UseGuards(FacebookOAuthGuard)
  facebookAuth() {
    /* passport redirect */
  }

  @Public()
  @Get('facebook/callback')
  @UseGuards(FacebookOAuthGuard)
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req.user as OAuthProfile, res);
  }

  // ───────── OAUTH2 ZALO ─────────
  @Public()
  @Get('zalo')
  @UseGuards(ZaloOAuthGuard)
  zaloAuth() {
    /* passport redirect */
  }

  @Public()
  @Get('zalo/callback')
  @UseGuards(ZaloOAuthGuard)
  async zaloCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req.user as OAuthProfile, res);
  }

  private async finishOAuth(profile: OAuthProfile, res: Response) {
    const front = this.config.get<string>('frontendUrl');
    try {
      const { oneTimeToken } = await this.auth.handleOAuthLogin(profile);
      return res.redirect(`${front}/oauth/callback?token=${oneTimeToken}`);
    } catch (e: any) {
      const msg = encodeURIComponent(e?.message ?? 'Đăng nhập thất bại');
      return res.redirect(`${front}/login?error=${msg}`);
    }
  }

  @Public()
  @Post('oauth/exchange')
  async exchange(
    @Body('token') token: string,
    @Device() device: DeviceInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.exchangeOAuthToken(token, device));
  }

  // ───────── 2FA SETTINGS ─────────
  @Post('2fa/enable')
  enable2fa(@CurrentUser('id') userId: string, @Body() dto: Enable2faDto) {
    return this.auth.enable2fa(userId, dto);
  }

  @Post('2fa/totp/confirm')
  confirmTotp(@CurrentUser('id') userId: string, @Body() dto: ConfirmTotpDto) {
    return this.auth.confirmTotp(userId, dto);
  }

  @Post('2fa/disable/request')
  requestDisable(@CurrentUser('id') userId: string) {
    return this.auth.requestDisable2fa(userId);
  }

  @Delete('2fa')
  disable2fa(@CurrentUser('id') userId: string, @Body() dto: Disable2faDto) {
    return this.auth.disable2fa(userId, dto);
  }
}
