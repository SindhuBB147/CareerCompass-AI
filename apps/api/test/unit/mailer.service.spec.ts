import { MailerService } from '../../src/common/mailer/mailer.service';

const sendMailMock = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

function execReturning(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('MailerService', () => {
  let configMock: any;
  let templateModel: any;
  let service: MailerService;

  beforeEach(() => {
    jest.clearAllMocks();
    configMock = { get: jest.fn((key: string) => ({ EMAIL_FROM: 'CareerCompass AI <no-reply@careercompass.ai>' } as Record<string, string>)[key] ?? null) };
    templateModel = { findOne: jest.fn() };
    service = new MailerService(configMock, templateModel);
  });

  describe('deliverEmail', () => {
    it('sends via nodemailer, wrapping the body in the branded shell', async () => {
      sendMailMock.mockResolvedValue({ messageId: '1' });
      await service.deliverEmail('student@example.com', 'Test Subject', '<p>Hello</p>');
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: 'student@example.com',
        subject: 'Test Subject',
        html: expect.stringContaining('<p>Hello</p>'),
      }));
      expect(sendMailMock.mock.calls[0][0].html).toContain('CareerCompass');
    });

    it('falls back to a dev-mode log instead of throwing when SMTP delivery fails', async () => {
      sendMailMock.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.deliverEmail('student@example.com', 'Subject', '<p>Body</p>')).resolves.toBeUndefined();
    });
  });

  describe('sendTemplate', () => {
    it('renders the built-in default template when no admin override exists', async () => {
      templateModel.findOne.mockReturnValue(execReturning(null));
      sendMailMock.mockResolvedValue({});
      await service.sendTemplate('student@example.com', 'verification', { code: '123456', expiryHours: '24' });
      const [call] = sendMailMock.mock.calls;
      expect(call[0].subject).toBe('Verify your email — CareerCompass AI');
      expect(call[0].html).toContain('123456');
    });

    it('prefers an admin-authored template override over the built-in default', async () => {
      templateModel.findOne.mockReturnValue(execReturning({
        key: 'verification', subject: 'Custom subject for {{code}}', htmlBody: '<p>Custom body {{code}}</p>', isActive: true,
      }));
      sendMailMock.mockResolvedValue({});
      await service.sendTemplate('student@example.com', 'verification', { code: '999999', expiryHours: '24' });
      const [call] = sendMailMock.mock.calls;
      expect(call[0].subject).toBe('Custom subject for 999999');
      expect(call[0].html).toContain('Custom body 999999');
    });

    it('does nothing for an unknown template key', async () => {
      templateModel.findOne.mockReturnValue(execReturning(null));
      await service.sendTemplate('student@example.com', 'not_a_real_template', {});
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('substitutes missing variables with an empty string rather than leaving the placeholder', async () => {
      templateModel.findOne.mockReturnValue(execReturning(null));
      sendMailMock.mockResolvedValue({});
      await service.sendTemplate('student@example.com', 'welcome', { name: 'Ananya' }); // ctaUrl omitted
      const [call] = sendMailMock.mock.calls;
      expect(call[0].html).not.toContain('{{ctaUrl}}');
      expect(call[0].html).toContain('Ananya');
    });
  });
});
