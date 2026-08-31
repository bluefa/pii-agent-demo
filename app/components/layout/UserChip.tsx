'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn, navStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { isAdminRole } from '@/lib/roles';
import { COPY } from '@/lib/copy';
import type { UserMeResponse } from '@/app/lib/api';
import { useLocale } from '@/app/components/LocaleProvider';

/**
 * Current-user avatar in the TopNav (Google account-chip pattern):
 * a circular initial badge; clicking it opens a small card with name + email.
 * `user` is resolved on the server (TopNav) and handed down, so the chip is in
 * the first paint instead of popping in. `null` means /user/me did not answer —
 * auth itself is owned by the IAP/SSO layer in front of the app, so the chip
 * just stays hidden.
 *
 * The card is also where 관리자 lives. It used to be a top-bar nav item shown to
 * everyone, which offered every non-admin a destination that only ever denied
 * them. It is admin-only and rare, so it belongs behind the account chip — and
 * the visibility rule is `isAdminRole`, the same predicate the server gate in
 * `app/admin/layout.tsx` uses, so the menu can never offer what the gate blocks.
 */
export const UserChip = ({ user }: { user: UserMeResponse | null }) => {
  const { locale } = useLocale();
  const t = COPY[locale].nav;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        aria-label={t.account(display)}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(navStyles.user.chip, navStyles.user.avatar)}
      >
        {initial}
      </button>

      {open && (
        <div role="dialog" aria-label={t.accountInfo} className={navStyles.user.menu.container}>
          <div className={navStyles.user.menu.identity}>
            <div aria-hidden="true" className={navStyles.user.menu.avatar}>
              {initial}
            </div>
            <div className="min-w-0">
              <div className={navStyles.user.menu.name}>{user.name ?? display}</div>
              {user.email && <div className={navStyles.user.menu.email}>{user.email}</div>}
            </div>
          </div>

          <div aria-hidden="true" className={navStyles.user.menu.divider} />
          {/* 내 권한 요청 — account-scoped and role-agnostic, so it sits above the
              admin block with no gate. This is the only entry point for a user who
              lacks permission on a service: the 접근 권한 admin screens are behind the
              ADMIN allowlist, which is exactly the audience that never needs to ask. */}
          <Link
            href={passRoutes.accessRequests}
            onClick={() => setOpen(false)}
            className={navStyles.user.menu.item}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={navStyles.user.menu.itemIcon}
            >
              <rect x="4" y="10.5" width="16" height="10" rx="2" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            </svg>
            {t.myAccessRequests}
          </Link>

          {isAdminRole(user.role) && (
            <>
              <div aria-hidden="true" className={navStyles.user.menu.divider} />
              {/* The card outlives navigation (TopNav persists), so the link
                  closes it itself — otherwise it stays open over the new page. */}
              <Link
                href={passRoutes.pipelines.dashboard}
                onClick={() => setOpen(false)}
                className={navStyles.user.menu.item}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={navStyles.user.menu.itemIcon}
                >
                  <circle cx="12" cy="8" r="3.8" />
                  <path d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
                </svg>
                {t.admin}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};
