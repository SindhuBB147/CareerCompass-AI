import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { IsBoolean } from 'class-validator';
import { AccessTokenPayload } from '../../auth/services/token.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import { TwoFactorService } from '../services/two-factor.service';
import { DeviceService } from '../services/device.service';
import { LoginHistoryService } from '../services/login-history.service';
import { SessionService } from '../services/session.service';
import { SecurityDashboardService } from '../services/security-dashboard.service';
import { PasswordPolicyService } from '../services/password-policy.service';
import { ReauthService } from '../services/reauth.service';
import { SecurityAuditService } from '../services/security-audit.service';
import { InvalidCredentialsException } from '../../auth/auth.exceptions';
import { LinkedAccountProvider } from '../../users/models/user.model';
import {
  ConfirmTwoFactorSetupDto, DisableTwoFactorDto, InitiateTwoFactorSetupDto,
  ReauthDto, RenameDeviceDto, ReportUnknownLoginDto,
} from '../security.dto';
import { AuditAction } from '../../../common/decorators/auth.decorators';

class TrustDeviceDto { @IsBoolean() isTrusted: boolean; }
class PasswordStrengthDto { password: string; }

type AuthReq = Request & { user: AccessTokenPayload };

function actorOf(req: AuthReq): 'student' | 'admin' {
  return req.user.role === 'student' ? 'student' : 'admin';
}

@Controller('security')
export class SecurityController {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly adminRepo: AdminUserRepository,
    private readonly twoFactor: TwoFactorService,
    private readonly devices: DeviceService,
    private readonly loginHistory: LoginHistoryService,
    private readonly sessions: SessionService,
    private readonly dashboard: SecurityDashboardService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly reauth: ReauthService,
    private readonly audit: SecurityAuditService,
  ) {}

  // ── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  async getDashboard(@Req() req: AuthReq) {
    const data = await this.dashboard.dashboard(req.user.sub, actorOf(req));
    return { success: true, data };
  }

  @Post('reauth')
  async reauthenticate(@Body() dto: ReauthDto, @Req() req: AuthReq) {
    const reauthToken = await this.reauth.verifyAndIssue(req.user.sub, actorOf(req), dto.currentPassword);
    return { success: true, data: { reauthToken } };
  }

  @Post('password/strength')
  checkStrength(@Body() dto: PasswordStrengthDto) {
    return { success: true, data: this.passwordPolicy.strength(dto.password ?? '') };
  }

  // ── Two-Factor Authentication ───────────────────────────────────────────

  @Get('2fa/status')
  async twoFactorStatus(@Req() req: AuthReq) {
    return { success: true, data: await this.twoFactor.status(req.user.sub, actorOf(req)) };
  }

  @Post('2fa/setup') @AuditAction('2fa_enabled')
  async setupTwoFactor(@Body() dto: InitiateTwoFactorSetupDto, @Req() req: AuthReq) {
    const actorType = actorOf(req);
    if (dto.method === 'totp') {
      const { qrCodeDataUrl, secret } = await this.twoFactor.initiateTotpSetup(req.user.sub, actorType, req.user.email);
      return { success: true, data: { method: 'totp', qrCodeDataUrl, manualEntryKey: secret } };
    }
    await this.twoFactor.initiateEmailSetup(req.user.sub, actorType, req.user.email);
    return { success: true, data: { method: 'email', message: 'A verification code was sent to your email.' } };
  }

  @Post('2fa/setup/confirm') @AuditAction('2fa_enabled')
  async confirmTwoFactorSetup(@Body() dto: ConfirmTwoFactorSetupDto, @Req() req: AuthReq) {
    const actorType = actorOf(req);
    const status = await this.twoFactor.status(req.user.sub, actorType);
    const recoveryCodes = status.method === 'email'
      ? await this.twoFactor.confirmEmailSetup(req.user.sub, actorType, dto.code)
      : await this.twoFactor.confirmTotpSetup(req.user.sub, actorType, dto.code);

    await this.setTwoFactorFlag(req.user.sub, actorType, true, status.method ?? 'totp');
    return { success: true, data: { enabled: true, recoveryCodes } };
  }

  @Post('2fa/disable') @AuditAction('2fa_disabled')
  async disableTwoFactor(@Body() dto: DisableTwoFactorDto, @Req() req: AuthReq) {
    const actorType = actorOf(req);
    await this.assertCurrentPassword(req.user.sub, actorType, dto.currentPassword);
    await this.twoFactor.disable(req.user.sub, actorType);
    await this.setTwoFactorFlag(req.user.sub, actorType, false, null);
    return { success: true, data: { enabled: false } };
  }

  @Post('2fa/recovery-codes/regenerate') @AuditAction('2fa_enabled')
  async regenerateRecoveryCodes(@Body() dto: DisableTwoFactorDto, @Req() req: AuthReq) {
    const actorType = actorOf(req);
    await this.assertCurrentPassword(req.user.sub, actorType, dto.currentPassword);
    const recoveryCodes = await this.twoFactor.regenerateRecoveryCodes(req.user.sub, actorType);
    return { success: true, data: { recoveryCodes } };
  }

  // ── Devices ──────────────────────────────────────────────────────────────

  @Get('devices')
  async listDevices(@Req() req: AuthReq) {
    return { success: true, data: await this.devices.list(req.user.sub, actorOf(req)) };
  }

  @Patch('devices/:deviceId') @AuditAction('device_trusted')
  async renameDevice(@Param('deviceId') deviceId: string, @Body() dto: RenameDeviceDto, @Req() req: AuthReq) {
    const device = await this.devices.rename(req.user.sub, actorOf(req), deviceId, dto.deviceName);
    return { success: true, data: device };
  }

  @Patch('devices/:deviceId/trust') @AuditAction('device_trusted')
  async trustDevice(@Param('deviceId') deviceId: string, @Body() dto: TrustDeviceDto, @Req() req: AuthReq) {
    const device = await this.devices.setTrusted(req.user.sub, actorOf(req), deviceId, dto.isTrusted);
    return { success: true, data: device };
  }

  @Delete('devices/:deviceId') @AuditAction('device_removed')
  async removeDevice(@Param('deviceId') deviceId: string, @Req() req: AuthReq) {
    await this.devices.remove(req.user.sub, actorOf(req), deviceId);
    return { success: true, data: { removed: true } };
  }

  // ── Login history ────────────────────────────────────────────────────────

  @Get('login-history')
  async listLoginHistory(@Query('page') page: string | undefined, @Query('limit') limit: string | undefined, @Req() req: AuthReq) {
    const result = await this.loginHistory.list(req.user.sub, actorOf(req), Number(page) || 1, Number(limit) || 20);
    return { success: true, data: result };
  }

  @Post('login-history/:id/report-unknown')
  async reportUnknownLogin(@Param('id') id: string, @Body() _dto: ReportUnknownLoginDto, @Req() req: AuthReq) {
    const updated = await this.loginHistory.reportUnknown(req.user.sub, id);
    return { success: true, data: { reported: !!updated } };
  }

  // ── Sessions (unified student + admin view) ─────────────────────────────

  @Get('sessions')
  async listSessions(@Req() req: AuthReq) {
    return { success: true, data: await this.sessions.list(req.user.sub, actorOf(req)) };
  }

  @Delete('sessions/:sessionId') @AuditAction('session_revoked')
  async revokeSession(@Param('sessionId') sessionId: string, @Req() req: AuthReq) {
    await this.sessions.revoke(req.user.sub, actorOf(req), sessionId);
    return { success: true, data: { revoked: true } };
  }

  @Post('sessions/revoke-others/:keepSessionId') @AuditAction('session_revoked')
  async revokeOtherSessions(@Param('keepSessionId') keepSessionId: string, @Req() req: AuthReq) {
    await this.sessions.revokeOthers(req.user.sub, actorOf(req), keepSessionId);
    return { success: true, data: { revoked: true } };
  }

  @Post('sessions/revoke-all') @AuditAction('session_revoked')
  async revokeAllSessions(@Req() req: AuthReq) {
    await this.sessions.revokeAll(req.user.sub, actorOf(req));
    return { success: true, data: { revoked: true } };
  }

  // ── Linked accounts (student only — link already happens via OAuth login) ─

  @Get('linked-accounts')
  async listLinkedAccounts(@Req() req: AuthReq) {
    if (actorOf(req) !== 'student') return { success: true, data: [] };
    const user = await this.userRepo.findById(req.user.sub);
    return { success: true, data: user?.linkedAccounts ?? [] };
  }

  @Delete('linked-accounts/:provider') @AuditAction('linked_account_removed')
  async unlinkAccount(@Param('provider') provider: string, @Req() req: AuthReq) {
    if (actorOf(req) !== 'student') return { success: true, data: { unlinked: false } };
    await this.userRepo.unlinkAccount(req.user.sub, provider as LinkedAccountProvider);
    return { success: true, data: { unlinked: true } };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async setTwoFactorFlag(userId: string, actorType: 'student' | 'admin', enabled: boolean, method: string | null) {
    if (actorType === 'student') await this.userRepo.setTwoFactorEnabled(userId, enabled, method);
    else await this.adminRepo.setTwoFactorEnabled(userId, enabled, method);
  }

  private async assertCurrentPassword(userId: string, actorType: 'student' | 'admin', currentPassword: string) {
    // Reuses ReauthService's password check but discards the step-up token —
    // disabling 2FA / regenerating recovery codes only needs the "did they
    // just prove it's them" guarantee, not a reusable elevated-privilege token.
    await this.reauth.verifyAndIssue(userId, actorType, currentPassword).catch(() => { throw new InvalidCredentialsException(); });
  }
}
