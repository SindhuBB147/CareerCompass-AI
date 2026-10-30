import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './services/user.service';
import {
  AddExamProfileDto, ConfirmEmailVerificationDto, DeleteAccountDto, LinkAccountDto,
  OnboardingStep1Dto, OnboardingStep2Dto, OnboardingStep3Dto, OnboardingStep4Dto,
  OnboardingStep5Dto, OnboardingStep6Dto, RequestEmailVerificationDto,
  UpdateExamProfileDto, UpdateNotificationPreferencesDto, UpdateProfileDto,
} from './dto/user.dto';
import { AccessTokenPayload } from '../auth/services/token.service';
import { LinkedAccountProvider } from './models/user.model';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('users/me')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get() profile(@Req() req: AuthReq) {
    return this.userService.getProfile(req.user.sub).then(d => ({ success: true, data: d }));
  }

  @Patch() async updateProfile(@Body() dto: UpdateProfileDto, @Req() req: AuthReq) {
    const d = await this.userService.updateProfile(req.user.sub, dto);
    return { success: true, data: d };
  }

  @Post('exam-profiles') @HttpCode(HttpStatus.CREATED)
  async addExamProfile(@Body() dto: AddExamProfileDto, @Req() req: AuthReq) {
    const d = await this.userService.addExamProfile(req.user.sub, dto);
    return { success: true, data: d };
  }

  @Patch('exam-profiles/:examCode')
  async updateExamProfile(@Param('examCode') code: string, @Body() dto: UpdateExamProfileDto, @Req() req: AuthReq) {
    const d = await this.userService.updateExamProfile(req.user.sub, code, dto);
    return { success: true, data: d };
  }

  @Delete('exam-profiles/:examCode') @HttpCode(HttpStatus.OK)
  async removeExamProfile(@Param('examCode') code: string, @Req() req: AuthReq) {
    await this.userService.removeExamProfile(req.user.sub, code);
    return { success: true, data: { deleted: true } };
  }

  @Patch('notification-preferences')
  async notificationPrefs(@Body() dto: UpdateNotificationPreferencesDto, @Req() req: AuthReq) {
    const d = await this.userService.updateNotificationPreferences(req.user.sub, dto);
    return { success: true, data: d.notificationChannels };
  }

  @Post('email/verify/request') @HttpCode(HttpStatus.OK)
  async requestEmailVerification(@Body() dto: RequestEmailVerificationDto, @Req() req: AuthReq) {
    await this.userService.requestEmailVerification(req.user.sub, dto.email);
    return { success: true, data: { message: 'A verification code has been sent.' } };
  }

  @Post('email/verify/confirm') @HttpCode(HttpStatus.OK)
  async confirmEmailVerification(@Body() dto: ConfirmEmailVerificationDto, @Req() req: AuthReq) {
    await this.userService.confirmEmailVerification(req.user.sub, dto.token);
    return { success: true, data: { emailVerified: true } };
  }

  // ── Dashboard / profile completion ──────────────────────────────────

  @Get('dashboard')
  async dashboard(@Req() req: AuthReq) {
    return { success: true, data: await this.userService.getDashboardSummary(req.user.sub) };
  }

  @Get('profile-completion')
  async profileCompletion(@Req() req: AuthReq) {
    return { success: true, data: await this.userService.getProfileCompletion(req.user.sub) };
  }

  // ── Onboarding wizard ────────────────────────────────────────────────

  @Get('onboarding')
  async getOnboarding(@Req() req: AuthReq) {
    return { success: true, data: await this.userService.getOnboarding(req.user.sub) };
  }

  @Patch('onboarding/step-1')
  async step1(@Body() dto: OnboardingStep1Dto, @Req() req: AuthReq) {
    return { success: true, data: await this.userService.saveStep1(req.user.sub, dto) };
  }

  @Patch('onboarding/step-2')
  async step2(@Body() dto: OnboardingStep2Dto, @Req() req: AuthReq) {
    return { success: true, data: await this.userService.saveStep2(req.user.sub, dto) };
  }

  @Patch('onboarding/step-3')
  async step3(@Body() dto: OnboardingStep3Dto, @Req() req: AuthReq) {
    return { success: true, data: await this.userService.saveStep3(req.user.sub, dto) };
  }

  @Patch('onboarding/step-4')
  async step4(@Body() dto: OnboardingStep4Dto, @Req() req: AuthReq) {
    return { success: true, data: await this.userService.saveStep4(req.user.sub, dto) };
  }

  @Patch('onboarding/step-5')
  async step5(@Body() dto: OnboardingStep5Dto, @Req() req: AuthReq) {
    return { success: true, data: await this.userService.saveStep5(req.user.sub, dto) };
  }

  @Patch('onboarding/step-6')
  async step6(@Body() dto: OnboardingStep6Dto, @Req() req: AuthReq) {
    return { success: true, data: await this.userService.saveStep6(req.user.sub, dto) };
  }

  @Post('onboarding/complete') @HttpCode(HttpStatus.OK)
  async completeOnboarding(@Req() req: AuthReq) {
    return { success: true, data: await this.userService.completeOnboarding(req.user.sub) };
  }

  // ── Linked accounts ──────────────────────────────────────────────────

  @Get('linked-accounts')
  async linkedAccounts(@Req() req: AuthReq) {
    return { success: true, data: await this.userService.listLinkedAccounts(req.user.sub) };
  }

  @Post('linked-accounts') @HttpCode(HttpStatus.OK)
  async linkAccount(@Body() dto: LinkAccountDto, @Req() req: AuthReq) {
    return { success: true, data: await this.userService.linkAccount(req.user.sub, dto) };
  }

  @Delete('linked-accounts/:provider') @HttpCode(HttpStatus.OK)
  async unlinkAccount(@Param('provider') provider: LinkedAccountProvider, @Req() req: AuthReq) {
    await this.userService.unlinkAccount(req.user.sub, provider);
    return { success: true, data: { unlinked: true } };
  }

  // ── Account deletion ─────────────────────────────────────────────────

  @Delete() @HttpCode(HttpStatus.OK)
  async deleteAccount(@Body() dto: DeleteAccountDto, @Req() req: AuthReq) {
    await this.userService.deleteAccount(req.user.sub);
    return { success: true, data: { deleted: true } };
  }
}
