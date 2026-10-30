import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Ip, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './services/auth.service';
import { DomainException } from '../../common/filters/domain.exception';
import {
  LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto,
  OAuthLoginDto, OAUTH_PROVIDERS,
  RegisterDto, StudentLoginDto, StudentRefreshTokenDto, StudentLogoutDto,
  StudentForgotPasswordDto, StudentResetPasswordDto, ChangePasswordDto, AdminLogoutDto,
} from './auth.dto';
import { Public } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from './services/token.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Admin ────────────────────────────────────────────────────────────

  @Post('login') @HttpCode(HttpStatus.OK) @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Ip() ip: string) {
    const result = await this.authService.login(dto.email, dto.password, { ip, userAgent: req.headers['user-agent'] });
    if ('requires2FA' in result) return { success: true, data: result };
    return { success: true, data: { ...result.tokens, role: result.role } };
  }

  @Post('refresh') @HttpCode(HttpStatus.OK) @Public()
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refreshTokens(dto.refreshToken);
    return { success: true, data: tokens };
  }

  @Post('logout') @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: AdminLogoutDto, @Req() req: Request & { user: AccessTokenPayload }) {
    await this.authService.logout(req.user.sub, dto.refreshToken);
    return { success: true, data: { loggedOut: true } };
  }

  @Post('logout-all') @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: Request & { user: AccessTokenPayload }) {
    await this.authService.logoutAll(req.user.sub);
    return { success: true, data: { loggedOut: true } };
  }

  @Post('password/forgot') @HttpCode(HttpStatus.OK) @Public()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { success: true, data: { message: 'If that email is registered, a reset code has been sent.' } };
  }

  @Post('password/reset') @HttpCode(HttpStatus.OK) @Public()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.email, dto.token, dto.newPassword);
    return { success: true, data: { passwordReset: true } };
  }

  // ── OAuth (students) ─────────────────────────────────────────────────

  @Get('oauth/providers') @Public()
  getOAuthProviders() {
    return {
      success: true,
      data: {
        providers: OAUTH_PROVIDERS.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), enabled: id === 'google', icon: id })),
      },
    };
  }

  // Only Google is implemented — dto.idTokenTokenOrCode carries the Google
  // Identity Services ID token, verified server-side (signature + audience)
  // before any identity field is trusted. Other providers respond 501
  // rather than accepting client-supplied identity, which is what this
  // route used to do (an auth-bypass hole: anyone could POST an arbitrary
  // email and be logged in as it).
  @Post('oauth/:provider') @HttpCode(HttpStatus.OK) @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async loginWithProvider(@Param('provider') provider: string, @Body() dto: OAuthLoginDto, @Req() req: Request, @Ip() ip: string) {
    if ((dto.provider ?? provider) !== 'google') {
      throw new DomainException('OAUTH_PROVIDER_NOT_IMPLEMENTED', `Sign-in with ${provider} is not available yet.`, HttpStatus.NOT_IMPLEMENTED);
    }
    const result = await this.authService.loginWithGoogle(dto.idTokenTokenOrCode, { ip, userAgent: req.headers['user-agent'] });
    return { success: true, data: result };
  }

  // ── Student email/password ──────────────────────────────────────────

  @Post('student/register') @HttpCode(HttpStatus.CREATED) @Public()
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Ip() ip: string) {
    const result = await this.authService.registerStudent(dto, { ip, userAgent: req.headers['user-agent'] });
    return { success: true, data: result };
  }

  @Post('student/login') @HttpCode(HttpStatus.OK) @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async studentLogin(@Body() dto: StudentLoginDto, @Req() req: Request, @Ip() ip: string) {
    const result = await this.authService.studentLogin(dto.email, dto.password, { ip, userAgent: req.headers['user-agent'] });
    return { success: true, data: result };
  }

  @Post('student/refresh') @HttpCode(HttpStatus.OK) @Public()
  async studentRefresh(@Body() dto: StudentRefreshTokenDto) {
    const tokens = await this.authService.studentRefreshTokens(dto.refreshToken);
    return { success: true, data: tokens };
  }

  @Post('student/logout') @HttpCode(HttpStatus.OK)
  async studentLogout(@Body() dto: StudentLogoutDto, @Req() req: Request & { user: AccessTokenPayload }) {
    await this.authService.studentLogout(req.user.sub, dto.refreshToken);
    return { success: true, data: { loggedOut: true } };
  }

  @Post('student/logout-all') @HttpCode(HttpStatus.OK)
  async studentLogoutAll(@Req() req: Request & { user: AccessTokenPayload }) {
    await this.authService.studentLogoutAll(req.user.sub);
    return { success: true, data: { loggedOut: true } };
  }

  @Get('student/sessions')
  async listSessions(@Req() req: Request & { user: AccessTokenPayload }) {
    const sessions = await this.authService.listStudentSessions(req.user.sub);
    return { success: true, data: sessions };
  }

  @Delete('student/sessions/:sessionId') @HttpCode(HttpStatus.OK)
  async revokeSession(@Param('sessionId') sessionId: string, @Req() req: Request & { user: AccessTokenPayload }) {
    await this.authService.revokeStudentSession(req.user.sub, sessionId);
    return { success: true, data: { revoked: true } };
  }

  @Post('student/password/forgot') @HttpCode(HttpStatus.OK) @Public()
  async studentForgotPassword(@Body() dto: StudentForgotPasswordDto, @Ip() ip: string) {
    await this.authService.forgotPasswordStudent(dto.email, ip);
    return { success: true, data: { message: 'If that email is registered, a verification code has been sent.' } };
  }

  @Post('student/password/reset') @HttpCode(HttpStatus.OK) @Public()
  async studentResetPassword(@Body() dto: StudentResetPasswordDto) {
    await this.authService.resetPasswordStudent(dto.email, dto.otp, dto.newPassword);
    return { success: true, data: { passwordReset: true } };
  }

  @Post('student/password/change') @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request & { user: AccessTokenPayload }) {
    await this.authService.changePasswordStudent(req.user.sub, dto.currentPassword, dto.newPassword);
    return { success: true, data: { passwordChanged: true } };
  }
}
