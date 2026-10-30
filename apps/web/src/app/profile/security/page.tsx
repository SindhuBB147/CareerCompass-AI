'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { ApiError } from '../../../lib/api-client';
import { PasswordField } from '../../../components/auth/PasswordField';
import {
  securityApi, SecurityDashboard, TrustedDevice, LoginHistoryEntry,
} from '../../../lib/security-api';

export default function SecurityDashboardPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();

  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [dash, deviceList, historyResult] = await Promise.all([
      securityApi.dashboard(accessToken),
      securityApi.listDevices(accessToken),
      securityApi.loginHistory({ page: 1, limit: 10 }, accessToken),
    ]);
    setDashboard(dash);
    setDevices(deviceList);
    setHistory(historyResult.entries);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login/student'); return; }
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  if (authLoading || loading) {
    return <div className="profile-page container-editorial"><p className="wizard-hint">Loading your security dashboard…</p></div>;
  }

  return (
    <div className="profile-page container-editorial">
      <div className="wizard-header" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
        <span className="auth-eyebrow">Account</span>
        <h1 className="text-section-title font-serif wizard-title">Security</h1>
        <p className="wizard-subtitle">Two-factor authentication, trusted devices, login history, and account protection.</p>
      </div>

      {dashboard && <ScoreCard dashboard={dashboard} />}

      {dashboard && dashboard.suspiciousLoginAlerts.length > 0 && (
        <div className="auth-banner" data-tone="error" style={{ marginBottom: '16px' }}>
          {dashboard.suspiciousLoginAlerts.map((a, i) => <div key={i}>⚠️ {a.message}</div>)}
        </div>
      )}

      <div className="profile-stats-grid" style={{ marginBottom: '24px' }}>
        <StatTile icon="🕒" label="Last Login" value={formatDate(dashboard?.lastLoginAt)} />
        <StatTile icon="🔑" label="Last Password Change" value={formatDate(dashboard?.lastPasswordChangeAt)} />
        <StatTile icon="💻" label="Active Sessions" value={String(dashboard?.activeSessionsCount ?? 0)} />
        <StatTile icon="📱" label="Trusted Devices" value={`${dashboard?.trustedDevicesCount ?? 0}/${dashboard?.totalDevicesCount ?? 0}`} />
      </div>

      <TwoFactorCard accessToken={accessToken} dashboard={dashboard} onChanged={load} />
      <DevicesCard devices={devices} accessToken={accessToken} onChanged={load} />
      <LoginHistoryCard history={history} accessToken={accessToken} onChanged={load} />
      {dashboard && <RecentEventsCard events={dashboard.recentEvents} />}

      <div className="card-editorial profile-section-card">
        <h2 className="profile-section-title">More security settings</h2>
        <p className="wizard-hint">Change your password, manage active sessions, and connect or disconnect social sign-in.</p>
        <Link href="/profile/settings" className="btn-editorial-secondary" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>
          Open Account Settings →
        </Link>
      </div>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function ScoreCard({ dashboard }: { dashboard: SecurityDashboard }) {
  const score = dashboard.securityScore;
  const tone = score >= 80 ? 'strong' : score >= 50 ? 'good' : 'weak';
  return (
    <div className="card-editorial profile-hero" style={{ marginBottom: '24px' }}>
      <div>
        <h2 className="font-serif profile-hero-name" style={{ fontSize: '20px' }}>Security Score</h2>
        <p className="profile-hero-meta">
          {tone === 'strong' ? 'Your account is well protected.' : tone === 'good' ? 'Good — a few improvements available.' : 'Your account could use stronger protection.'}
        </p>
      </div>
      <div className="profile-completion-ring-wrap">
        <div>
          <div className="profile-completion-track">
            <div className="profile-completion-fill" style={{ width: `${score}%` }} />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {dashboard.twoFactor.isEnabled ? '2FA enabled' : 'Enable 2FA to improve your score'}
          </span>
        </div>
        <span className="profile-completion-pct">{score}</span>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="card-editorial profile-stat-card">
      <span className="profile-stat-icon">{icon}</span>
      <span className="profile-stat-value" style={{ fontSize: '15px' }}>{value}</span>
      <span className="profile-stat-label">{label}</span>
    </div>
  );
}

// ── Two-Factor Authentication ─────────────────────────────────────────────

function TwoFactorCard({ accessToken, dashboard, onChanged }: { accessToken: string | null; dashboard: SecurityDashboard | null; onChanged: () => void }) {
  const [step, setStep] = useState<'idle' | 'choose' | 'setup' | 'recovery' | 'disable'>('idle');
  const [method, setMethod] = useState<'totp' | 'email'>('totp');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [manualKey, setManualKey] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isEnabled = dashboard?.twoFactor.isEnabled ?? false;

  const startSetup = async (chosenMethod: 'totp' | 'email') => {
    setError(null); setBusy(true);
    try {
      const result = await securityApi.setupTwoFactor(chosenMethod, accessToken);
      setMethod(chosenMethod);
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setManualKey(result.manualEntryKey);
      setStep('setup');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start 2FA setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const result = await securityApi.confirmTwoFactorSetup(code, accessToken);
      setRecoveryCodes(result.recoveryCodes);
      setStep('recovery');
      setCode('');
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invalid code — check your app and try again.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await securityApi.disableTwoFactor(currentPassword, accessToken);
      setStep('idle');
      setCurrentPassword('');
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not disable 2FA — check your password.');
    } finally {
      setBusy(false);
    }
  };

  const regenerateCodes = async () => {
    const password = window.prompt('Enter your current password to generate new recovery codes:');
    if (!password) return;
    setError(null);
    try {
      const result = await securityApi.regenerateRecoveryCodes(password, accessToken);
      setRecoveryCodes(result.recoveryCodes);
      setStep('recovery');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not regenerate recovery codes.');
    }
  };

  return (
    <div className="card-editorial profile-section-card">
      <div className="profile-section-title-row">
        <h2 className="profile-section-title">Two-Factor Authentication</h2>
        <span className="badge-editorial" data-tone={isEnabled ? 'success' : undefined}>
          {isEnabled ? `✓ Enabled (${dashboard?.twoFactor.method ?? 'totp'})` : 'Not enabled'}
        </span>
      </div>
      {error && <div className="auth-banner" data-tone="error">{error}</div>}

      {step === 'idle' && isEnabled && (
        <>
          <p className="wizard-hint">
            {dashboard?.twoFactor.recoveryCodesRemaining ?? 0} recovery code(s) remaining.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn-editorial-secondary" onClick={regenerateCodes}>Regenerate Recovery Codes</button>
            <button className="btn-editorial-secondary" style={{ borderColor: '#B4232E', color: '#B4232E' }} onClick={() => setStep('disable')}>
              Disable 2FA
            </button>
          </div>
        </>
      )}

      {step === 'idle' && !isEnabled && (
        <>
          <p className="wizard-hint">Add a second step to sign-in with an authenticator app or an emailed code.</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn-editorial-primary" disabled={busy} onClick={() => startSetup('totp')}>Use Authenticator App</button>
            <button className="btn-editorial-secondary" disabled={busy} onClick={() => startSetup('email')}>Use Email Codes</button>
          </div>
        </>
      )}

      {step === 'setup' && (
        <form className="auth-form" onSubmit={confirmSetup}>
          {method === 'totp' ? (
            <>
              <p className="wizard-hint">Scan this QR code with Google Authenticator or Microsoft Authenticator, or enter the key manually.</p>
              {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="2FA QR code" style={{ width: '180px', height: '180px', alignSelf: 'flex-start' }} />}
              {manualKey && <p className="profile-chip" style={{ alignSelf: 'flex-start', fontFamily: 'monospace' }}>{manualKey}</p>}
            </>
          ) : (
            <p className="wizard-hint">We emailed you a 6-digit code — enter it below to confirm.</p>
          )}
          <div className="auth-field">
            <label className="auth-label" htmlFor="tfa-setup-code">Verification Code</label>
            <input id="tfa-setup-code" className="input-editorial" value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" required />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn-editorial-primary" disabled={busy}>{busy ? 'Verifying…' : 'Enable 2FA'}</button>
            <button type="button" className="btn-editorial-secondary" onClick={() => setStep('idle')}>Cancel</button>
          </div>
        </form>
      )}

      {step === 'recovery' && (
        <>
          <div className="auth-banner" data-tone="success">Two-factor authentication is enabled. Save these recovery codes somewhere safe — each can be used once if you lose access to your device.</div>
          <div className="profile-chip-row">
            {recoveryCodes.map(c => <span key={c} className="profile-chip" style={{ fontFamily: 'monospace' }}>{c}</span>)}
          </div>
          <button className="btn-editorial-primary" style={{ alignSelf: 'flex-start' }} onClick={() => setStep('idle')}>Done</button>
        </>
      )}

      {step === 'disable' && (
        <form className="auth-form" onSubmit={disable}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="tfa-disable-pw">Current Password</label>
            <PasswordField id="tfa-disable-pw" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn-editorial-secondary" style={{ borderColor: '#B4232E', color: '#B4232E' }} disabled={busy}>
              {busy ? 'Disabling…' : 'Confirm Disable'}
            </button>
            <button type="button" className="btn-editorial-secondary" onClick={() => setStep('idle')}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Trusted Devices ────────────────────────────────────────────────────────

function DevicesCard({ devices, accessToken, onChanged }: { devices: TrustedDevice[]; accessToken: string | null; onChanged: () => void }) {
  const handleRename = async (deviceId: string, current?: string) => {
    const name = window.prompt('Rename this device:', current ?? '');
    if (!name) return;
    await securityApi.renameDevice(deviceId, name, accessToken);
    onChanged();
  };

  const handleTrust = async (deviceId: string, isTrusted: boolean) => {
    await securityApi.trustDevice(deviceId, !isTrusted, accessToken);
    onChanged();
  };

  const handleRemove = async (deviceId: string) => {
    await securityApi.removeDevice(deviceId, accessToken);
    onChanged();
  };

  return (
    <div className="card-editorial profile-section-card">
      <h2 className="profile-section-title">Trusted Devices</h2>
      <div className="session-list">
        {devices.map(d => (
          <div key={d.deviceId} className="session-item">
            <div className="session-item-meta">
              <span className="session-item-device">{d.deviceName ?? `${d.browser ?? 'Unknown'} on ${d.os ?? 'Unknown'}`} {d.isTrusted && <span className="badge-editorial" data-tone="success">Trusted</span>}</span>
              <span className="session-item-detail">IP {d.ip ?? 'unknown'} · First seen {new Date(d.firstSeenAt).toLocaleDateString()} · Last active {new Date(d.lastSeenAt).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-editorial-secondary session-revoke-btn" onClick={() => handleRename(d.deviceId, d.deviceName)}>Rename</button>
              <button className="btn-editorial-secondary session-revoke-btn" onClick={() => handleTrust(d.deviceId, d.isTrusted)}>{d.isTrusted ? 'Untrust' : 'Trust'}</button>
              <button className="btn-editorial-secondary session-revoke-btn" onClick={() => handleRemove(d.deviceId)}>Remove</button>
            </div>
          </div>
        ))}
        {devices.length === 0 && <p className="profile-empty-inline">No devices recorded yet.</p>}
      </div>
    </div>
  );
}

// ── Login History ───────────────────────────────────────────────────────────

function LoginHistoryCard({ history, accessToken, onChanged }: { history: LoginHistoryEntry[]; accessToken: string | null; onChanged: () => void }) {
  const handleReport = async (id: string) => {
    await securityApi.reportUnknownLogin(id, accessToken);
    onChanged();
  };

  return (
    <div className="card-editorial profile-section-card">
      <h2 className="profile-section-title">Recent Login History</h2>
      <div className="session-list">
        {history.map(h => (
          <div key={h.id} className="session-item">
            <div className="session-item-meta">
              <span className="session-item-device">
                {h.deviceName ?? `${h.browser ?? 'Unknown'} on ${h.os ?? 'Unknown'}`}
                {' '}
                <span className="badge-editorial" data-tone={h.status === 'success' ? 'success' : 'error'}>{h.status}</span>
                {h.reportedAsUnknown && <span className="badge-editorial" data-tone="error">Reported</span>}
              </span>
              <span className="session-item-detail">
                {h.loginMethod} · IP {h.ip ?? 'unknown'} · {new Date(h.timestamp).toLocaleString()}
                {h.failureReason ? ` · ${h.failureReason}` : ''}
              </span>
            </div>
            {h.status === 'success' && !h.reportedAsUnknown && (
              <button className="btn-editorial-secondary session-revoke-btn" onClick={() => handleReport(h.id)}>This wasn&apos;t me</button>
            )}
          </div>
        ))}
        {history.length === 0 && <p className="profile-empty-inline">No login history yet.</p>}
      </div>
    </div>
  );
}

// ── Recent Security Events ──────────────────────────────────────────────────

function RecentEventsCard({ events }: { events: SecurityDashboard['recentEvents'] }) {
  return (
    <div className="card-editorial profile-section-card">
      <h2 className="profile-section-title">Recent Security Events</h2>
      <div className="session-list">
        {events.map((e, i) => (
          <div key={i} className="session-item">
            <div className="session-item-meta">
              <span className="session-item-device">{e.action.replace(/_/g, ' ')} <span className="badge-editorial" data-tone={e.result === 'success' ? 'success' : 'error'}>{e.result}</span></span>
              <span className="session-item-detail">{new Date(e.timestamp).toLocaleString()} {e.ip ? `· IP ${e.ip}` : ''}</span>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="profile-empty-inline">No security events recorded yet.</p>}
      </div>
    </div>
  );
}
