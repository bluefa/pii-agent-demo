// @vitest-environment jsdom
/**
 * The wiring tripwire for `lib/copy.ts`.
 *
 * TypeScript already proves the two dictionaries carry the same keys (`const en:
 * typeof ko`). What it cannot see is whether a component ever ASKS for the
 * locale: one that imports COPY but forgets `useLocale()`, or binds the wrong
 * namespace, compiles clean and renders Korean to an English reader forever.
 *
 * So each surface mounts twice and the assertion is symmetric — the OTHER
 * language has to be absent. A one-sided "Korean is on screen" check passes on a
 * component hard-wired to Korean, which is the exact bug being watched for.
 *
 * This repo has no RTL auto-cleanup, so every mount unmounts itself before the
 * next one (same reason as `ServiceSidebar.states.test.tsx`).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RequestStatusPill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { LocaleProvider } from '@/app/components/LocaleProvider';
import { ServiceSidebar } from '@/app/components/features/admin/ServiceSidebar';
import { ServiceHeaderV7 } from '@/app/components/features/admin/v7/ServiceHeaderV7';
import { TopNav } from '@/app/components/layout/TopNav';
import { UserChip } from '@/app/components/layout/UserChip';
import type { UserMeResponse } from '@/app/lib/api';
import type { Locale } from '@/lib/locale';

vi.mock('next/navigation', () => ({
  usePathname: () => '/services',
}));

const admin: UserMeResponse = { id: 'u1', name: '관리자', role: 'ADMIN' };

interface Surface {
  /** The component with the least props that still render the watched string. */
  ui: ReactElement;
  ko: string;
  en: string;
  /** Runs after mount, for a string that only exists once something is opened. */
  open?: () => void;
  /** How the string reaches the DOM — as text unless stated otherwise. */
  probe?: (text: string) => HTMLElement | null;
}

const SURFACES: Record<string, Surface> = {
  TopNav: {
    ui: <TopNav user={null} />,
    ko: '서비스 목록',
    en: 'Services',
  },
  UserChip: {
    ui: <UserChip user={admin} />,
    ko: '내 권한 요청',
    en: 'My access requests',
    // The account card is closed on mount; the chip is its only button.
    open: () => fireEvent.click(screen.getByRole('button')),
  },
  ServiceHeaderV7: {
    ui: <ServiceHeaderV7 serviceCode="ABC" serviceName="결제" onAddInfra={vi.fn()} />,
    ko: '인프라 등록',
    en: 'Register infrastructure',
  },
  ServiceSidebar: {
    ui: (
      <ServiceSidebar
        services={[]}
        currentService={null}
        onSelectService={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        pageInfo={{ totalElements: 0, totalPages: 1, number: 0, size: 8 }}
        onPageChange={vi.fn()}
      />
    ),
    ko: '서비스 이름 또는 코드',
    en: 'Service name or code',
    probe: (text) => screen.queryByPlaceholderText(text),
  },
  RequestStatusPill: {
    ui: <RequestStatusPill status="PENDING" />,
    ko: '승인 대기',
    en: 'Pending',
  },
};

/** Mounts, optionally opens, and reports which of the two strings the DOM holds. */
const shows = (surface: Surface, locale: Locale | null): { ko: boolean; en: boolean } => {
  const { unmount } = render(
    locale === null ? surface.ui : <LocaleProvider initial={locale}>{surface.ui}</LocaleProvider>,
  );
  try {
    surface.open?.();
    const find = surface.probe ?? ((text: string) => screen.queryByText(text));
    return { ko: find(surface.ko) !== null, en: find(surface.en) !== null };
  } finally {
    unmount();
  }
};

const cases = Object.entries(SURFACES);

describe('copy wiring — the localised surfaces read the provider, not a fixed dictionary', () => {
  it.each(cases)('%s follows the locale it is wrapped in', (_name, surface) => {
    expect(shows(surface, 'ko')).toEqual({ ko: true, en: false });
    expect(shows(surface, 'en')).toEqual({ ko: false, en: true });
  });

  // The provider's default is a real value, not a throw, and every other test in
  // this repo renders these components bare and asserts Korean.
  it.each(cases)('%s renders Korean with no provider around it', (_name, surface) => {
    expect(shows(surface, null)).toEqual({ ko: true, en: false });
  });
});
