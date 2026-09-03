import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { ReportRepository } from '../repositories/report.repository';
import { DomainException } from '../../../common/filters/domain.exception';

const SHARE_TTL_DAYS = 14; // shorter than Wishlist's 30 days — reports carry more personal detail

export interface ShareResult { token: string; expiresAt: Date; qrCodeDataUrl: string; }

/**
 * Mirrors WishlistShareService's token + TTL-expiry pattern exactly
 * (see wishlist-share.model.ts's `{expireAfterSeconds:0}` index, copied
 * onto GeneratedReport.shareExpiresAt). QR is generated the same way
 * TwoFactorService.initiateTotpSetup() already does (`QRCode.toDataURL`).
 */
@Injectable()
export class ReportShareService {
  constructor(
    private readonly repo: ReportRepository,
    private readonly config: ConfigService,
  ) {}

  async createShare(userId: string, reportId: string): Promise<ShareResult> {
    const report = await this.repo.findByIdForUser(userId, reportId);
    if (!report) throw new DomainException('NOT_FOUND', 'Report not found.', HttpStatus.NOT_FOUND);

    const token = report.shareToken ?? randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);
    report.shareToken = token;
    report.shareEnabled = true;
    report.shareExpiresAt = expiresAt;
    await report.save();

    const baseUrl = this.config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3001';
    const shareUrl = `${baseUrl}/reports/shared/${token}`;
    const qrCodeDataUrl = await QRCode.toDataURL(shareUrl);

    return { token, expiresAt, qrCodeDataUrl };
  }

  async disableShare(userId: string, reportId: string): Promise<void> {
    const report = await this.repo.findByIdForUser(userId, reportId);
    if (!report) throw new DomainException('NOT_FOUND', 'Report not found.', HttpStatus.NOT_FOUND);
    report.shareEnabled = false;
    await report.save();
  }

  /** Public, read-only — sanitized projection only, never the raw userId. */
  async resolve(token: string) {
    const report = await this.resolveValidReport(token);
    return {
      reportType: report.reportType,
      format: report.format,
      generatedAt: report.generatedAt,
      sizeBytes: report.sizeBytes,
    };
  }

  /** Internal-only — the full document, used by the controller to stream
   * the actual file for a valid share token. Never returned as JSON. */
  async resolveValidReport(token: string) {
    const report = await this.repo.findByShareToken(token);
    if (!report || (report.shareExpiresAt && report.shareExpiresAt < new Date())) {
      throw new DomainException('NOT_FOUND', 'This shared report link is invalid, disabled, or has expired.', HttpStatus.NOT_FOUND);
    }
    return report;
  }
}
