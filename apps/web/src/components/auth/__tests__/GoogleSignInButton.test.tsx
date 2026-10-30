import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoogleSignInButton } from '../GoogleSignInButton';

describe('GoogleSignInButton', () => {
  it('renders a disabled "unavailable" button when no client ID is configured', () => {
    // NEXT_PUBLIC_GOOGLE_CLIENT_ID is intentionally unset in the test env —
    // this is the state the app ships in until the user drops in real
    // Google OAuth credentials.
    render(<GoogleSignInButton onCredential={() => {}} />);
    const button = screen.getByRole('button', { name: /google sign-in unavailable/i });
    expect(button).toBeDisabled();
  });
});
