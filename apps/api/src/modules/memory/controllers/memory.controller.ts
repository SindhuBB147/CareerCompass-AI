import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { MemoryAggregatorService } from '../services/memory-aggregator.service';
import { UpdatePersonalizationSettingsDto } from '../dto/memory.dto';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

/**
 * "Memory & Privacy" page backend — a read/delete/export facade over every
 * other module's already-existing memory store. See MemoryAggregatorService
 * for exactly which category maps to which module.
 */
@Controller('memory')
export class MemoryController {
  constructor(private readonly aggregator: MemoryAggregatorService) {}

  @Get('summary')
  async summary(@Req() req: AuthReq) {
    return { success: true, data: await this.aggregator.getSummary(req.user.sub) };
  }

  @Get('export')
  async export(@Req() req: AuthReq) {
    return { success: true, data: await this.aggregator.exportUserData(req.user.sub) };
  }

  @Delete(':category') @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param('category') category: string, @Req() req: AuthReq) {
    await this.aggregator.deleteCategory(req.user.sub, category);
    return { success: true, data: { deleted: true, category } };
  }

  @Post('reset-personalization') @HttpCode(HttpStatus.OK)
  async resetPersonalization(@Req() req: AuthReq) {
    await this.aggregator.resetPersonalization(req.user.sub);
    return { success: true, data: { reset: true } };
  }

  @Patch('personalization-settings')
  async updatePersonalizationSettings(@Body() dto: UpdatePersonalizationSettingsDto, @Req() req: AuthReq) {
    await this.aggregator.updatePersonalizationSettings(req.user.sub, dto);
    return { success: true, data: { updated: true } };
  }
}
