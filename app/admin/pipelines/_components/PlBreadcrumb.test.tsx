import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnchorHTMLAttributes } from 'react';

// next/link needs the App Router context to render; stub it as a plain anchor.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';

describe('PlBreadcrumb', () => {
  const html = renderToStaticMarkup(
    <PlBreadcrumb
      crumbs={[
        { label: '서비스 검색', href: '/admin/pipelines/services' },
        { label: 'svc-alpha' }, // inert middle crumb (no href)
        { label: '1006' }, // current
      ]}
    />,
  );

  it('renders a clickable Link for a mid crumb with href', () => {
    expect(html).toContain('href="/admin/pipelines/services"');
    expect(html).toContain('서비스 검색');
  });

  it('renders exactly one anchor (the inert crumb is not linked)', () => {
    expect(html.match(/<a /g) ?? []).toHaveLength(1);
    expect(html).toContain('svc-alpha');
    expect(html).not.toContain('href="undefined"');
  });

  it('marks the last crumb as the current page (.cur, aria-current)', () => {
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('font-semibold');
    expect(html).toContain('1006');
  });

  it('inserts a › separator between crumbs', () => {
    expect(html.match(/›/g) ?? []).toHaveLength(2);
  });
});
