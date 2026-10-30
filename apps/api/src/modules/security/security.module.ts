import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TwoFactorAuth, TwoFactorAuthSchema } from './models/two-factor-auth.model';
import { TrustedDevice, TrustedDeviceSchema } from './models/trusted-device.model';
import { LoginHistory, LoginHistorySchema } from './models/login-history.model';
import { SecurityEvent, SecurityEventSchema } from './models/security-event.model';
import { TwoFactorAuthRepository } from './repositories/two-factor-auth.repository';
import { TrustedDeviceRepository } from './repositories/trusted-device.repository';
import { LoginHistoryRepository } from './repositories/login-history.repository';
import { SecurityEventRepository } from './repositories/security-event.repository';
import { TwoFactorService } from './services/two-factor.service';
import { DeviceService } from './services/device.service';
import { LoginHistoryService } from './services/login-history.service';
import { SessionService } from './services/session.service';
import { SecurityAuditService } from './services/security-audit.service';
import { SecurityDashboardService } from './services/security-dashboard.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { BreachDetectionService } from './services/breach-detection.service';
import { ReauthService } from './services/reauth.service';
import { AdminSecurityService } from './services/admin-security.service';
import { SecurityEventListenerService } from './services/security-event-listener.service';
import { ReauthGuard } from './guards/reauth.guard';
import { SecurityController } from './controllers/security.controller';
import { AdminSecurityController } from './controllers/admin-security.controller';
import { TwoFactorLoginController } from './controllers/two-factor-login.controller';
import { SecurityAuditInterceptor } from '../../common/interceptors/security-audit.interceptor';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { MailerModule } from '../../common/mailer/mailer.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TwoFactorAuth.name, schema: TwoFactorAuthSchema },
      { name: TrustedDevice.name, schema: TrustedDeviceSchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: SecurityEvent.name, schema: SecurityEventSchema },
    ]),
    AuthModule, // UserRepository, AdminUserRepository, TokenService, PasswordService, OtpTokenRepository
    AdminModule, // AdminService (reused for account disable, not duplicated)
    MailerModule,
  ],
  controllers: [SecurityController, AdminSecurityController, TwoFactorLoginController],
  providers: [
    TwoFactorAuthRepository, TrustedDeviceRepository, LoginHistoryRepository, SecurityEventRepository,
    TwoFactorService, DeviceService, LoginHistoryService, SessionService,
    SecurityAuditService, SecurityDashboardService, PasswordPolicyService, BreachDetectionService,
    ReauthService, AdminSecurityService, SecurityEventListenerService,
    ReauthGuard,
    { provide: APP_INTERCEPTOR, useClass: SecurityAuditInterceptor },
  ],
  exports: [
    TwoFactorService, DeviceService, LoginHistoryService, SessionService,
    SecurityAuditService, PasswordPolicyService, ReauthGuard,
  ],
})
export class SecurityModule {}
