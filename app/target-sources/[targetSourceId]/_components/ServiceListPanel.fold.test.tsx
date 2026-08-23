// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/lib/api', () => ({
  getServicesPage: vi.fn(async () => ({
    content: [{ code: 'SERVICE-A', name: 'Service A' }],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 8,
  })),
}));

import { ServiceListPanel } from '@/app/target-sources/[targetSourceId]/_components/ServiceListPanel';

const STORAGE_KEY = 'pii:rail:v1:services';

/**
 * jsdom's `localStorage` here has no methods, so every call throws a TypeError that
 * `useRailCollapse` swallows — see the same stub and the same explanation in
 * `common/GuidePanel.test.tsx`. Without it the persistence assertion below would pass
 * against a fold that never stored anything.
 */
const store = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  },
});

beforeEach(() => {
  localStorage.clear();
});

const currentService = { code: 'SERVICE-A', name: 'Service A' } as const;

describe('ServiceListPanel — the left rail folds on request only', () => {
  // ⛔ This rail has no `openMinWidth`. Unlike the guide rail it is open at every width
  // today, and this change gives the reader a way to put it away — it does not change
  // where it rests. A width-driven default here would be a behaviour change nobody asked
  // for, on the control people use to leave the screen.
  it('rests open, whatever the viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    render(<ServiceListPanel currentService={currentService} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '서비스 목록 접기' })).toBeTruthy(),
    );
    expect(screen.getByRole('heading', { name: '서비스 목록' })).toBeTruthy();
  });

  it('folds to a strip that still offers the way back', async () => {
    render(<ServiceListPanel currentService={currentService} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '서비스 목록 접기' })).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole('button', { name: '서비스 목록 접기' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '서비스 목록 펼치기' })).toBeTruthy(),
    );
    // The list itself is gone, not merely narrow — the 296px is actually returned.
    expect(screen.queryByRole('heading', { name: '서비스 목록' })).toBeNull();
  });

  it('remembers the fold across mounts', async () => {
    const first = render(<ServiceListPanel currentService={currentService} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '서비스 목록 접기' })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole('button', { name: '서비스 목록 접기' }));
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe('1'));
    first.unmount();

    render(<ServiceListPanel currentService={currentService} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '서비스 목록 펼치기' })).toBeTruthy(),
    );
  });
});
