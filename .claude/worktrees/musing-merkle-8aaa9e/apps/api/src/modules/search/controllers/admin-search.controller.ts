import { Controller, Get, Query } from '@nestjs/common';
import { IsDateString, IsOptional } from 'class-validator';
import { Roles } from '../../../common/decorators/auth.decorators';
import { SearchHistoryService } from '../services/search-history.service';

export class SearchAnalyticsQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

@Controller('admin/search')
export class AdminSearchController {
  constructor(private readonly historyService: SearchHistoryService) {}

  @Get('analytics') @Roles('super_admin', 'data_manager')
  async analytics(@Query() q: SearchAnalyticsQueryDto) {
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    return { success: true, data: await this.historyService.getAnalytics(from, to) };
  }
}
