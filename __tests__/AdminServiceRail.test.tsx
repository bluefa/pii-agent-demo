/**
 * Tests for `AdminServiceRail`'s body branching.
 *
 * This component was extracted from two near-identical copies (the ops console rail
 * and the services·targets search rail). The copies did NOT branch the same way: one
 * checked `failed` first and drew a skeleton while loading, the other checked loading
 * first and drew a blank box. Merging them into one order — 실패 > 로딩 > 빈 결과 > 행 —
 * is the only behaviour this refactor actually changed, so it is the thing under test.
 *
 * The precedence matters in a specific way: a failed request also has zero rows, so if
 * the empty branch ran first the user would read "검색 결과가 없습니다" for a request
 * that never came back — a wrong answer, not a missing one, and with no retry to escape
 * it. Same for loading.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminServiceRail } from '@/app/admin/pipelines/_services/AdminServiceRail';

const noop = (): void => undefined;

const pageInfo = { totalElements: 0, totalPages: 1, number: 0, size: 8 };

const render = (props: Partial<Parameters<typeof AdminServiceRail>[0]>) =>
  renderToStaticMarkup(
    <AdminServiceRail
      title="서비스 운영"
      total={null}
      searchValue=""
      onSearchChange={noop}
      searchPlaceholder="검색"
      services={[]}
      loading={false}
      selectedCode={null}
      onSelectService={noop}
      pageInfo={pageInfo}
      onPageChange={noop}
      {...props}
    />,
  );

const FAILURE = { message: '서비스 목록을 불러오지 못했습니다.', onRetry: noop };

describe('AdminServiceRail — body precedence', () => {
  it('shows the failure and its retry even though the list is also empty', () => {
    const html = render({ error: FAILURE, services: [] });
    expect(html).toContain('서비스 목록을 불러오지 못했습니다.');
    expect(html).toContain('다시 시도');
    // The wrong answer this ordering exists to prevent.
    expect(html).not.toContain('검색 결과가 없습니다');
  });

  it('keeps the failure visible when a request is also in flight', () => {
    // `loading` stays true while a retry is running; the failure must not flicker away
    // into a skeleton that then fails again.
    const html = render({ error: FAILURE, loading: true });
    expect(html).toContain('다시 시도');
  });

  it('draws the skeleton while loading, not the empty state', () => {
    const html = render({ loading: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('검색 결과가 없습니다');
  });

  it('says the list is empty only when the request finished with nothing', () => {
    const html = render({ services: [], loading: false });
    expect(html).toContain('검색 결과가 없습니다');
    expect(html).not.toContain('aria-busy="true"');
  });
});

describe('AdminServiceRail — rows and section label', () => {
  const services = [
    { service_code: 'AWS', service_name: 'AWS' },
    { service_code: 'DLV', service_name: '배송서비스' },
  ];

  it('marks the selected row and leaves the others alone', () => {
    const html = render({ services, selectedCode: 'AWS' });
    const rows = html.split('<button').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('AWS');
    expect(rows[0]).toContain('aria-current="true"');
    expect(rows[1]).toContain('배송서비스');
    expect(rows[1]).not.toContain('aria-current');
  });

  it('drops a row with no service_code — it has nowhere to navigate', () => {
    // Both fields are optional in the generated contract type (loose zod codegen).
    const html = render({ services: [...services, { service_name: '코드 없음' }] });
    expect(html).not.toContain('코드 없음');
    expect(html.split('<button').slice(1)).toHaveLength(2);
  });

  it('labels a search result only — an unfiltered list gets no section line', () => {
    expect(render({ services })).not.toContain('검색 결과');
    expect(render({ services, searchValue: 'aws' })).toContain('검색 결과');
    // Whitespace is not a search — it would label a full list as a filtered one.
    expect(render({ services, searchValue: '   ' })).not.toContain('검색 결과');
  });
});
