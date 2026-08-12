'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn, navStyles, textColors } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { BellIcon, BookIcon, QuestionCircleIcon } from '@/app/components/ui/icons';
import { UserChip } from '@/app/components/layout/UserChip';
import { PassLogo } from '@/app/components/layout/PassLogo';

type NavItem = {
  label: string;
  href: string;
  disabled?: boolean;
  icon: React.ReactNode;
  isActive: (pathname: string) => boolean;
};

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// Help/announcement links — live in the top nav so they are reachable from
// every page. An item without an `href` is still a placeholder and shows the
// same "준비 중" toast as the disabled primary items.
const UTILITY_ITEMS: Array<{ label: string; icon: React.ReactNode; href?: string }> = [
  {
    label: 'Notice',
    icon: <BellIcon className="h-3.5 w-3.5" />,
    href: `${passRoutes.notices}?type=NOTICE`,
  },
  { label: 'Guide', icon: <BookIcon className="h-3.5 w-3.5" /> },
  {
    label: 'FAQ',
    icon: <QuestionCircleIcon className="h-3.5 w-3.5" />,
    href: `${passRoutes.notices}?type=FAQ`,
  },
];

const NAV_ITEMS: NavItem[] = [
  {
    label: '서비스 목록',
    href: passRoutes.services,
    isActive: (pathname) =>
      pathname.startsWith('/services') ||
      pathname.startsWith('/target-sources'),
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  // 관리자 is deliberately absent from the bar: it is admin-only, and as a bar
  // item it offered every non-admin a destination that only ever denied them.
  // It now lives in the account card (UserChip), gated on the same `isAdminRole`
  // the server gate in app/admin/layout.tsx uses.
  {
    label: 'Credentials',
    href: passRoutes.credentials,
    disabled: true,
    isActive: () => false,
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    label: 'PII Tag mgmt.',
    href: passRoutes.piiTag,
    disabled: true,
    isActive: () => false,
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  {
    label: 'PII Map',
    href: passRoutes.piiMap,
    disabled: true,
    isActive: () => false,
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
  },
];

export const TopNav = () => {
  const pathname = usePathname() ?? '';
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const handleDisabledClick = (event: React.MouseEvent, label: string) => {
    event.preventDefault();
    setToastMessage(`${label} — 준비 중입니다`);
  };

  return (
    <>
      <header
        className={cn(
          // Sticky chrome — the admin nav must not scroll away with the page.
          //
          // Everything in here is `whitespace-nowrap` and nothing shrinks, so the
          // bar's intrinsic width is the whole app's minimum width: at any narrower
          // window the PAGE scrolls sideways, and the list underneath looks broken
          // for a reason that was never in the list. Below xl the bar sheds what it
          // can spare (utility labels, half the gaps) and keeps the primary items.
          // Dropping the logo's fixed 240px column did not raise that floor: the
          // column was `xl:` only, so below xl it never applied, and at xl the bar
          // lost width rather than gaining it. Verified at 1710px — the page does
          // not scroll sideways.
          //
          // Nothing in here stretches to the bar's height, and that is the whole
          // rule. Measured in-browser on 2026-08-12: the console bars — GitHub,
          // Google Cloud, Vercel — all float their menu items INSIDE the bar at
          // 50-75% of its height, and the only one that fills it edge to edge is
          // Atlassian's MARKETING nav, which is what this bar was copying at 60 of
          // 64. At h-10 the items sit in 40 of 64 (63%), and the 12px of bar above
          // and below is what makes the strip read as chrome rather than as a row
          // of buttons.
          //
          // Three heights, in a narrow band on purpose: mark 32, item 40, chip 36.
          // GitHub runs all three at exactly 32 — the band matters, the number
          // does not. Before this the bar held four: a 59px lockup (40 + gap-1 +
          // 15) that filled its whole 60px content box, 36px items, ~30px utility
          // links and a 32px chip. The mark was not the largest thing by design;
          // it was the largest thing because nothing set a band.
          //
          // ⚠ 64px is not local. Everything that sits below this bar or fills
          // the rest of the viewport hard-codes it, because Tailwind class
          // strings must stay complete literals (동적 조합 금지) and cannot read
          // a shared token. Change it here and all of these move with it:
          //   lib/theme.ts                     (pipelineStyles shell / sidebar)
          //   app/admin/layout.tsx                          (FullPageNotice)
          //   app/admin/pipelines/_services/styles.ts        (split, railSticky)
          //   app/services/_components/ServiceManagementView.tsx
          //   app/target-sources/[targetSourceId]/_components/ProjectDetail.tsx  (×2)
          'sticky top-0 z-40 h-[64px] flex items-center gap-4 xl:gap-8 px-6 text-white',
          navStyles.bg,
        )}
      >
        {/* Natural width — deliberately NOT a fixed column. The logo used to own
            240px so the first nav item started at x=296, the ServiceSidebar
            rail's right edge. That alignment sits on a different plane from the
            bar, and the admin console's rail is a different width, so it never
            held everywhere it appeared to. What it did hold everywhere was a
            hole: the column was cut for a 148px-wide lockup, so at 108px it sat
            55% empty exactly where the eye enters the bar. */}
        {/* `flex`, so the svg is a flex item rather than an inline box — inline
            would hang it off the text baseline and add a few px of descender
            space under it, pushing the mark off the bar's centre. */}
        <div className="flex px-1">
          <PassLogo />
        </div>

        {/* h-10 on the items, not `h-full`: the hit target is declared here rather
            than inherited from the bar, so the bar's height and the button's size
            stop being the same decision. 40 is the smallest step above the 36px
            chip that still clears the 44px-ish comfortable target once the 4px
            gaps either side are counted. */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(pathname);
            const baseClass = cn(
              'inline-flex h-10 items-center gap-2 px-3.5 rounded-md text-base font-medium whitespace-nowrap transition-colors',
              active ? navStyles.link.active : navStyles.link.inactive,
              item.disabled && 'opacity-50 cursor-not-allowed',
            );

            if (item.disabled) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  aria-disabled="true"
                  onClick={(e) => handleDisabledClick(e, item.label)}
                  className={baseClass}
                >
                  {item.icon}
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={baseClass}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* All the bar's slack, pooled here on purpose. It used to sit between the
            utility group and the avatar, which left the bar with two holes — one
            after the logo, one 517px wide before the avatar — and slack in two
            places reads as empty, not as roomy. One gap between two clusters
            reads as structure. */}
        <div className="flex-1" />

        {/* Help/announcement group — now the head of the RIGHT cluster rather than
            a tail on the primary items. */}
        <nav aria-label="도움말" className="flex items-center gap-0.5">
          {UTILITY_ITEMS.map((item) => {
            // Below xl these fall back to their icons. The label goes off the screen,
            // not off the element: `aria-label` is unconditional so the accessible
            // name never depends on the window, and `title` gives the same word back
            // to a sighted user on hover.
            const className = cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              navStyles.link.inactive,
            );
            const content = (
              <>
                {item.icon}
                <span className="hidden xl:inline">{item.label}</span>
              </>
            );

            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={className}
              >
                {content}
              </Link>
            ) : (
              <a
                key={item.label}
                href="#"
                onClick={(e) => handleDisabledClick(e, item.label)}
                aria-label={item.label}
                title={item.label}
                className={className}
              >
                {content}
              </a>
            );
          })}
        </nav>

        {/* Help links and the account are both "right cluster", but they are not the
            same kind of thing — the rule says so without a second gap.
            The negative margin tightens it against its neighbours, so it tracks the
            header's gap: at -mx-4 on a gap-4 bar the two groups would touch. */}
        <span aria-hidden="true" className={cn(navStyles.divider, '-mx-2 xl:-mx-4')} />

        <UserChip />
      </header>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm shadow-lg',
            navStyles.bg,
            textColors.inverse,
          )}
        >
          {toastMessage}
        </div>
      )}
    </>
  );
};
