/**
 * Tests for `ServiceSidebar`'s list/empty branching.
 *
 * The rail lists every service the page returned, including the one the page is about —
 * that row is marked in place (`aria-current`) rather than lifted into a pinned band
 * above the list, so nothing is filtered out and nothing is shown twice. The empty state
 * therefore has two reasons, not three: a search that matched nothing, and no services
 * at all. The section heading ('전체 서비스' / '검색 결과') replaced the
 * '서비스 이름 / 서비스 코드' column header when the rail moved off table grammar; it must
 * never render over a blank body.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ServiceSidebar } from '@/app/components/features/admin/ServiceSidebar';

const noop = (): void => undefined;

const pageInfo = { totalElements: 0, totalPages: 1, number: 0, size: 10 };

const render = (props: Partial<Parameters<typeof ServiceSidebar>[0]>) =>
  renderToStaticMarkup(
    <ServiceSidebar
      services={[]}
      currentService={null}
      onSelectService={noop}
      searchQuery=""
      onSearchChange={noop}
      pageInfo={pageInfo}
      onPageChange={noop}
      {...props}
    />,
  );

describe('ServiceSidebar — empty list', () => {
  it('lists the current service instead of emptying the rail for it', () => {
    const html = render({
      services: [{ service_code: 'AWS', service_name: 'AWS' }],
      currentService: { code: 'AWS', name: 'AWS' },
    });
    // Lifting it out used to leave "이 페이지에 다른 서비스가 없습니다" over an empty rail.
    expect(html).toContain('AWS');
    expect(html).toContain('aria-current="true"');
    expect(html).not.toContain('서비스가 없습니다');
  });

  it('says there are no services at all when the page is empty', () => {
    const html = render({ services: [] });
    expect(html).toContain('서비스가 없습니다');
    expect(html).not.toContain('다른 서비스가 없습니다');
  });

  it('hides pagination when there is nothing to page through', () => {
    // The API reports one page for an empty result, which rendered a lone clickable
    // "1" under "no services" — `totalElements` is what actually gates the footer.
    const html = render({ services: [], searchQuery: 'zzzz' });
    expect(html).not.toContain('이전 페이지');
    expect(html).not.toContain('다음 페이지');
  });

  it('quotes the search term and offers to clear it', () => {
    const html = render({ services: [], searchQuery: 'zzzz' });
    expect(html).toContain('‘zzzz’와 일치하는 서비스가 없습니다');
    expect(html).toContain('검색어 지우기');
  });

  it('never renders empty quotes when there is no search term', () => {
    expect(render({ services: [] })).not.toContain('‘’');
  });
});

describe('ServiceSidebar — populated list', () => {
  it('marks the current service in place and keeps every other row', () => {
    const html = render({
      services: [
        { service_code: 'AWS', service_name: 'AWS' },
        { service_code: 'DLV', service_name: '배송서비스' },
      ],
      currentService: { code: 'AWS', name: 'AWS' },
    });
    expect(html).toContain('전체 서비스');
    // Both rows render; only the current one carries the marker.
    const rows = html.split('<li').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('AWS');
    expect(rows[0]).toContain('aria-current="true"');
    expect(rows[1]).toContain('배송서비스');
    expect(rows[1]).not.toContain('aria-current');
  });

  it('keeps a matching current service visible during a search', () => {
    const html = render({
      services: [{ service_code: 'AWS', service_name: 'AWS' }],
      currentService: { code: 'AWS', name: 'AWS' },
      searchQuery: 'aws',
    });
    expect(html).toContain('검색 결과');
    expect(html).toContain('aria-current="true"');
  });
});
