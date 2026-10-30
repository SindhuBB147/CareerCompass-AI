import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { NotificationTemplate, NotificationTemplateDocument } from '../../modules/notifications/models/notification-template.model';
import { EMAIL_TEMPLATE_DEFAULTS } from './email-templates';

/**
 * Single point of email delivery for the whole app. Replaces the two
 * previously-duplicated inline `nodemailer.createTransport` blocks in
 * AuthService and UserService — same SMTP_HOST/PORT/USER/PASS + EMAIL_FROM
 * env vars, same "log instead of throw" dev-mode fallback when SMTP isn't
 * configured, so behavior for existing OTP/verification emails is unchanged.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger('MailerService');

  constructor(
    private readonly config: ConfigService,
    @InjectModel(NotificationTemplate.name) private readonly templateModel: Model<NotificationTemplateDocument>,
  ) {}

  /** Low-level send — used directly for one-off HTML (e.g. admin broadcast composer). */
  async deliverEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
  ): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
        host: this.config.get('SMTP_HOST') ?? 'localhost',
        port: Number(this.config.get('SMTP_PORT') ?? 587),
        auth: { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASS') },
      });
      await transporter.sendMail({
        from: this.config.get('EMAIL_FROM') ?? 'no-reply@careercompass.ai',
        to,
        subject,
        html: this.wrapInBrandShell(subject, html),
        attachments,
      });
    } catch (err) {
      // SMTP not configured in this environment — dev-mode fallback so the
      // flow is still testable without a real mail server.
      this.logger.log(`[dev-email] to=${to} subject="${subject}"`);
      this.logger.debug(html);
    }
  }

  /** Renders a named template (admin override if one exists, else the built-in default) and sends it. */
  async sendTemplate(to: string, templateKey: string, variables: Record<string, string>): Promise<void> {
    const override = await this.templateModel.findOne({ key: templateKey, isActive: true }).exec();
    const fallback = EMAIL_TEMPLATE_DEFAULTS.find(t => t.key === templateKey);
    const template = override ?? fallback;
    if (!template) {
      this.logger.warn(`Unknown email template key "${templateKey}" — skipping send.`);
      return;
    }
    const subject = this.render(template.subject, variables);
    const body = this.render(template.htmlBody, variables);
    await this.deliverEmail(to, subject, body);
  }

  private render(template: string, variables: Record<string, string>): string {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => variables[key] ?? '');
  }

  private wrapInBrandShell(title: string, innerHtml: string): string {
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#F8F8F6;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#111111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F8F6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background-color:#FFFFFF;border:1px solid #ECECEC;border-radius:4px;overflow:hidden;">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #ECECEC;">
          <span style="font-family:Georgia,'Playfair Display',serif;font-size:20px;font-weight:600;color:#111111;">CareerCompass<sup style="font-size:11px;color:#2D6EA3;">AI</sup></span>
        </td></tr>
        <tr><td style="padding:32px;font-size:16px;line-height:1.6;">
          <style>
            h1{font-family:Georgia,'Playfair Display',serif;font-weight:500;font-size:24px;margin:0 0 16px;color:#111111;}
            p{margin:0 0 16px;color:#333333;}
            .btn{display:inline-block;background-color:#2D6EA3;color:#FFFFFF!important;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:600;font-size:14px;margin-top:8px;}
            .code{font-size:24px;letter-spacing:6px;font-weight:700;color:#2D6EA3;background:#F1F1F1;padding:12px 20px;border-radius:4px;display:inline-block;}
          </style>
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #ECECEC;font-size:12px;color:#777777;">
          You're receiving this because of your CareerCompass AI notification preferences.
          <a href="#" style="color:#2D6EA3;">Manage preferences</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
