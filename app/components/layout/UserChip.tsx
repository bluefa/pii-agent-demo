'use client';

import { useEffect, useRef, useState } from 'react';
import { cn, navStyles } from '@/lib/theme';
import { getCurrentUser, type UserMeResponse } from '@/app/lib/api';

/**
 * Current-user avatar in the TopNav (Google account-chip pattern):
 * a circular initial badge; clicking it opens a small card with name + email.
 * Renders nothing until /user/me resolves — auth itself is owned by the
 * IAP/SSO layer in front of the app, so a failed fetch just hides the chip.
 */
export const UserChip = () => {
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // Unauthenticated / BFF error — keep the chip hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // All UserMeResponse fields are optional per the swagger contract.
  const display = user?.name?.trim() || user?.email?.trim() || '';
  if (!user || !display) return null;
  const initial = display.charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`${display} 계정`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(navStyles.user.chip, navStyles.user.avatar)}
      >
        {initial}
      </button>

      {open && (
        <div role="dialog" aria-label="계정 정보" className={navStyles.user.menu.container}>
          <div aria-hidden="true" className={navStyles.user.menu.avatar}>
            {initial}
          </div>
          <div className="min-w-0">
            <div className={navStyles.user.menu.name}>{user.name ?? display}</div>
            {user.email && <div className={navStyles.user.menu.email}>{user.email}</div>}
          </div>
        </div>
      )}
    </div>
  );
};
