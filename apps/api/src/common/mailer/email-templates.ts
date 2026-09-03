// Built-in email template defaults — an admin-authored NotificationTemplate
// row (see notification-template.model.ts) with a matching `key` overrides
// these at send time; deleting that row reverts to the default here.
//
// Bodies are inner content only (heading + paragraphs + optional button) —
// MailerService.wrapInBrandShell() wraps them in the shared header/footer so
// every CareerCompass email looks the same regardless of which template fired.

export interface EmailTemplateDefault {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  category?: string;
  availableVariables: string[];
}

export const EMAIL_TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
  {
    key: 'welcome',
    name: 'Welcome Email',
    category: 'account',
    subject: 'Welcome to CareerCompass AI, {{name}}',
    availableVariables: ['name', 'ctaUrl'],
    htmlBody: `
      <h1>Welcome aboard, {{name}}.</h1>
      <p>Your CareerCompass AI account is ready. We'll help you track admissions, scholarships, and your career
      roadmap in one place — and let you know the moment something needs your attention.</p>
      <a class="btn" href="{{ctaUrl}}">Complete your profile</a>
    `,
  },
  {
    key: 'verification',
    name: 'Verification Email',
    category: 'account',
    subject: 'Verify your email — CareerCompass AI',
    availableVariables: ['code', 'expiryHours'],
    htmlBody: `
      <h1>Verify your email</h1>
      <p>Your verification code is:</p>
      <p class="code">{{code}}</p>
      <p>This code expires in {{expiryHours}} hours. If you didn't request this, you can safely ignore this email.</p>
    `,
  },
  {
    key: 'password_reset',
    name: 'Password Reset',
    category: 'account',
    subject: 'Your CareerCompass AI password reset code',
    availableVariables: ['code', 'expiryMinutes'],
    htmlBody: `
      <h1>Reset your password</h1>
      <p>Your one-time code is:</p>
      <p class="code">{{code}}</p>
      <p>It expires in {{expiryMinutes}} minutes. If you didn't request this, you can ignore this email.</p>
    `,
  },
  {
    key: 'admission_reminder',
    name: 'Admission Reminder',
    category: 'admissions',
    subject: '{{examCode}}: {{eventLabel}}',
    availableVariables: ['name', 'examCode', 'eventLabel', 'eventDate', 'ctaUrl'],
    htmlBody: `
      <h1>{{examCode}} update</h1>
      <p>Hi {{name}}, <strong>{{eventLabel}}</strong> is scheduled for <strong>{{eventDate}}</strong>. Don't miss it.</p>
      <a class="btn" href="{{ctaUrl}}">View details</a>
    `,
  },
  {
    key: 'scholarship_reminder',
    name: 'Scholarship Reminder',
    category: 'scholarships',
    subject: 'Scholarship alert: {{scholarshipName}}',
    availableVariables: ['name', 'scholarshipName', 'message', 'ctaUrl'],
    htmlBody: `
      <h1>{{scholarshipName}}</h1>
      <p>Hi {{name}}, {{message}}</p>
      <a class="btn" href="{{ctaUrl}}">View scholarship</a>
    `,
  },
  {
    key: 'roadmap_reminder',
    name: 'Roadmap Reminder',
    category: 'roadmap',
    subject: 'Your roadmap: {{milestoneTitle}}',
    availableVariables: ['name', 'milestoneTitle', 'message', 'ctaUrl'],
    htmlBody: `
      <h1>Keep the momentum going</h1>
      <p>Hi {{name}}, {{message}}</p>
      <a class="btn" href="{{ctaUrl}}">Open your roadmap</a>
    `,
  },
  {
    key: 'financial_alert',
    name: 'Financial Alert',
    category: 'financial',
    subject: 'Financial update: {{title}}',
    availableVariables: ['name', 'title', 'message', 'ctaUrl'],
    htmlBody: `
      <h1>{{title}}</h1>
      <p>Hi {{name}}, {{message}}</p>
      <a class="btn" href="{{ctaUrl}}">View financial planner</a>
    `,
  },
  {
    key: 'weekly_progress',
    name: 'Weekly Progress Summary',
    category: 'roadmap',
    subject: 'Your week on CareerCompass AI',
    availableVariables: ['name', 'summaryHtml', 'ctaUrl'],
    htmlBody: `
      <h1>Your week in review</h1>
      <p>Hi {{name}}, here's what's new:</p>
      {{summaryHtml}}
      <a class="btn" href="{{ctaUrl}}">Open dashboard</a>
    `,
  },
  {
    key: 'two_factor_code',
    name: 'Two-Factor Login Code',
    category: 'security',
    subject: 'Your CareerCompass AI verification code',
    availableVariables: ['code', 'expiryMinutes'],
    htmlBody: `
      <h1>Your verification code</h1>
      <p class="code">{{code}}</p>
      <p>It expires in {{expiryMinutes}} minutes. If you didn't try to sign in, secure your account and change your password immediately.</p>
    `,
  },
  {
    key: 'security_2fa_enabled',
    name: 'Two-Factor Authentication Enabled',
    category: 'security',
    subject: 'Two-factor authentication is now on',
    availableVariables: ['name'],
    htmlBody: `
      <h1>Two-factor authentication enabled</h1>
      <p>Hi {{name}}, two-factor authentication was just turned on for your account. If this wasn't you, reset your password immediately.</p>
    `,
  },
  {
    key: 'security_2fa_disabled',
    name: 'Two-Factor Authentication Disabled',
    category: 'security',
    subject: 'Two-factor authentication is now off',
    availableVariables: ['name'],
    htmlBody: `
      <h1>Two-factor authentication disabled</h1>
      <p>Hi {{name}}, two-factor authentication was just turned off for your account. If this wasn't you, reset your password immediately.</p>
    `,
  },
  {
    key: 'security_suspicious_login',
    name: 'Suspicious Login Alert',
    category: 'security',
    subject: 'Unusual sign-in activity on your account',
    availableVariables: ['name', 'device', 'ip', 'time'],
    htmlBody: `
      <h1>Unusual sign-in activity</h1>
      <p>Hi {{name}}, we noticed repeated failed sign-in attempts on your account from {{device}} ({{ip}}) at {{time}}. If this wasn't you, change your password now.</p>
    `,
  },
  {
    key: 'security_account_locked',
    name: 'Account Locked',
    category: 'security',
    subject: 'Your account has been temporarily locked',
    availableVariables: ['name', 'minutes'],
    htmlBody: `
      <h1>Account temporarily locked</h1>
      <p>Hi {{name}}, your account was locked for {{minutes}} minutes after too many failed sign-in attempts. If this wasn't you, reset your password once it unlocks.</p>
    `,
  },
];

export const EMAIL_TEMPLATE_KEYS = EMAIL_TEMPLATE_DEFAULTS.map(t => t.key);
