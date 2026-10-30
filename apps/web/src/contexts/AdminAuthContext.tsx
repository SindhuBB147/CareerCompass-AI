'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type AdminRole =
  | 'super_admin' | 'data_manager' | 'support_agent' | 'b2b_account_manager'
  | 'counsellor' | 'moderator' | 'data_entry_operator' | 'content_manager' | 'ai_manager';

export interface AdminProfile {
  id: string;
  email: string;
  role: AdminRole;
  fullName: string;
  lastLogin: string;
}

export interface AdminPendingTwoFactor { pendingToken: string; method: 'totp' | 'email'; }

interface AdminAuthContextType {
  admin: AdminProfile | null;
  adminToken: string | null;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  pendingTwoFactor: AdminPendingTwoFactor | null;
  loginAdmin: (email: string, password: string) => Promise<boolean>;
  verifyAdminTwoFactor: (code: string, trustThisDevice?: boolean) => Promise<boolean>;
  cancelAdminTwoFactor: () => void;
  logoutAdmin: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const REFRESH_KEY = 'cc_admin_refresh_token';

// Access tokens are short-lived (15 min) and, until now, nothing ever used
// the refresh token that was already being stored — every admin action
// (edit, archive, add course/cutoff/image, …) would start failing with
// "Unauthorized" ~15 minutes into a session with no way to recover short of
// a manual re-login. Decoding `exp` client-side (no signature check needed,
// this is only used to time a refresh, not to trust the token) lets us
// schedule the refresh precisely instead of guessing.
function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingTwoFactor, setPendingTwoFactor] = useState<AdminPendingTwoFactor | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string>('');

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('cc_admin_access_token');
      const storedAdmin = localStorage.getItem('cc_admin_profile');
      if (storedToken && storedAdmin) {
        setAdminToken(storedToken);
        setAdmin(JSON.parse(storedAdmin));
      }
    } catch {
      // Ignore parse error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistSession = (data: { accessToken: string; refreshToken?: string; role: AdminRole }, email: string) => {
    const adminProfile: AdminProfile = {
      id: 'admin_' + Date.now(),
      email,
      role: data.role,
      fullName: email.split('@')[0].toUpperCase() + ' (Admin)',
      lastLogin: new Date().toISOString(),
    };
    setAdminToken(data.accessToken);
    setAdmin(adminProfile);
    localStorage.setItem('cc_admin_access_token', data.accessToken);
    localStorage.setItem('cc_admin_profile', JSON.stringify(adminProfile));
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    // Cookies read by the Next middleware route guard — mirror localStorage, not authoritative on their own.
    document.cookie = `cc_admin_session=${data.accessToken}; path=/admin; max-age=43200; SameSite=Lax`;
    document.cookie = `cc_admin_role=${data.role}; path=/admin; max-age=43200; SameSite=Lax`;
  };

  // Authoritative: the admin's role and identity come ONLY from what the
  // backend actually authenticates via POST /auth/login + RolesGuard — this
  // never falls back to a fabricated token or a caller-supplied role.
  const loginAdmin = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setLoginError(data?.error?.message || 'Invalid email or password.');
        return false;
      }

      if (data.data.requires2FA && data.data.pendingToken) {
        setPendingTwoFactor({ pendingToken: data.data.pendingToken, method: data.data.method ?? 'totp' });
        setPendingEmail(email);
        return false;
      }

      if (!data.data.accessToken || !data.data.role) {
        setLoginError('Unexpected response from server.');
        return false;
      }

      persistSession(data.data, email);
      return true;
    } catch {
      setLoginError('Could not reach the server. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAdminTwoFactor = async (code: string, trustThisDevice = false): Promise<boolean> => {
    if (!pendingTwoFactor) return false;
    setIsLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/v1/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken: pendingTwoFactor.pendingToken, code, trustThisDevice }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.data?.accessToken) {
        setLoginError(data?.error?.message || 'Invalid or expired code.');
        return false;
      }
      persistSession(data.data, pendingEmail || 'admin');
      setPendingTwoFactor(null);
      return true;
    } catch {
      setLoginError('Could not reach the server. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelAdminTwoFactor = () => { setPendingTwoFactor(null); setLoginError(null); };

  const logoutAdmin = () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (adminToken) {
      fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
    }
    setAdmin(null);
    setAdminToken(null);
    localStorage.removeItem('cc_admin_access_token');
    localStorage.removeItem('cc_admin_profile');
    localStorage.removeItem(REFRESH_KEY);
    document.cookie = 'cc_admin_session=; path=/admin; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'cc_admin_role=; path=/admin; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  };

  // Silently renews the access token ~60s before it expires, using the
  // refresh token that persistSession already stores. Runs for the whole
  // life of the session — every renewal reschedules itself for the next
  // one — so an admin actively working never hits a stale-token 401 just
  // because they've been on a page for more than 15 minutes.
  useEffect(() => {
    if (!adminToken) return;
    const expiryMs = getTokenExpiryMs(adminToken);
    if (!expiryMs) return;

    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return;

    const delay = Math.max(expiryMs - Date.now() - 60_000, 5_000);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success || !data?.data?.accessToken) {
          logoutAdmin();
          return;
        }
        const { accessToken, refreshToken: newRefreshToken } = data.data;
        setAdminToken(accessToken);
        localStorage.setItem('cc_admin_access_token', accessToken);
        if (newRefreshToken) localStorage.setItem(REFRESH_KEY, newRefreshToken);
        if (admin) document.cookie = `cc_admin_session=${accessToken}; path=/admin; max-age=43200; SameSite=Lax`;
      } catch {
        // Network hiccup — leave the current token in place; the next
        // API call will surface a real error if it's actually expired.
      }
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        adminToken,
        isAdminAuthenticated: !!admin,
        isLoading,
        loginError,
        pendingTwoFactor,
        loginAdmin,
        verifyAdminTwoFactor,
        cancelAdminTwoFactor,
        logoutAdmin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
