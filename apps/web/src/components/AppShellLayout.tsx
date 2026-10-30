'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserAuth } from '../contexts/UserAuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { NotificationBell } from './notifications/NotificationBell';
import { ProfileMenu } from './layout/ProfileMenu';
import { HeaderLoginButton } from './layout/HeaderLoginButton';
import { HeaderWishlistButton } from './layout/HeaderWishlistButton';

const NAV_LINKS = [
  { href: '/colleges', label: 'Colleges' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/counsellor', label: 'AI Counsellor' },
  { href: '/scholarships', label: 'Scholarships' },
  { href: '/financial-planner', label: 'Financials' },
  { href: '/roadmap', label: 'Roadmap' },
];

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useUserAuth();
  const { admin, isAdminAuthenticated } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdminRoute = pathname.startsWith('/admin');

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  if (isAdminRoute) {
    // Completely isolated layout for admin portal — public header & footer are omitted
    return <div className="admin-root-wrapper">{children}</div>;
  }

  return (
    <div className="user-site-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="site-header">
        <div className="site-header-inner site-header-bar">
          <Link href="/" className="site-logo" aria-label="CareerCompass AI — Home">
            <span className="site-logo-text">CareerCompass</span>
            <sup className="site-logo-exponent">AI</sup>
          </Link>

          <nav className="site-nav" aria-label="Primary">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} className="site-nav-link" data-active={pathname === link.href}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="site-header-actions">
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated && <HeaderWishlistButton />}
            {isAuthenticated ? (
              <ProfileMenu />
            ) : (
              <HeaderLoginButton className="site-desktop-auth-btn" />
            )}

            {isAdminAuthenticated && admin ? (
              <Link href="/admin" className="btn-editorial-primary site-admin-btn site-desktop-auth-btn" style={{ padding: '10px 22px', fontSize: '14px', textDecoration: 'none' }}>
                🛡️ Admin Dashboard
              </Link>
            ) : (
              <Link href="/login/admin" className="btn-editorial-primary site-desktop-auth-btn" style={{ padding: '10px 22px', fontSize: '14px', textDecoration: 'none' }}>
                Admin Portal
              </Link>
            )}

            <button
              type="button"
              className="site-menu-toggle"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className="site-menu-toggle-bar" />
            </button>
          </div>
        </div>

        <div className="site-mobile-panel" data-open={mobileMenuOpen}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} className="site-nav-link" data-active={pathname === link.href}>
              {link.label}
            </Link>
          ))}
          <div className="site-mobile-actions">
            {!isAuthenticated && <HeaderLoginButton className="site-mobile-login-btn" />}
            {isAdminAuthenticated && admin ? (
              <Link href="/admin" className="btn-editorial-primary site-admin-btn" style={{ textDecoration: 'none', textAlign: 'center' }}>
                🛡️ Admin Dashboard
              </Link>
            ) : (
              <Link href="/login/admin" className="btn-editorial-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Admin Portal
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* MAIN PUBLIC PAGE CONTENT */}
      <main style={{ flex: 1 }}>{children}</main>

      {/* EDITORIAL 3-COLUMN FOOTER FOR PUBLIC USER SITE */}
      <footer style={{ backgroundColor: 'var(--footer-bg)', borderTop: '1px solid var(--border-color)', padding: '80px 0 48px' }}>
        <div className="container-editorial" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '64px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span className="font-serif" style={{ fontSize: '26px', fontWeight: 600 }}>CareerCompass AI</span>
            <p className="text-body" style={{ maxWidth: '420px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              An editorial-grade career architecture platform combining multi-year KCET/COMEDK cutoff intelligence with grounded LLM counselling.
            </p>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
              © 2026 CareerCompass AI. All rights reserved.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px' }}>
              Platform Modules
            </span>
            <Link href="/colleges" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Karnataka Cutoffs</Link>
            <Link href="/predictions" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Probability Engine</Link>
            <Link href="/counsellor" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>AI RAG Counsellor</Link>
            <Link href="/scholarships" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Scholarship Matcher</Link>
            <Link href="/financial-planner" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Loan & EMI Planner</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px' }}>
              Governance & Security
            </span>
            <Link href="/admin" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Admin Management</Link>
            <Link href="/login/student" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Student Sign In</Link>
            <Link href="/register" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Create Student Account</Link>
            <Link href="/login/admin" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Admin Portal Login</Link>
            <span style={{ color: 'var(--text-muted)' }}>KEA Verification Data</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
