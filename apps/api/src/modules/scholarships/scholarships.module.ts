import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Scholarship, ScholarshipSchema } from './models/scholarship.model';
import { ScholarshipCategory, ScholarshipCategorySchema } from './models/scholarship-category.model';
import { ScholarshipProvider, ScholarshipProviderSchema } from './models/scholarship-provider.model';
import { ScholarshipBookmark, ScholarshipBookmarkSchema } from './models/scholarship-bookmark.model';
import { ScholarshipInteraction, ScholarshipInteractionSchema } from './models/scholarship-interaction.model';
import { ScholarshipRepository } from './repositories/scholarship.repository';
import { ScholarshipCategoryRepository } from './repositories/scholarship-category.repository';
import { ScholarshipProviderRepository } from './repositories/scholarship-provider.repository';
import { ScholarshipBookmarkRepository } from './repositories/scholarship-bookmark.repository';
import { ScholarshipService } from './services/scholarship.service';
import { ScholarshipTaxonomyService } from './services/scholarship-taxonomy.service';
import { EligibilityEngineService } from './services/eligibility-engine.service';
import { RecommendationService } from './services/recommendation.service';
import { ScholarshipInteractionService } from './services/scholarship-interaction.service';
import { ScholarshipController } from './scholarships.controller';
import { AdminScholarshipController } from './admin-scholarships.controller';
import { AdminScholarshipCategoryController, AdminScholarshipProviderController } from './admin-scholarship-taxonomy.controller';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Scholarship.name, schema: ScholarshipSchema },
      { name: ScholarshipCategory.name, schema: ScholarshipCategorySchema },
      { name: ScholarshipProvider.name, schema: ScholarshipProviderSchema },
      { name: ScholarshipBookmark.name, schema: ScholarshipBookmarkSchema },
      { name: ScholarshipInteraction.name, schema: ScholarshipInteractionSchema },
    ]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [ScholarshipController, AdminScholarshipController, AdminScholarshipCategoryController, AdminScholarshipProviderController],
  providers: [
    ScholarshipRepository, ScholarshipCategoryRepository, ScholarshipProviderRepository, ScholarshipBookmarkRepository,
    ScholarshipService, ScholarshipTaxonomyService, EligibilityEngineService, RecommendationService, ScholarshipInteractionService,
  ],
  exports: [ScholarshipService, ScholarshipInteractionService],
})
export class ScholarshipsModule {}
