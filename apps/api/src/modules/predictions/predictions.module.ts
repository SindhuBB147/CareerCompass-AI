import {
  Body, Controller, Get, Module, Param, Post, Query, Req, Injectable,
} from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { Request } from 'express';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Prediction, PredictionSchema } from './models/prediction.model';
import { PredictionService } from './services/prediction.service';
import { PredictionEngineService } from './services/prediction-engine.service';
import { PredictCollegesDto } from './dto/predict-colleges.dto';
import { UsersModule } from '../users/users.module';
import { CollegesModule } from '../colleges/colleges.module';
import { CutoffsModule } from '../cutoffs/cutoffs.module';
import { ScholarshipsModule } from '../scholarships/scholarships.module';
import { Public } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class PredictionQueryDto {
  @IsString() collegeId: string;
  @IsString() courseId: string;
  @IsString() examCode: string;
}

export class ChoiceFillingDto {
  @IsString() examCode: string;
  @IsOptional() @IsEnum(['conservative', 'balanced', 'aggressive']) riskAppetite?: string;
}

export class RoiQueryDto {
  @IsString() courseId: string;
}

export class PlacementQueryDto {
  @IsString() courseId: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('predictions')
export class PredictionController {
  constructor(
    private readonly svc: PredictionService,
    private readonly engine: PredictionEngineService,
  ) {}

  /**
   * Multi-exam Admission Probability Predictor — ranked colleges across
   * KCET/COMEDK/NEET. Public: the predictor form doesn't require login
   * (matches the existing no-login predictor UX), and rank/category are
   * supplied directly in the request rather than read from a saved profile.
   */
  @Post('colleges') @Public()
  async predictColleges(@Body() dto: PredictCollegesDto) {
    return { success: true, data: await this.engine.predictColleges(dto) };
  }

  /** Single prediction for a specific college/course/exam. */
  @Get()
  async predict(@Query() q: PredictionQueryDto, @Req() req: AuthReq) {
    const result = await this.svc.getPrediction(req.user.sub, q.collegeId, q.courseId, q.examCode);
    return { success: true, data: result };
  }

  /** Batch predictions across all shortlisted colleges. */
  @Get('shortlist')
  async shortlist(@Req() req: AuthReq) {
    return { success: true, data: { predictions: await this.svc.getShortlistPredictions(req.user.sub) } };
  }

  /** Choice-filling optimizer: ranked preference list. */
  @Post('choice-filling/optimize')
  async optimize(@Body() dto: ChoiceFillingDto, @Req() req: AuthReq) {
    const result = await this.svc.optimizeChoiceFilling(
      req.user.sub, dto.examCode, dto.riskAppetite ?? 'balanced',
    );
    return { success: true, data: { rankedList: result } };
  }

  /** ROI calculator for a specific college/course. */
  @Get(':collegeId/roi')
  async roi(@Param('collegeId') cid: string, @Query() q: RoiQueryDto, @Req() req: AuthReq) {
    return { success: true, data: await this.svc.getRoi(req.user.sub, cid, q.courseId) };
  }

  /** Placement estimate — public, no login required. */
  @Get(':collegeId/placement') @Public()
  async placement(@Param('collegeId') cid: string, @Query() q: PlacementQueryDto) {
    return { success: true, data: await this.svc.getPlacementEstimate(cid, q.courseId) };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Prediction.name, schema: PredictionSchema }]),
    UsersModule, CollegesModule, forwardRef(() => CutoffsModule), ScholarshipsModule,
  ],
  controllers: [PredictionController],
  providers: [PredictionService, PredictionEngineService],
  exports: [PredictionService, PredictionEngineService],
})
export class PredictionsModule {}
