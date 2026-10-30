'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const {
    admin, isAdminAuthenticated, loginAdmin, logoutAdmin, isLoading, loginError,
    pendingTwoFactor, verifyAdminTwoFactor, cancelAdminTwoFactor,
  } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [trustThisDevice, setTrustThisDevice] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await loginAdmin(email, password);
    if (ok) router.push('/admin');
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyAdminTwoFactor(twoFactorCode, trustThisDevice);
    if (ok) router.push('/admin');
  };

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', maxWidth: '540px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
          Governance Access
        </span>
        <h1 className="text-section-title font-serif">Admin Portal Login</h1>
        <p className="text-body" style={{ fontSize: '16px' }}>
          RBAC-protected portal for Data Managers, Support Agents, B2B Account Managers, and Super Admins.
        </p>
      </div>

      {isAdminAuthenticated && admin ? (
        <div className="card-editorial" style={{ width: '100%', padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge-editorial">🛡️ Authenticated Admin Session</span>
            <button onClick={logoutAdmin} className="btn-editorial-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>
              Sign Out
            </button>
          </div>

          <div>
            <h2 className="font-serif" style={{ fontSize: '24px', margin: 0 }}>{admin.email}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>
              Last Verified: {new Date(admin.lastLogin).toLocaleTimeString()}
            </p>
          </div>

          <div style={{ backgroundColor: 'var(--bg-main)', padding: '20px', borderRadius: '16px', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Assigned RBAC Role:</span>
              <strong style={{ color: 'var(--accent-blue)' }}>{admin.role.toUpperCase()}</strong>
            </div>
          </div>

          <button onClick={() => router.push('/admin')} className="btn-editorial-primary" style={{ width: '100%', padding: '14px' }}>
            Enter Admin Portal →
          </button>
        </div>
      ) : pendingTwoFactor ? (
        <form onSubmit={handleVerifyTwoFactor} className="card-editorial" style={{ width: '100%', padding: '36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <span className="auth-eyebrow">Two-Factor Verification</span>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            {pendingTwoFactor.method === 'email'
              ? 'Enter the 6-digit code we just emailed you.'
              : 'Enter the 6-digit code from your authenticator app, or a recovery code.'}
          </p>
          {loginError && <div className="admin-inline-message" data-tone="error">{loginError}</div>}
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: 'var(--text-primary)', fontWeight: 500 }}>Verification Code</label>
            <input
              type="text" autoFocus placeholder="123456" value={twoFactorCode}
              onChange={e => setTwoFactorCode(e.target.value)} required className="input-editorial"
            />
          </div>
          <label className="auth-checkbox-row">
            <input type="checkbox" checked={trustThisDevice} onChange={e => setTrustThisDevice(e.target.checked)} />
            Remember this device for 30 days
          </label>
          <button type="submit" disabled={isLoading} className="btn-editorial-primary" style={{ width: '100%' }}>
            {isLoading ? 'Verifying…' : 'Verify & Sign In'}
          </button>
          <button type="button" className="btn-editorial-secondary" onClick={cancelAdminTwoFactor}>← Back to sign in</button>
        </form>
      ) : (
        <form onSubmit={handleAdminLogin} className="card-editorial" style={{ width: '100%', padding: '36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: 'var(--text-primary)', fontWeight: 500 }}>Admin Email Address</label>
            <input
              type="email"
              placeholder="admin@careercompass.ai"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="input-editorial"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: 'var(--text-primary)', fontWeight: 500 }}>Account Password</label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="input-editorial"
            />
          </div>

          {loginError && (
            <div className="admin-inline-message" data-tone="error">{loginError}</div>
          )}

          <button type="submit" disabled={isLoading} className="btn-editorial-primary" style={{ width: '100%', marginTop: '8px' }}>
            {isLoading ? 'Signing in…' : 'Authenticate & Sign In'}
          </button>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            Looking for Student Login? <Link href="/login/student" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>Login as Student</Link>
          </p>
        </form>
      )}
    </div>
  );
}
