import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserAuthProvider, useUserAuth } from '../UserAuthContext';

// Node 22+ ships its own native, file-backed localStorage/sessionStorage
// globals, which in this test environment shadow jsdom's — a working
// in-memory stub sidesteps that entirely rather than depending on which one
// wins in a given Node version.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

function TestHarness() {
  const { loginWithGoogle, user, loginError } = useUserAuth();
  return (
    <div>
      <button onClick={() => loginWithGoogle('fake-id-token')}>Sign in</button>
      <div data-testid="user-name">{user?.name ?? 'none'}</div>
      <div data-testid="error">{loginError ?? 'none'}</div>
    </div>
  );
}

// loginWithGoogle replaced the old loginWithOAuth mock, which used to
// fabricate a client-side providerId and email — these tests pin down that
// the ID token is now sent as-is (verification happens server-side) and
// nothing else identity-shaped is sent alongside it.
describe('UserAuthContext.loginWithGoogle', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.stubGlobal('sessionStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs only the ID token to /auth/oauth/google and persists the session on success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tokens: { accessToken: 'access1', refreshToken: 'refresh1' },
          user: { id: 'u1', fullName: 'Asha Rao', email: 'asha@gmail.com', provider: 'google', isEmailVerified: true, onboardingCompleted: false },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<UserAuthProvider><TestHarness /></UserAuthProvider>);
    await userEvent.setup().click(screen.getByText('Sign in'));

    await waitFor(() => expect(screen.getByTestId('user-name').textContent).toBe('Asha Rao'));

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/oauth/google', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ provider: 'google', idTokenTokenOrCode: 'fake-id-token' }),
    }));
  });

  it('surfaces a login error when the backend rejects the token', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: { message: 'Google sign-in failed — the token could not be verified.' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<UserAuthProvider><TestHarness /></UserAuthProvider>);
    await userEvent.setup().click(screen.getByText('Sign in'));

    await waitFor(() => expect(screen.getByTestId('error').textContent).toContain('could not be verified'));
    expect(screen.getByTestId('user-name').textContent).toBe('none');
  });
});
