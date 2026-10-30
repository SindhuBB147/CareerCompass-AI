import {
  Body, Controller, Delete, Get, Param, Post, Req, Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CounsellorService } from '../services/counsellor.service';
import { StartSessionDto, SendMessageDto, FeedbackDto } from '../dto/counsellor.dto';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('ai-counsellor')
export class CounsellorController {
  constructor(private readonly svc: CounsellorService) {}

  @Post('sessions')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async start(@Body() dto: StartSessionDto, @Req() req: AuthReq) {
    const session = await this.svc.startSession(req.user.sub, dto.initialMessage);
    return { success: true, data: session };
  }

  @Get('sessions')
  async listSessions(@Req() req: AuthReq) {
    return { success: true, data: { sessions: await this.svc.listSessions(req.user.sub) } };
  }

  @Post('sessions/:sessionId/messages')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async send(@Param('sessionId') sid: string, @Body() dto: SendMessageDto, @Req() req: AuthReq) {
    const msg = await this.svc.sendMessage(req.user.sub, sid, dto.content);
    return { success: true, data: msg };
  }

  @Post('sessions/:sessionId/messages/stream')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async sendStream(
    @Param('sessionId') sid: string,
    @Body() dto: SendMessageDto,
    @Req() req: AuthReq,
    @Res() res: Response,
  ) {
    await this.svc.sendMessageStream(req.user.sub, sid, dto.content, res);
  }

  @Get('sessions/:sessionId')
  async history(@Param('sessionId') sid: string, @Req() req: AuthReq) {
    const conv = await this.svc.getSession(req.user.sub, sid);
    return { success: true, data: conv };
  }

  @Delete('sessions/:sessionId')
  async remove(@Param('sessionId') sid: string, @Req() req: AuthReq) {
    await this.svc.deleteSession(req.user.sub, sid);
    return { success: true, data: { sessionId: sid, deleted: true } };
  }

  @Post('feedback')
  async feedback(@Body() dto: FeedbackDto, @Req() req: AuthReq) {
    await this.svc.submitFeedback(req.user.sub, dto);
    return { success: true, data: { received: true } };
  }
}
