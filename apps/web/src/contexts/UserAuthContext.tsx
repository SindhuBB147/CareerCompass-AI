'use client';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type OAuthProvider = 'google' | 'microsoft' | 'github' | 'apple' | 'linkedin';
export type AuthProvider = OAuthProvider | 'otp' | 'password';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  provider: AuthProvider;
  role: 'student';
  isEmailVerified: boolean;
  onboardingCompleted: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PendingTwoFactor { pendingToken: string; method: 'totp' | 'email'; }

interface UserAuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  pendingTwoFactor: PendingTwoFactor | null;
  register: (input: { fullName: string; email: string; password: string; confirmPassword: string; acceptTerms: boolean; newsletterOptIn?: boolean }) => Promise<UserProfile | null>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<UserProfile | null>;
  loginWithOAuth: (provider: OAuthProvider, mockProfile?: { name?: string; email?: string; avatarUrl?: string; providerId?: string }) => Promise<UserProfile | null>;
  verifyTwoFactor: (code: string, trustThisDevice?: boolean) => Promise<UserProfile | null>;
  cancelTwoFactor: () => void;
  logoutUser: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message?: string }>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ ok: boolean; message?: string }>;
  refreshUser: () => Promise<void>;
  updateUserLocal: (patch: Partial<UserProfile>) => void;
  clearLoginError: () => void;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

const ACCESS_KEY = 'cc_user_access_token';
const REFRESH_KEY = 'cc_user_refresh_token';
const PROFILE_KEY = 'cc_user_profile';
const REMEMBER_KEY = 'cc_user_remember';

function readStorage(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function writeStorage(key: string, value: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  }
}

function clearStorage() {
  [ACCESS_KEY, REFRESH_KEY, PROFILE_KEY, REMEMBER_KEY].forEach(k => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}

// Note: `{ ok: boolean; data?: T }` rather than a `{ok:true}|{ok:false}`
// discriminated union — under this project's tsconfig (strict: false,
// i.e. strictNullChecks off), TS fails to narrow unions discriminated by a
// boolean literal property (confirmed repro; string-literal discriminants
// are unaffected). Optional-property narrowing (`!result.data`) works fine
// under this config, so that's what every call site below uses instead.
async function apiPost<T>(path: string, body: unknown, token?: string | null): Promise<{ ok: boolean; data?: T; message?: string }> {
  try {
    const res = await fetch(`/api/v1${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { ok: false, message: data?.error?.message || 'Something went wrong. Please try again.' };
    }
    return { ok: true, data: data.data as T };
  } catch {
    return { ok: false, message: 'Could not reach the server. Please check your connection.' };
  }
}

export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingTwoFactor, setPendingTwoFactor] = useState<PendingTwoFactor | null>(null);
  const remember = useRef(true);

  const persistSession = (tokens: AuthTokens, profile: UserProfile, rememberMe: boolean) => {
    remember.current = rememberMe;
    setAccessToken(tokens.accessToken);
    setUser(profile);
    writeStorage(ACCESS_KEY, tokens.accessToken, rememberMe);
    writeStorage(REFRESH_KEY, tokens.refreshToken, rememberMe);
    writeStorage(PROFILE_KEY, JSON.stringify(profile), rememberMe);
    writeStorage(REMEMBER_KEY, String(rememberMe), rememberMe);
    document.cookie = `cc_user_session=active; path=/; max-age=${rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24}; SameSite=Lax`;
  };

  const clearSession = () => {
    setUser(null);
    setAccessToken(null);
    clearStorage();
    document.cookie = 'cc_user_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  };

  // Bootstraps from storage on load, silently refreshing the access token
  // from the persisted refresh token — an expired access token shouldn't
  // force a fresh login every time the tab is reopened.
  useEffect(() => {
    (async () => {
      try {
        const storedRefresh = readStorage(REFRESH_KEY);
        const storedProfile = readStorage(PROFILE_KEY);
        const rememberMe = readStorage(REMEMBER_KEY) !== 'false';
        if (storedRefresh && storedProfile) {
          const result = await apiPost<{ accessToken: string; refreshToken: string }>('/auth/student/refresh', { refreshToken: storedRefresh });
          if (result.ok && result.data) {
            persistSession(result.data, JSON.parse(storedProfile), rememberMe);
          } else {
            clearSession();
          }
        }
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register: UserAuthContextType['register'] = async (input) => {
    setIsLoading(true);
    setLoginError(null);
    const result = await apiPost<{ tokens: AuthTokens; user: any }>('/auth/student/register', input);
    setIsLoading(false);
    if (!result.ok || !result.data) { setLoginError(result.message ?? 'Registration failed.'); return null; }
    const profile = normalizeUser(result.data.user);
    persistSession(result.data.tokens, profile, true);
    return profile;
  };

  const login: UserAuthContextType['login'] = async (email, password, rememberMe = true) => {
    setIsLoading(true);
    setLoginError(null);
    const result = await apiPost<{ tokens: AuthTokens; user: any; requires2FA?: boolean; pendingToken?: string; method?: 'totp' | 'email' }>(
      '/auth/student/login', { email, password, rememberMe },
    );
    setIsLoading(false);
    if (!result.ok || !result.data) { setLoginError(result.message ?? 'Sign-in failed.'); return null; }

    if (result.data.requires2FA && result.data.pendingToken) {
      remember.current = rememberMe;
      setPendingTwoFactor({ pendingToken: result.data.pendingToken, method: result.data.method ?? 'totp' });
      return null;
    }

    const profile = normalizeUser(result.data.user);
    persistSession(result.data.tokens, profile, rememberMe);
    return profile;
  };

  const verifyTwoFactor: UserAuthContextType['verifyTwoFactor'] = async (code, trustThisDevice = false) => {
    if (!pendingTwoFactor) return null;
    setIsLoading(true);
    setLoginError(null);
    const result = await apiPost<{ tokens: AuthTokens; user: any }>('/auth/2fa/verify', {
      pendingToken: pendingTwoFactor.pendingToken, code, trustThisDevice,
    });
    setIsLoading(false);
    if (!result.ok || !result.data) { setLoginError(result.message ?? 'Invalid or expired code.'); return null; }
    const profile = normalizeUser(result.data.user);
    persistSession(result.data.tokens, profile, remember.current);
    setPendingTwoFactor(null);
    return profile;
  };

  const cancelTwoFactor = () => { setPendingTwoFactor(null); setLoginError(null); };

  const loginWithOAuth: UserAuthContextType['loginWithOAuth'] = async (provider, mockProfile) => {
    setIsLoading(true);
    setLoginError(null);
    const email = mockProfile?.email || `user.${provider}@example.com`;
    const name = mockProfile?.name || `${provider.charAt(0).toUpperCase()}${provider.slice(1)} Student`;
    const avatarUrl = mockProfile?.avatarUrl;
    const providerId = mockProfile?.providerId || `mock_${provider}_${Math.random().toString(36).slice(2)}`;

    const result = await apiPost<{ tokens: AuthTokens; user: any }>(`/auth/oauth/${provider}`, {
      provider, idTokenTokenOrCode: providerId, providerId, email, name, avatarUrl,
    });
    setIsLoading(false);
    if (!result.ok || !result.data) { setLoginError(result.message ?? 'Sign-in failed.'); return null; }
    const profile = normalizeUser({ ...result.data.user, avatarUrl: result.data.user.avatarUrl ?? avatarUrl });
    persistSession(result.data.tokens, profile, true);
    return profile;
  };

  const logoutUser = async () => {
    const refreshToken = readStorage(REFRESH_KEY);
    if (accessToken) {
      await apiPost('/auth/student/logout', { refreshToken }, accessToken).catch(() => null);
    }
    clearSession();
  };

  const logoutAllDevices = async () => {
    if (accessToken) {
      await apiPost('/auth/student/logout-all', {}, accessToken).catch(() => null);
    }
    clearSession();
  };

  const forgotPassword = async (email: string) => {
    const result = await apiPost<{ message: string }>('/auth/student/password/forgot', { email });
    return { ok: result.ok, message: result.data?.message ?? result.message };
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const result = await apiPost('/auth/student/password/reset', { email, otp, newPassword });
    return { ok: result.ok, message: result.message };
  };

  const refreshUser = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/v1/users/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const updated = normalizeUser({
          id: data.data.id ?? data.data._id,
          fullName: data.data.fullName,
          email: data.data.email,
          phone: data.data.phone,
          photoUrl: data.data.photoUrl,
          authProvider: data.data.authProvider,
          isEmailVerified: data.data.isEmailVerified,
          onboardingCompleted: data.data.onboarding?.completed,
        });
        setUser(updated);
        writeStorage(PROFILE_KEY, JSON.stringify(updated), remember.current);
      }
    } catch {
      // Non-fatal — cached profile stays as-is.
    }
  };

  const updateUserLocal = (patch: Partial<UserProfile>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      writeStorage(PROFILE_KEY, JSON.stringify(next), remember.current);
      return next;
    });
  };

  const clearLoginError = () => setLoginError(null);

  return (
    <UserAuthContext.Provider
      value={{
        user, accessToken, isAuthenticated: !!user, isLoading, loginError, pendingTwoFactor,
        register, login, loginWithOAuth, verifyTwoFactor, cancelTwoFactor, logoutUser, logoutAllDevices,
        forgotPassword, resetPassword, refreshUser, updateUserLocal, clearLoginError,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
}

function normalizeUser(raw: any): UserProfile {
  return {
    id: raw.id,
    name: raw.name ?? raw.fullName,
    email: raw.email,
    phone: raw.phone,
    avatarUrl: raw.avatarUrl ?? raw.photoUrl,
    provider: raw.provider ?? raw.authProvider ?? 'password',
    role: 'student',
    isEmailVerified: raw.isEmailVerified ?? false,
    onboardingCompleted: raw.onboardingCompleted ?? false,
  };
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
}
