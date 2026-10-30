import { encryptSecret, decryptSecret, fingerprintDevice, parseUserAgent } from '../../src/modules/security/utils/crypto.util';

describe('security crypto.util', () => {
  const KEY = 'a'.repeat(64);

  it('round-trips a secret through encrypt/decrypt', () => {
    const encrypted = encryptSecret('my-totp-secret', KEY);
    expect(encrypted).not.toContain('my-totp-secret');
    expect(decryptSecret(encrypted, KEY)).toBe('my-totp-secret');
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const a = encryptSecret('same-secret', KEY);
    const b = encryptSecret('same-secret', KEY);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, KEY)).toBe(decryptSecret(b, KEY));
  });

  describe('fingerprintDevice', () => {
    it('is stable for the same user-agent and /24 IP prefix', () => {
      const a = fingerprintDevice('Mozilla/5.0 Chrome', '192.168.1.10');
      const b = fingerprintDevice('Mozilla/5.0 Chrome', '192.168.1.55');
      expect(a).toBe(b);
    });

    it('differs across a different /24 subnet or user-agent', () => {
      const base = fingerprintDevice('Mozilla/5.0 Chrome', '192.168.1.10');
      expect(fingerprintDevice('Mozilla/5.0 Chrome', '192.168.2.10')).not.toBe(base);
      expect(fingerprintDevice('Mozilla/5.0 Firefox', '192.168.1.10')).not.toBe(base);
    });
  });

  describe('parseUserAgent', () => {
    it('identifies Chrome on Windows', () => {
      const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36');
      expect(result.browser).toBe('Chrome');
      expect(result.os).toBe('Windows');
    });

    it('falls back to Unknown for an empty user-agent', () => {
      const result = parseUserAgent(undefined);
      expect(result.browser).toBe('Unknown Browser');
      expect(result.os).toBe('Unknown OS');
    });
  });
});
