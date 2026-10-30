'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { apiClient, ApiError } from '../../../lib/api-client';
import { PasswordField } from '../../../components/auth/PasswordField';
import { PasswordStrengthMeter } from '../../../components/auth/PasswordStrengthMeter';
import { OAUTH_PROVIDER_META } from '../../../components/auth/OAuthIcons';
import type { OAuthProvider } from '../../../contexts/UserAuthContext';
import { notificationsApi, NotificationPreference } from '../../../lib/notifications-api';

const SETTINGS_SECTIONS = [
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'password', label: 'Password', icon: '🔒' },
  { key: 'connected', label: 'Connected Accounts', icon: '🔗' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'security', label: 'Security & Sessions', icon: '🛡️' },
  { key: 'privacy', label: 'Privacy & Data', icon: '📄' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, isLoading: authLoading, logoutUser } = useUserAuth();

  const [section, setSection] = useState('profile');
  const [profile, setProfile] = useState<any>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [profileData, linked, sessionData] = await Promise.all([
      apiClient.get<any>('/users/me', accessToken),
      apiClient.get<any[]>('/users/me/linked-accounts', accessToken),
      apiClient.get<any[]>('/auth/student/sessions', accessToken),
    ]);
    setProfile(profileData);
    setLinkedAccounts(linked);
    setSessions(sessionData);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login/student'); return; }
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  if (authLoading || loading) {
    return <div className="profile-page container-editorial"><p className="wizard-hint">Loading settings…</p></div>;
  }

  return (
    <div className="profile-page container-editorial">
      <div className="wizard-header" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
        <span className="auth-eyebrow">Account</span>
        <h1 className="text-section-title font-serif wizard-title">Settings</h1>
        <p className="wizard-subtitle">Manage your sign-in methods, security, notifications, and data.</p>
      </div>

      <div className="profile-body-layout">
        <nav className="profile-nav" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map(s => (
            <button key={s.key} className="profile-nav-item" data-active={section === s.key} onClick={() => setSection(s.key)}>
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
          <Link href="/profile" className="profile-nav-item" style={{ marginTop: '8px' }}>← Back to Profile</Link>
        </nav>

        <div className="profile-section">
          {section === 'profile' && <ProfileSettingsSection profile={profile} accessToken={accessToken} onSaved={load} />}
          {section === 'password' && <PasswordSection accessToken={accessToken} hasPassword={!!profile?.passwordHash} onChanged={logoutUser} />}
          {section === 'connected' && <ConnectedAccountsSection linkedAccounts={linkedAccounts} accessToken={accessToken} hasPassword={!!profile?.passwordHash} onChanged={load} />}
          {section === 'notifications' && (
            <>
              <NotificationsSection profile={profile} accessToken={accessToken} onSaved={load} />
              <NotificationPreferencesSection accessToken={accessToken} />
            </>
          )}
          {section === 'security' && <SecuritySection sessions={sessions} accessToken={accessToken} onChanged={load} logoutUser={logoutUser} />}
          {section === 'privacy' && <PrivacySection accessToken={accessToken} logoutUser={logoutUser} />}
        </div>
      </div>
    </div>
  );
}

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-editorial profile-section-card">
      <h2 className="profile-section-title">{title}</h2>
      {children}
    </div>
  );
}

function ProfileSettingsSection({ profile, accessToken, onSaved }: { profile: any; accessToken: string | null; onSaved: () => void }) {
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [domicileState, setDomicileState] = useState(profile?.domicileState ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferredLanguage ?? 'English');
  const [preferredTheme, setPreferredTheme] = useState(profile?.preferredTheme ?? 'light');
  const [currentCollege, setCurrentCollege] = useState(profile?.academic?.currentCollege ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient.patch('/users/me', { fullName, domicileState, preferredLanguage, preferredTheme, currentCollege }, accessToken);
      setMessage('Profile updated.');
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell title="Profile">
      {error && <div className="auth-banner" data-tone="error">{error}</div>}
      {message && <div className="auth-banner" data-tone="success">{message}</div>}
      <form className="auth-form" onSubmit={handleSave}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="settings-name">Full Name</label>
          <input id="settings-name" className="input-editorial" value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="settings-state">State</label>
          <input id="settings-state" className="input-editorial" value={domicileState} onChange={e => setDomicileState(e.target.value)} />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="settings-college">Current College</label>
          <input id="settings-college" className="input-editorial" value={currentCollege} onChange={e => setCurrentCollege(e.target.value)} placeholder="e.g. RVCE" />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="settings-language">Preferred Language</label>
          <select id="settings-language" className="input-editorial" value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value)}>
            <option value="English">English</option>
            <option value="Kannada">Kannada</option>
            <option value="Hindi">Hindi</option>
          </select>
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="settings-theme">Preferred Theme</label>
          <select id="settings-theme" className="input-editorial" value={preferredTheme} onChange={e => setPreferredTheme(e.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">Match System</option>
          </select>
          <span className="wizard-hint">Saved for when dark mode ships on the student site — it doesn&apos;t change the look today.</span>
        </div>
        <button type="submit" className="btn-editorial-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
      <p className="wizard-hint">For photo, phone, academic details and more, use the <Link href="/onboarding" className="auth-link">full profile editor</Link>.</p>
    </SectionShell>
  );
}

function PasswordSection({ accessToken, hasPassword, onChanged }: { accessToken: string | null; hasPassword: boolean; onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!hasPassword) {
    return (
      <SectionShell title="Password">
        <p className="profile-empty-inline">You signed up with a social account and haven't set a password yet.</p>
        <Link href="/forgot-password" className="btn-editorial-secondary" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>Set a Password</Link>
      </SectionShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await apiClient.post('/auth/student/password/change', { currentPassword, newPassword }, accessToken);
      setSuccess(true);
      setTimeout(() => onChanged(), 1500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell title="Password">
      {error && <div className="auth-banner" data-tone="error">{error}</div>}
      {success && <div className="auth-banner" data-tone="success">Password changed. You'll be signed out of all devices for security.</div>}
      {!success && (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="current-pw">Current Password</label>
            <PasswordField id="current-pw" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="new-pw">New Password</label>
            <PasswordField id="new-pw" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            <PasswordStrengthMeter password={newPassword} />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm-pw">Confirm New Password</label>
            <PasswordField id="confirm-pw" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-editorial-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }} disabled={saving}>
            {saving ? 'Updating…' : 'Change Password'}
          </button>
        </form>
      )}
    </SectionShell>
  );
}

function ConnectedAccountsSection({ linkedAccounts, accessToken, hasPassword, onChanged }: { linkedAccounts: any[]; accessToken: string | null; hasPassword: boolean; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const linkedProviders = new Set(linkedAccounts.map(a => a.provider));
  const allProviders: OAuthProvider[] = ['google', 'microsoft', 'github', 'apple', 'linkedin'];

  const handleLink = async (provider: OAuthProvider) => {
    setError(null);
    try {
      await apiClient.post('/users/me/linked-accounts', {
        provider, idTokenTokenOrCode: `mock_${provider}_${Math.random().toString(36).slice(2)}`,
      }, accessToken);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not link account.');
    }
  };

  const handleUnlink = async (provider: OAuthProvider) => {
    if (!hasPassword && linkedAccounts.length <= 1) {
      setError('Set a password before unlinking your only sign-in method.');
      return;
    }
    setError(null);
    try {
      await apiClient.del(`/users/me/linked-accounts/${provider}`, accessToken);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not unlink account.');
    }
  };

  return (
    <SectionShell title="Connected Accounts">
      {error && <div className="auth-banner" data-tone="error">{error}</div>}
      {allProviders.map(provider => {
        const meta = OAUTH_PROVIDER_META[provider];
        const Icon = meta.icon;
        const linked = linkedProviders.has(provider);
        return (
          <div key={provider} className="linked-account-row">
            <span className="linked-account-identity"><Icon /> {meta.label}</span>
            {linked ? (
              <button className="btn-editorial-secondary session-revoke-btn" onClick={() => handleUnlink(provider)}>Disconnect</button>
            ) : (
              <button className="btn-editorial-primary session-revoke-btn" onClick={() => handleLink(provider)}>Connect</button>
            )}
          </div>
        );
      })}
    </SectionShell>
  );
}

function NotificationsSection({ profile, accessToken, onSaved }: { profile: any; accessToken: string | null; onSaved: () => void }) {
  const [channels, setChannels] = useState(profile?.notificationChannels ?? { sms: true, email: false, whatsapp: false, push: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (key: string) => {
    const next = { ...channels, [key]: !channels[key] };
    setChannels(next);
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch('/users/me/notification-preferences', { [key]: next[key] }, accessToken);
      onSaved();
    } catch (e) {
      setChannels(channels);
      setError(e instanceof ApiError ? e.message : 'At least one notification channel must remain enabled.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell title="Notification Preferences">
      {error && <div className="auth-banner" data-tone="error">{error}</div>}
      {(['sms', 'email', 'whatsapp', 'push'] as const).map(key => (
        <label key={key} className="auth-checkbox-row">
          <input type="checkbox" checked={!!channels[key]} onChange={() => toggle(key)} disabled={saving} />
          {key === 'sms' ? 'SMS alerts' : key === 'email' ? 'Email alerts' : key === 'whatsapp' ? 'WhatsApp alerts' : 'Push notifications'}
        </label>
      ))}
    </SectionShell>
  );
}

const CHANNEL_LABELS: Record<string, string> = {
  inApp: 'In-app', email: 'Email', browser: 'Browser (desktop alerts)', sms: 'SMS', whatsapp: 'WhatsApp', push: 'Push (mobile — coming soon)',
};
const CATEGORY_LABELS: Record<string, string> = {
  admissions: 'Admissions (KCET/COMEDK/NEET)', scholarships: 'Scholarships', roadmap: 'Career Roadmap', financial: 'Financial',
  ai_suggestions: 'AI Suggestions', account: 'Account & Security', system: 'System', announcements: 'Announcements',
};

function NotificationPreferencesSection({ accessToken }: { accessToken: string | null }) {
  const [pref, setPref] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<string>('default');

  useEffect(() => {
    notificationsApi.getPreferences(accessToken).then(setPref).catch(() => null).finally(() => setLoading(false));
    if (typeof window !== 'undefined' && 'Notification' in window) setBrowserPermission(window.Notification.permission);
  }, [accessToken]);

  const save = async (patch: {
    channels?: Partial<NotificationPreference['channels']>;
    categories?: Partial<NotificationPreference['categories']>;
    weeklySummary?: boolean;
    marketingEmails?: boolean;
  }) => {
    setSaving(true);
    try {
      const updated = await notificationsApi.updatePreferences(patch, accessToken);
      setPref(updated);
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = async (key: keyof NotificationPreference['channels']) => {
    if (!pref) return;
    const nextValue = !pref.channels[key];
    if (key === 'browser' && nextValue && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'default') {
      const result = await window.Notification.requestPermission();
      setBrowserPermission(result);
      if (result !== 'granted') return; // don't enable the preference if the browser denied the prompt
    }
    setPref({ ...pref, channels: { ...pref.channels, [key]: nextValue } });
    await save({ channels: { [key]: nextValue } as Partial<NotificationPreference['channels']> });
  };

  const toggleCategory = async (key: keyof NotificationPreference['categories']) => {
    if (!pref) return;
    const nextValue = !pref.categories[key];
    setPref({ ...pref, categories: { ...pref.categories, [key]: nextValue } });
    await save({ categories: { [key]: nextValue } as Partial<NotificationPreference['categories']> });
  };

  const toggleFlag = async (key: 'weeklySummary' | 'marketingEmails') => {
    if (!pref) return;
    const nextValue = !pref[key];
    setPref({ ...pref, [key]: nextValue });
    await save({ [key]: nextValue } as Partial<NotificationPreference>);
  };

  if (loading) return <SectionShell title="Advanced Notification Settings"><p className="wizard-hint">Loading…</p></SectionShell>;
  if (!pref) return null;

  return (
    <SectionShell title="Advanced Notification Settings">
      <p className="wizard-hint" style={{ marginBottom: '8px' }}>
        Controls the new Notification Center — separate from the legacy alert toggle above, which still governs SMS/WhatsApp fallback delivery.
      </p>

      <h3 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '12px 0 0' }}>Delivery channels</h3>
      {(Object.keys(CHANNEL_LABELS) as Array<keyof NotificationPreference['channels']>).map(key => (
        <div key={key} className="notif-pref-row-toggle">
          <span>
            {CHANNEL_LABELS[key]}
            {key === 'browser' && browserPermission === 'denied' && (
              <span style={{ display: 'block', fontSize: '12px', color: '#B23A3A' }}>Browser notifications are blocked — enable them in your browser's site settings.</span>
            )}
          </span>
          <input type="checkbox" checked={!!pref.channels[key]} disabled={saving || key === 'push'} onChange={() => toggleChannel(key)} />
        </div>
      ))}

      <h3 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '20px 0 0' }}>Categories</h3>
      {(Object.keys(CATEGORY_LABELS) as Array<keyof NotificationPreference['categories']>).map(key => (
        <div key={key} className="notif-pref-row-toggle">
          <span>{CATEGORY_LABELS[key]}</span>
          <input type="checkbox" checked={!!pref.categories[key]} disabled={saving} onChange={() => toggleCategory(key)} />
        </div>
      ))}

      <h3 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '20px 0 0' }}>Digests</h3>
      <div className="notif-pref-row-toggle">
        <span>Weekly progress summary email</span>
        <input type="checkbox" checked={pref.weeklySummary} disabled={saving} onChange={() => toggleFlag('weeklySummary')} />
      </div>
      <div className="notif-pref-row-toggle">
        <span>Marketing emails</span>
        <input type="checkbox" checked={pref.marketingEmails} disabled={saving} onChange={() => toggleFlag('marketingEmails')} />
      </div>
    </SectionShell>
  );
}

function SecuritySection({ sessions, accessToken, onChanged, logoutUser }: { sessions: any[]; accessToken: string | null; onChanged: () => void; logoutUser: () => Promise<void> }) {
  const handleRevoke = async (sessionId: string) => {
    await apiClient.del(`/auth/student/sessions/${sessionId}`, accessToken);
    onChanged();
  };

  const handleLogoutAll = async () => {
    await apiClient.post('/auth/student/logout-all', {}, accessToken);
    await logoutUser();
  };

  return (
    <SectionShell title="Security & Sessions">
      <p className="wizard-hint">
        For two-factor authentication, trusted devices, and login history, visit your <Link href="/profile/security" className="auth-link">Security Dashboard</Link>.
      </p>
      <p className="wizard-hint">These are the devices currently signed in to your account.</p>
      <div className="session-list">
        {sessions.map(s => (
          <div key={s.sessionId} className="session-item">
            <div className="session-item-meta">
              <span className="session-item-device">{describeUserAgent(s.userAgent)}</span>
              <span className="session-item-detail">IP {s.ip ?? 'unknown'} · Last active {new Date(s.lastUsedAt).toLocaleString()}</span>
            </div>
            <button className="btn-editorial-secondary session-revoke-btn" onClick={() => handleRevoke(s.sessionId)}>Sign Out</button>
          </div>
        ))}
        {sessions.length === 0 && <p className="profile-empty-inline">No active sessions found.</p>}
      </div>
      <button className="btn-editorial-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }} onClick={handleLogoutAll}>
        Log Out of All Devices
      </button>
    </SectionShell>
  );
}

function describeUserAgent(ua?: string): string {
  if (!ua) return 'Unknown device';
  if (/mobile/i.test(ua)) return 'Mobile browser';
  if (/chrome/i.test(ua)) return 'Chrome browser';
  if (/safari/i.test(ua)) return 'Safari browser';
  if (/firefox/i.test(ua)) return 'Firefox browser';
  return 'Web browser';
}

function PrivacySection({ accessToken, logoutUser }: { accessToken: string | null; logoutUser: () => Promise<void> }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    setError(null);
    try {
      // apiClient.del doesn't support a request body — the delete route
      // requires a {confirm: 'DELETE'} body, so this uses fetch directly.
      const res = await fetch('/api/v1/users/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (!res.ok) throw new Error('failed');
      await logoutUser();
      router.push('/');
    } catch {
      setError('Could not delete your account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <SectionShell title="Privacy & Data">
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
          CareerCompass AI uses your academic and preference data only to power predictions, recommendations, and the AI Counsellor for your account. You can export or delete your data at any time.
        </p>
        <Link href="/profile/memory-privacy" className="btn-editorial-secondary" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>
          Open Memory & Privacy dashboard →
        </Link>
      </SectionShell>

      <div className="card-editorial profile-section-card settings-danger-zone">
        <h3 className="settings-danger-title">Delete Account</h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          This permanently deactivates your account and removes your email, phone, and sign-in methods. This cannot be undone.
        </p>
        {error && <div className="auth-banner" data-tone="error">{error}</div>}
        <div className="auth-field" style={{ maxWidth: '320px' }}>
          <label className="auth-label" htmlFor="confirm-delete">Type DELETE to confirm</label>
          <input id="confirm-delete" className="input-editorial" value={confirmText} onChange={e => setConfirmText(e.target.value)} />
        </div>
        <button
          className="btn-editorial-secondary" style={{ alignSelf: 'flex-start', borderColor: '#B4232E', color: '#B4232E' }}
          disabled={confirmText !== 'DELETE' || deleting} onClick={handleDelete}
        >
          {deleting ? 'Deleting…' : 'Permanently Delete My Account'}
        </button>
      </div>
    </>
  );
}
