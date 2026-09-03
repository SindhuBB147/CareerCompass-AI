'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth, AdminRole } from '../../contexts/AdminAuthContext';
import { useAdminTheme } from '../../hooks/useAdminTheme';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: AdminRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: '📊', roles: ['super_admin', 'data_manager'] },
    ],
  },
  {
    title: 'Academic Data',
    items: [
      { href: '/admin/colleges', label: 'Colleges', icon: '🏛️', roles: ['super_admin', 'data_manager'] },
      { href: '/admin/wishlist', label: 'Saved Colleges & Wishlist', icon: '❤️', roles: ['super_admin', 'data_manager'] },
      { href: '/admin/cutoffs', label: 'Cutoffs (KCET/COMEDK/NEET)', icon: '🎯', roles: ['super_admin', 'data_manager'] },
      { href: '/admin/scholarships', label: 'Scholarships', icon: '🎓', roles: ['super_admin', 'data_manager'] },
      { href: '/admin/roadmap-templates', label: 'Career Roadmap Templates', icon: '🗺️', roles: ['super_admin', 'data_manager'] },
    ],
  },
  {
    title: 'AI Counsellor',
    items: [
      { href: '/admin/knowledge', label: 'Knowledge Base', icon: '📚', roles: ['super_admin', 'data_manager'] },
      { href: '/admin/ai-review', label: 'AI Chat Review', icon: '🧭', roles: ['super_admin', 'data_manager', 'support_agent'] },
    ],
  },
  {
    title: 'People & Governance',
    items: [
      { href: '/admin/students', label: 'Students', icon: '🧑‍🎓', roles: ['super_admin', 'data_manager', 'support_agent'] },
      { href: '/admin/admins', label: 'Admins & Permissions', icon: '🛡️', roles: ['super_admin'] },
      { href: '/admin/security', label: 'Security Management', icon: '🔐', roles: ['super_admin'] },
      { href: '/admin/audit-logs', label: 'Audit Logs', icon: '🔒', roles: ['super_admin'] },
    ],
  },
  {
    title: 'Communications',
    items: [
      { href: '/admin/notifications', label: 'Notifications', icon: '🔔', roles: ['super_admin', 'data_manager'] },
    ],
  },
  {
    title: 'Insights',
    items: [
      { href: '/admin/reports', label: 'Reports', icon: '📈', roles: ['super_admin', 'data_manager', 'b2b_account_manager'] },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, isAdminAuthenticated, logoutAdmin } = useAdminAuth();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useAdminTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === '/login/admin';
  if (isLoginPage) return <>{children}</>;

  const role = admin?.role;
  const visibleSections = NAV
    .map(section => ({ ...section, items: section.items.filter(item => !role || item.roles.includes(role)) }))
    .filter(section => section.items.length > 0);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    router.push(`/admin/colleges?q=${encodeURIComponent(searchTerm.trim())}`);
  };

  return (
    <div className="admin-shell" data-theme={theme}>
      <div
        className="admin-sidebar-backdrop"
        data-visible={mobileMenuOpen}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <aside className="admin-sidebar" data-collapsed={sidebarCollapsed} data-mobile-open={mobileMenuOpen}>
        <div className="admin-sidebar-top">
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-mark">🛡️</div>
            <div className="admin-sidebar-brand-text">
              <span className="admin-sidebar-brand-title">Admin Portal</span>
              <span className="admin-sidebar-brand-sub">CareerCompass AI</span>
            </div>
          </div>

          {isAdminAuthenticated && visibleSections.map(section => (
            <nav key={section.title} className="admin-nav-section">
              <span className="admin-nav-section-title">{section.title}</span>
              {section.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="admin-nav-link"
                  data-active={pathname === item.href}
                  title={item.label}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="admin-nav-icon">{item.icon}</span>
                  <span className="admin-nav-label">{item.label}</span>
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="admin-sidebar-collapse-btn" onClick={toggleSidebar}>
            {sidebarCollapsed ? '»' : '« Collapse'}
          </button>
          {!sidebarCollapsed && (
            <div className="admin-sidebar-footer">
              RBAC-protected — role determines what you can see and change here.
            </div>
          )}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-hamburger"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            ☰
          </button>
          <form className="admin-topbar-search" onSubmit={handleGlobalSearch}>
            <span aria-hidden="true">🔍</span>
            <input
              type="text"
              placeholder="Search colleges, students, scholarships…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              aria-label="Global admin search"
            />
          </form>

          <div className="admin-topbar-actions">
            <button
              type="button"
              className="admin-theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {isAdminAuthenticated && admin ? (
              <div className="admin-profile-chip">
                <div style={{ textAlign: 'right' }}>
                  <div className="admin-profile-name">{admin.email}</div>
                  <div className="admin-profile-role">{admin.role.replace('_', ' ')}</div>
                </div>
                <button onClick={logoutAdmin} className="btn-editorial-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href="/login/admin" className="btn-editorial-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                Admin Login
              </Link>
            )}
          </div>
        </header>

        <main className="admin-body">
          {isAdminAuthenticated ? children : (
            <div className="card-editorial admin-empty-state">
              <div className="admin-empty-icon">🔒</div>
              <h3 className="font-serif" style={{ fontSize: '20px', margin: 0 }}>Admin Session Required</h3>
              <p style={{ margin: 0 }}>Sign in with an admin account to access this portal.</p>
              <Link href="/login/admin" className="btn-editorial-primary">Go to Admin Login</Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
