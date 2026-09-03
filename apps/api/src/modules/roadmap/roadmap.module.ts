import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareerTemplate, CareerTemplateSchema } from './models/career-template.model';
import { Roadmap, RoadmapSchema } from './models/roadmap.model';
import { CareerCatalogService } from './services/career-catalog.service';
import { RoadmapGeneratorService } from './services/roadmap-generator.service';
import { RoadmapProgressService } from './services/roadmap-progress.service';
import { RoadmapRecommendationService } from './services/roadmap-recommendation.service';
import { RoadmapExportService } from './services/roadmap-export.service';
import { RoadmapController } from './roadmap.controller';
import { AdminRoadmapTemplatesController } from './admin-roadmap-templates.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CareerTemplate.name, schema: CareerTemplateSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
    ]),
    UsersModule,
  ],
  controllers: [RoadmapController, AdminRoadmapTemplatesController],
  providers: [
    CareerCatalogService, RoadmapGeneratorService, RoadmapProgressService,
    RoadmapRecommendationService, RoadmapExportService,
  ],
  exports: [CareerCatalogService, RoadmapGeneratorService, RoadmapProgressService],
})
export class RoadmapModule {}
