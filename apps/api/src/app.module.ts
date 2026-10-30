import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CollegesModule } from './modules/colleges/colleges.module';
import { CutoffsModule } from './modules/cutoffs/cutoffs.module';
import { ScholarshipsModule } from './modules/scholarships/scholarships.module';
import { PredictionsModule } from './modules/predictions/predictions.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { CounsellorModule } from './modules/counsellor/counsellor.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { SecurityModule } from './modules/security/security.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { SearchModule } from './modules/search/search.module';
import { FinancialPlanningModule } from './modules/financial-planning/financial-planning.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { StudentReportsModule } from './modules/student-reports/student-reports.module';
import { MemoryModule } from './modules/memory/memory.module';
import { GlobalJwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ReauthGuard } from './modules/security/guards/reauth.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,

    // ── Feature modules ───────────────────────────────────────────────────
    AuthModule,          // Module 1: JWT, RBAC, refresh rotation, forgot/reset password
    UsersModule,         // Module 2: Student profile, exam profiles, notification preferences, email verification
    CollegesModule,      // Modules 3+4+6+7: College CRUD, branches, placements, fees, audit log
    CutoffsModule,       // Module 5: Exams, cutoff history, bulk upload, conflict resolution
    ScholarshipsModule,  // Module 8: Scholarship matching, admin CRUD
    PredictionsModule,   // Modules 9+10+11+12+13: Admission probability, choice-filling optimizer, ROI, placement estimates
    FinancialPlanningModule, // Loan calculator, budget planner
    WishlistModule,      // Saved Colleges & Wishlist: lists, notes, bookmark status, compare, AI insights, sharing
    RoadmapModule,       // Module 14: Career roadmap generator
    StudentReportsModule, // Reports & Export: student-facing report generation (PDF/Excel/CSV/HTML), history, sharing
    CounsellorModule,    // Module 15: AI Counsellor (LLM + RAG)
    AnalyticsModule,     // Module 16: Admin analytics dashboard
    NotificationsModule, // Module 17: Deadline alerts, scholarship alerts, B2B nudges
    AdminModule,         // Module 18: User management, audit logs, B2B roster
    SecurityModule,      // Enterprise Security Module: 2FA, devices, sessions, audit trail, RBAC hardening
    ReportingModule,     // Module 19: Platform & cohort reports
    SearchModule,        // Module 20: AI Smart Search
    MemoryModule,        // User Memory, Preferences, Session Persistence & Cookie Consent — read/delete/export facade over every module's existing memory store, plus consent + UI session-state
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: GlobalJwtAuthGuard populates request.user, RolesGuard
    // does the coarse role check, PermissionsGuard does the finer-grained
    // per-admin-user permission check (DB lookup, only for routes that
    // declare @RequirePermissions()).
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Registered here (not inside SecurityModule) so its position relative
    // to GlobalJwtAuthGuard is guaranteed — cross-module APP_GUARD ordering
    // isn't guaranteed by Nest, and ReauthGuard needs request.user already
    // populated. See modules/security/guards/reauth.guard.ts.
    { provide: APP_GUARD, useClass: ReauthGuard },
    // Enforces the ThrottlerModule.forRoot() default (120/min/IP) on every
    // route; per-route @Throttle() overrides (e.g. AI Counsellor chat/upload)
    // apply on top of this.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
