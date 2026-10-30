const PHONE_RE = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const GOVT_ID_RE = /(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)/g; // Aadhaar-shaped

/** Masks phone/email/govt-ID-shaped substrings before persisting logs. Never applied to the live prompt — personalization needs the real profile. */
export const maskPii = (text: string): string =>
  text.replace(EMAIL_RE, '[EMAIL]').replace(PHONE_RE, '[PHONE]').replace(GOVT_ID_RE, '[ID]');
