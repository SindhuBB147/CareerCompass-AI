import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { Request } from 'express';
import { SessionStateService } from '../services/session-state.service';
import { PatchSessionStateDto } from '../dto/memory.dto';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('session-state')
export class SessionStateController {
  constructor(private readonly sessionStateService: SessionStateService) {}

  @Get()
  async get(@Req() req: AuthReq) {
    return { success: true, data: await this.sessionStateService.getState(req.user.sub) };
  }

  @Patch()
  async patch(@Body() dto: PatchSessionStateDto, @Req() req: AuthReq) {
    return { success: true, data: await this.sessionStateService.patchState(req.user.sub, dto) };
  }
}
