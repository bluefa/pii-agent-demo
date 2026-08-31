// @vitest-environment jsdom
/**
 * The external console items take their URL from a prop, not from
 * `process.env.NEXT_PUBLIC_*`: an inlined build-time value diverges from the
 * runtime one, so the server and the client bundle would render the same anchor
 * with two different hrefs. This pins both halves — a configured URL wins, and
 * an unconfigured one falls back to the in-app path.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TopNav } from '@/app/components/layout/TopNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/services',
}));

describe('TopNav 외부 콘솔 링크', () => {
  it('설정된 URL 을 쓰고, 없으면 앱 내 경로로 떨어진다', () => {
    render(
      <TopNav
        user={null}
        consoleUrls={{ credentials: 'https://c.example', piiMap: 'https://m.example' }}
      />,
    );

    const expected = [
      ['Credentials', 'https://c.example'],
      ['PII Map', 'https://m.example'],
      ['PII Tag mgmt.', '/pii-tag'],
    ] as const;

    for (const [name, href] of expected) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });
});
