'use client';

// Compact avatar trigger + dropdown menu replacing the old always-expanded
// .site-user-chip (avatar + name + provider + a separate sign-out button).
// Mirrors NotificationBell.tsx's click-outside pattern rather than
// abstracting a shared "dropdown" primitive prematurely — this is only the
// second dropdown in the header.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';

interface MenuLink {
  href: string;
  icon: string;
  label: string;
}

const PRIMARY_LINKS: MenuLink[] = [
  { href: '/profile', icon: '👤', label: 'My Profile' },
  { href: '/wishlist', icon: '❤️', label: 'Saved Colleges' },
  { href: '/scholarships', icon: '🎓', label: 'Scholarships' },
  { href: '/predictions', icon: '📈', label: 'Admission Predictor' },
  { href: '/roadmap', icon: '🛣️', label: 'Career Roadmap' },
  { href: '/counsellor', icon: '💬', label: 'AI Counsellor' },
  { href: '/notifications', icon: '🔔', label: 'Notifications' },
  { href: '/reports', icon: '📄', label: 'My Reports' },
];

const SETTINGS_LINKS: MenuLink[] = [
  { href: '/profile/settings', icon: '⚙️', label: 'Settings' },
  { href: '/profile/security', icon: '🔒', label: 'Security' },
];

export function ProfileMenu() {
  const { user, logoutUser } = useUserAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);

  const allItems: Array<{ kind: 'link'; item: MenuLink } | { kind: 'logout' }> = [
    ...PRIMARY_LINKS.map(item => ({ kind: 'link' as const, item })),
    ...SETTINGS_LINKS.map(item => ({ kind: 'link' as const, item })),
    { kind: 'logout' },
  ];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  const close = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    const focusable = itemRefs.current.filter(Boolean) as Array<HTMLAnchorElement | HTMLButtonElement>;
    const currentIndex = focusable.findIndex(el => el === document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusable[(currentIndex + 1) % focusable.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusable[(currentIndex - 1 + focusable.length) % focusable.length]?.focus();
    }
  };

  if (!user) return null;

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <div className="profile-menu-root" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="profile-menu-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        title={user.name}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="profile-menu-avatar" />
        ) : (
          <span className="profile-menu-avatar-fallback">{initial}</span>
        )}
        <span className="profile-menu-online-dot" aria-hidden="true" />
      </button>

      {open && (
        <div className="profile-menu-panel card-editorial" role="menu" aria-label="Account menu">
          <div className="profile-menu-header">
            <span className="profile-menu-header-name">{user.name}</span>
            {user.email && <span className="profile-menu-header-email">{user.email}</span>}
          </div>

          <div className="profile-menu-group">
            {PRIMARY_LINKS.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="profile-menu-item"
                ref={el => { itemRefs.current[i] = el; }}
                onClick={() => close()}
              >
                <span className="profile-menu-item-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="profile-menu-divider" />

          <div className="profile-menu-group">
            {SETTINGS_LINKS.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="profile-menu-item"
                ref={el => { itemRefs.current[PRIMARY_LINKS.length + i] = el; }}
                onClick={() => close()}
              >
                <span className="profile-menu-item-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="profile-menu-divider" />

          <div className="profile-menu-group">
            <button
              type="button"
              role="menuitem"
              className="profile-menu-item profile-menu-item-danger"
              ref={el => { itemRefs.current[allItems.length - 1] = el; }}
              onClick={() => { close(); logoutUser(); }}
            >
              <span className="profile-menu-item-icon">🚪</span>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
