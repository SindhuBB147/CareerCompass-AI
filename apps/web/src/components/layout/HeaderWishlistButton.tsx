'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { wishlistApi } from '../../lib/wishlist-api';

export function HeaderWishlistButton() {
  const { isAuthenticated, accessToken } = useUserAuth();
  const [savedCount, setSavedCount] = useState<number>(0);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res = await wishlistApi.getWishlist({}, accessToken);
        if (!cancelled && res?.colleges) {
          setSavedCount(res.colleges.length);
        }
      } catch {
        // Non-fatal fallback
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated, accessToken]);

  if (!isAuthenticated) return null;

  const hasItems = savedCount > 0;
  const label = `Wishlist${savedCount > 0 ? ` (${savedCount} saved)` : ''}`;

  return (
    <div className="notif-bell-root">
      <Link
        href="/wishlist"
        className="notif-bell-trigger"
        aria-label={label}
        title="Wishlist"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <Heart
          size={19}
          fill={hasItems ? 'var(--accent-red, #D64545)' : 'none'}
          color={hasItems ? 'var(--accent-red, #D64545)' : 'var(--text-primary)'}
          style={{ transition: 'all 0.2s ease' }}
        />
        {hasItems && (
          <span
            className="notif-bell-badge"
            style={{ backgroundColor: 'var(--accent-red, #D64545)' }}
          >
            {savedCount > 99 ? '99+' : savedCount}
          </span>
        )}
      </Link>
    </div>
  );
}
