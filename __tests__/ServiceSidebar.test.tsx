/**
 * Tests for `ServiceSidebar`'s list/empty branching.
 *
 * The list renders `listed` — services minus the pinned current one — while the empty
 * state and the column header used to key off the unfiltered `services`. That gap left
 * a page holding nothing but the current service rendering column headings over a blank
 * body, which no fixture in the app reproduces (9 services fit one page). These lock the
 * three empty reasons and the filtering to `listed`.
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
  it('says the page holds nothing else when only the current service is on it', () => {
    const html = render({
      services: [{ service_code: 'AWS', service_name: 'AWS' }],
      currentService: { code: 'AWS', name: 'AWS' },
    });
    expect(html).toContain('다른 서비스가 없습니다');
    // Column headings over a blank body read as a broken table.
    expect(html).not.toContain('서비스 코드');
    expect(html).not.toContain('검색어 지우기');
  });

  it('says there are no services at all when nothing is pinned', () => {
    const html = render({ services: [] });
    expect(html).toContain('서비스가 없습니다');
    expect(html).not.toContain('다른 서비스가 없습니다');
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
  it('hides the pinned current service from the list but keeps the rest', () => {
    const html = render({
      services: [
        { service_code: 'AWS', service_name: 'AWS' },
        { service_code: 'DLV', service_name: '배송서비스' },
      ],
      currentService: { code: 'AWS', name: 'AWS' },
    });
    expect(html).toContain('서비스 코드');
    // One row, and it is the service that is *not* pinned. Counting raw occurrences
    // would over-count: each row repeats its code in the title attribute.
    const rows = html.split('<li').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('배송서비스');
    expect(rows[0]).not.toContain('AWS');
  });

  it('keeps a matching current service visible during a search', () => {
    const html = render({
      services: [{ service_code: 'AWS', service_name: 'AWS' }],
      currentService: { code: 'AWS', name: 'AWS' },
      searchQuery: 'aws',
    });
    expect(html).toContain('서비스 코드');
    expect(html).not.toContain('다른 서비스가 없습니다');
  });
});
