import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../../auth/services/token.service';
import { SearchService } from '../services/search.service';
import { SearchHistoryService } from '../services/search-history.service';
import { SaveSearchDto, SearchQueryDto, SummarizeDto, VoiceSearchDto } from '../dto/search.dto';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('search')
export class SearchController {
  constructor(
    private readonly svc: SearchService,
    private readonly historyService: SearchHistoryService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async search(@Body() dto: SearchQueryDto, @Req() req: AuthReq) {
    return { success: true, data: await this.svc.search(req.user.sub, dto) };
  }

  /** Accepts an already browser-transcribed query (Web Speech API) — no server-side STT, see useSpeechRecognition.ts. */
  @Post('voice')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async voiceSearch(@Body() dto: VoiceSearchDto, @Req() req: AuthReq) {
    const query: SearchQueryDto = { query: dto.transcript, filters: dto.filters, page: 1, limit: 10 };
    return { success: true, data: await this.svc.search(req.user.sub, query) };
  }

  /**
   * AI-authored summary, decoupled from the primary search() call since it
   * always invokes an LLM (real latency+cost) — see search.service.ts.
   */
  @Post('summarize')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async summarize(@Body() dto: SummarizeDto, @Req() req: AuthReq) {
    return { success: true, data: await this.svc.summarize(req.user.sub, dto) };
  }

  @Get('history')
  async history(@Req() req: AuthReq) {
    const [recent, saved] = await Promise.all([
      this.historyService.listRecent(req.user.sub),
      this.historyService.listSaved(req.user.sub),
    ]);
    return { success: true, data: { recent, saved } };
  }

  @Post('saved')
  async saveSearch(@Body() dto: SaveSearchDto, @Req() req: AuthReq) {
    return { success: true, data: await this.historyService.save(req.user.sub, dto.historyId, dto.label) };
  }

  @Delete('saved/:id')
  async unsaveSearch(@Param('id') id: string, @Req() req: AuthReq) {
    await this.historyService.unsave(req.user.sub, id);
    return { success: true };
  }

  @Get('popular')
  @Public()
  async popular(@Query('limit') limit?: string) {
    return { success: true, data: { popular: await this.historyService.popular(limit ? Number(limit) : 10) } };
  }

  @Get('suggestions')
  @Public()
  async suggestions() {
    return { success: true, data: await this.svc.getSuggestions() };
  }
}
