import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './models/user.model';
import { EmailVerificationToken, EmailVerificationTokenSchema } from './models/email-verification-token.model';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../../common/mailer/mailer.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: EmailVerificationToken.name, schema: EmailVerificationTokenSchema },
    ]),
    AuthModule, // for TokenService
    MailerModule,
  ],
  controllers: [UsersController],
  providers: [UserRepository, UserService],
  exports: [UserRepository, UserService],
})
export class UsersModule {}
