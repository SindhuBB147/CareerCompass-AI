import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ConsentService } from '../services/consent.service';
import { UpdateConsentDto } from '../dto/memory.dto';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Get()
  async get(@Req() req: AuthReq) {
    return { success: true, data: await this.consentService.getConsent(req.user.sub) };
  }

  @Patch()
  async update(@Body() dto: UpdateConsentDto, @Req() req: AuthReq) {
    const data = await this.consentService.updateConsent(req.user.sub, dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return { success: true, data };
  }

  @Post('withdraw')
  async withdraw(@Req() req: AuthReq) {
    const data = await this.consentService.withdraw(req.user.sub, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return { success: true, data };
  }
}
