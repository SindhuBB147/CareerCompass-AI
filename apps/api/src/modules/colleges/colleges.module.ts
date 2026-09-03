import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { College, CollegeSchema } from './models/college.model';
import { AuditLog, AuditLogSchema } from './models/audit-log.model';
import { CollegeRepository } from './repositories/college.repository';
import { CollegeService } from './services/college.service';
import { CollegeController, AdminCollegeController } from './controllers/college.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: College.name, schema: CollegeSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [CollegeController, AdminCollegeController],
  providers: [CollegeRepository, CollegeService],
  exports: [CollegeRepository, CollegeService],
})
export class CollegesModule {}
