import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AdminUser, AdminUserSchema } from './models/admin-user.model';
import { PasswordResetToken, PasswordResetTokenSchema } from './models/password-reset-token.model';
import { OtpToken, OtpTokenSchema } from './models/otp-token.model';
import { User, UserSchema } from '../users/models/user.model';
import { AdminUserRepository } from './repositories/admin-user.repository';
import { UserRepository } from '../users/repositories/user.repository';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { OtpTokenRepository } from './repositories/otp-token.repository';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { LoginRateLimiterService } from './services/login-rate-limiter.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { MailerModule } from '../../common/mailer/mailer.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
      { name: OtpToken.name, schema: OtpTokenSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MailerModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService, TokenService, PasswordService,
    LoginRateLimiterService, JwtStrategy,
    AdminUserRepository, PasswordResetTokenRepository, OtpTokenRepository, UserRepository,
  ],
  exports: [TokenService, AuthService, AdminUserRepository, UserRepository, PasswordService, OtpTokenRepository],
})
export class AuthModule {}
