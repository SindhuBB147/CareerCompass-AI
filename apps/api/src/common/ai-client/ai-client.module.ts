import { Module } from '@nestjs/common';
import { AiServiceClient } from './ai-service.client';

/**
 * Shared HTTP client to apps/ai-service. Both CounsellorModule (chat) and
 * SearchModule (smart search) depend on this — it's hoisted out of
 * CounsellorModule rather than one feature importing the other, since
 * "search depends on counsellor" would be a backwards/confusing dependency.
 */
@Module({
  providers: [AiServiceClient],
  exports: [AiServiceClient],
})
export class AiClientModule {}
