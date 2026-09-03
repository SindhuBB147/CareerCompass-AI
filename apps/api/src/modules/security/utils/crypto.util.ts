import * as crypto from 'crypto';

/**
 * AES-256-GCM encrypt/decrypt for data that must be recovered in plaintext
 * server-side (TOTP secrets) — unlike passwords/OTPs, which only ever need
 * a one-way hash comparison, verifying a TOTP code requires the raw secret.
 * Key is read fresh per call (not cached at module load) so tests can swap
 * ConfigService values without reimporting.
 */
const ALGO = 'aes-256-gcm';

function resolveKey(rawKey: string | undefined): Buffer {
  // Accepts a 64-char hex string (32 bytes). Falls back to a fixed
  // dev-only key so local development doesn't hard-fail without a .env —
  // mirrors the "default-*-secret-key-change-in-production" pattern
  // already used for JWT secrets in token.service.ts.
  const hex = rawKey && rawKey.length === 64 ? rawKey : '0'.repeat(63) + '1';
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string, rawKey: string | undefined): string {
  const key = resolveKey(rawKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSecret(payload: string, rawKey: string | undefined): string {
  const key = resolveKey(rawKey);
  const [ivHex, tagHex, dataHex] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Device fingerprint — stable hash of user-agent + the /24 IP prefix (not
 * the full IP, so a student's normal DHCP-lease churn on the same network
 * doesn't manufacture a "new device" every day). */
export function fingerprintDevice(userAgent: string | undefined, ip: string | undefined): string {
  const ipFamily = (ip ?? '').split('.').slice(0, 3).join('.');
  return crypto.createHash('sha256').update(`${userAgent ?? 'unknown'}::${ipFamily}`).digest('hex').slice(0, 32);
}

export function parseUserAgent(userAgent: string | undefined): { browser: string; os: string } {
  const ua = userAgent ?? '';
  let browser = 'Unknown Browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';

  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return { browser, os };
}

export function deviceNameFrom(browser: string, os: string): string {
  return `${browser} on ${os}`;
}
