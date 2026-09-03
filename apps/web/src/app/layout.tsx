import './globals.css';
import React from 'react';
import { UserAuthProvider } from '../contexts/UserAuthContext';
import { AdminAuthProvider } from '../contexts/AdminAuthContext';
import { AppShellLayout } from '../components/AppShellLayout';
import { CookieConsentBanner } from '../components/consent/CookieConsentBanner';

export const metadata = {
  title: 'CareerCompass AI — Karnataka Engineering College Admissions & Career Intelligence',
  description: 'Luxury editorial career guidance platform for Karnataka engineering aspirants, fresh graduates, and working professionals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UserAuthProvider>
          <AdminAuthProvider>
            <AppShellLayout>{children}</AppShellLayout>
            <CookieConsentBanner />
          </AdminAuthProvider>
        </UserAuthProvider>
      </body>
    </html>
  );
}
