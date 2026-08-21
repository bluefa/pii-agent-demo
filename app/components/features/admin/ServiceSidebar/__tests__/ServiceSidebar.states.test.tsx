// @vitest-environment jsdom

/**
 * The rail's three list states, and the one line that stands under all of them.
 *
 * The states are three different sentences about the same zero: the list is
 * loading, the search missed, or this account has access to nothing. Only the
 * last is a fact about permission, and it is the only one allowed to say so —
 * a rail that says "권한이 없습니다" while the first page is still in flight is
 * telling the user something the response has not said yet.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { passRoutes } from '@/lib/routes';
import { ServiceSidebar } from '@/app/components/features/admin/ServiceSidebar';

const NO_ACCESS = '아직 접근 권한이 있는 서비스가 없습니다';
const STANDING_HINT = '담당 시스템/서비스가 조회되지 않나요?';

const pageInfo = (totalElements: number) => ({
  totalElements,
  totalPages: Math.max(1, Math.ceil(totalElements / 8)),
  number: 0,
  size: 8,
});

// unmount 없이 두 번 render 하면 두 트리가 같은 body 에 남는다 — 이 저장소에는
// RTL auto-cleanup 셋업 파일이 없다 (SidebarPagination.test.tsx 와 같은 이유).
const mount = (props: Partial<Parameters<typeof ServiceSidebar>[0]>) =>
  render(
    <ServiceSidebar
      services={[]}
      currentService={null}
      onSelectService={vi.fn()}
      searchQuery=""
      onSearchChange={vi.fn()}
      pageInfo={pageInfo(0)}
      onPageChange={vi.fn()}
      {...props}
    />,
  );

describe('ServiceSidebar 의 빈 목록 세 갈래', () => {
  it('검색 없이 0건이면 무권한 안내와 권한 요청 링크를 낸다', () => {
    const { container, unmount } = mount({});
    expect(container.textContent).toContain(NO_ACCESS);
    const cta = container.querySelector(`a[href="${passRoutes.accessRequests}"]`);
    expect(cta?.textContent).toContain('권한 요청하기');
    // 같은 문장·같은 링크가 바로 아래에 또 서면 296px 레일에 CTA 가 둘이 된다.
    expect(container.textContent).not.toContain(STANDING_HINT);
    unmount();
  });

  it('검색 결과가 0건인 것은 무권한이 아니다', () => {
    const { container, unmount } = mount({ searchQuery: 'zzz', pageInfo: pageInfo(0) });
    expect(container.textContent).toContain('‘zzz’와 일치하는 서비스가 없습니다');
    expect(container.textContent).not.toContain(NO_ACCESS);
    // 찾던 서비스가 안 보이는 사람에게는 이 줄이 여기서도 답이다.
    expect(container.textContent).toContain(STANDING_HINT);
    unmount();
  });

  it('아직 응답이 없을 때는 권한에 대해 아무 말도 하지 않는다', () => {
    const { container, unmount } = mount({ loading: true });
    expect(container.textContent).not.toContain(NO_ACCESS);
    expect(container.querySelectorAll('li[aria-hidden="true"]').length).toBe(8);
    // 힌트는 데이터가 아니라 레일의 붙박이다. `noAccess` 가 loading 을 보지 않으면
    // 로딩 중 0건이 무권한으로 읽혀 이 줄이 사라지고, 도착과 함께 다시 나타난다.
    expect(container.textContent).toContain(STANDING_HINT);
    unmount();
  });

  it('목록이 있으면 상시 힌트만 남는다', () => {
    const { container, unmount } = mount({
      services: [{ service_code: 'AAA', service_name: '가나다' }],
      pageInfo: pageInfo(1),
    });
    expect(container.textContent).toContain('가나다');
    expect(container.textContent).not.toContain(NO_ACCESS);
    expect(container.textContent).toContain(STANDING_HINT);
    unmount();
  });
});
