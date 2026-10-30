import { HttpStatus, Injectable } from '@nestjs/common';
import { MailerService } from '../../../common/mailer/mailer.service';
import { ReportRepository } from '../repositories/report.repository';
import { ReportFileStorageService } from './report-file-storage.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { DomainException } from '../../../common/filters/domain.exception';
import { REPORT_TYPE_LABELS } from '../report-labels';

@Injectable()
export class ReportEmailService {
  constructor(
    private readonly repo: ReportRepository,
    private readonly storage: ReportFileStorageService,
    private readonly userRepo: UserRepository,
    private readonly mailer: MailerService,
  ) {}

  async email(userId: string, reportId: string, to?: string): Promise<void> {
    const report = await this.repo.findByIdForUser(userId, reportId);
    if (!report) throw new DomainException('NOT_FOUND', 'Report not found.', HttpStatus.NOT_FOUND);

    const recipient = to ?? (await this.userRepo.findById(userId))?.email;
    if (!recipient) throw new DomainException('UNPROCESSABLE', 'No recipient email available — add an email to your profile or specify one.', HttpStatus.UNPROCESSABLE_ENTITY);

    const label = REPORT_TYPE_LABELS[report.reportType] ?? report.reportType;
    const html = `<h1>Your ${label}</h1><p>Your requested report from CareerCompass AI is attached to this email, generated on ${report.generatedAt.toDateString()}. You can also find it any time in your Reports Center.</p>`;

    const content = await this.storage.read(report.storageKey);
    await this.mailer.deliverEmail(recipient, `Your ${label} is ready`, html, [
      { filename: `${label.replace(/\s+/g, '-')}.${report.format}`, content },
    ]);
  }
}
