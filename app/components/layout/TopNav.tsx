'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn, navStyles, textColors } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { UserChip } from '@/app/components/layout/UserChip';

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

// Help/announcement links — moved up from the Service List sidebar footer so
// they are reachable from every page. All destinations are still placeholders,
// so a click shows the same "준비 중" toast as the disabled primary items.
const UTILITY_ITEMS: Array<{ label: string; icon: React.ReactNode }> = [
  {
    label: 'Notice',
    icon: (
      <svg {...iconProps} width={14} height={14} aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    label: 'Guide',
    icon: (
      <svg {...iconProps} width={14} height={14} aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    label: 'FAQ',
    icon: (
      <svg {...iconProps} width={14} height={14} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Service List',
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
  {
    label: '관리자',
    href: passRoutes.pipelines.dashboard,
    isActive: (pathname) => pathname.startsWith('/admin/pipelines'),
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="4.5" cy="12" r="2.3" />
        <circle cx="12" cy="12" r="2.3" />
        <circle cx="19.5" cy="12" r="2.3" />
        <path d="M6.8 12h2.9m4.6 0h2.9" />
      </svg>
    ),
  },
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
          'sticky top-0 z-40 h-14 flex items-center gap-8 px-6 text-white',
          navStyles.bg,
        )}
      >
        <div className="flex items-baseline gap-2.5 px-1 whitespace-nowrap">
          <span
            className={cn(
              'font-black text-xl tracking-tight',
              navStyles.brand.wordmark,
            )}
          >
            PASS
          </span>
          <small
            className={cn(
              'font-medium text-[10px] uppercase tracking-[0.14em]',
              navStyles.brand.tagline,
            )}
          >
            PII Agent Self Service
          </small>
        </div>

        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(pathname);
            const baseClass = cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
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

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <nav aria-label="도움말" className="flex items-center gap-0.5">
            {UTILITY_ITEMS.map((item) => (
              <a
                key={item.label}
                href="#"
                onClick={(e) => handleDisabledClick(e, item.label)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                  navStyles.link.inactive,
                )}
              >
                {item.icon}
                {item.label}
              </a>
            ))}
          </nav>

          <span aria-hidden="true" className="h-5 w-px bg-white/15" />

          <UserChip />
        </div>
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
