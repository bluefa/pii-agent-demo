// @vitest-environment jsdom

/**
 * What the rail says when it has nothing to list, and the one line that stands
 * under every state.
 *
 * The rail deliberately does NOT explain permission. An unfiltered empty page
 * does mean this account has access to nothing, but saying so is the content
 * column's job (`ServiceManagementView`) — it is the surface that would
 * otherwise be telling the user to pick from this empty list. Here the fact gets
 * one line, and the way out lives at the foot where it is reachable from every
 * state, search misses included.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { passRoutes } from '@/lib/routes';
import { ServiceSidebar } from '@/app/components/features/admin/ServiceSidebar';

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
      // 힌트는 opt-in 이다. 이 헬퍼가 켜 두는 건 아래 케이스들이 지키려는 게 "켜면 모든
      // 상태에서 선다" 이기 때문이고, 꺼졌을 때 안 선다는 쪽은 자기 테스트가 따로 잡는다.
      showAccessHint
      {...props}
    />,
  );

const hint = (container: HTMLElement) => {
  const zone = container.querySelector('div.border-t');
  return {
    text: zone?.textContent ?? '',
    href: zone?.querySelector('a')?.getAttribute('href'),
  };
};

describe('ServiceSidebar 바닥의 상시 힌트', () => {
  it.each([
    ['목록이 있을 때', { services: [{ service_code: 'AAA', service_name: '가나다' }], pageInfo: pageInfo(1) }],
    ['목록이 비었을 때', {}],
    ['검색 결과가 없을 때', { searchQuery: 'zzz' }],
    ['아직 로딩 중일 때', { loading: true }],
  ])('%s 도 권한 요청으로 나가는 길을 남긴다', (_label, props) => {
    const { container, unmount } = mount(props);
    // 목록이 답을 못 주는 순간이 정확히 이 줄이 필요한 순간이다 — 로딩 중에도 붙박이다.
    expect(hint(container).text).toContain(STANDING_HINT);
    expect(hint(container).href).toBe(passRoutes.accessRequests);
    unmount();
  });

  it('기본값은 꺼짐이다 — 설치 마법사 레일이 이 링크를 물려받으면 안 된다', () => {
    // 같은 레일의 둘째 host(`ServiceListPanel`)에서 이건 서비스 전환기다. 거기서
    // 내 권한 요청 으로 나가는 링크는 진행 중인 마법사 밖으로 걸어 나가는 길이 된다.
    // opt-in 이라, 새 host 는 물려받는 게 아니라 정하게 된다. (오너 판단 2026-08-21)
    const { container, unmount } = mount({ showAccessHint: undefined });
    expect(container.textContent).not.toContain(STANDING_HINT);
    expect(container.querySelectorAll(`a[href="${passRoutes.accessRequests}"]`).length).toBe(0);
    unmount();
  });
});

describe('ServiceSidebar 의 빈 목록', () => {
  it('검색 없이 0건이면 사실만 말하고 권한을 판정하지 않는다', () => {
    const { container, unmount } = mount({});
    expect(container.textContent).toContain('서비스가 없습니다');
    // 무권한이라는 판정과 그 해결책은 콘텐츠 열이 갖는다. 296px 레일에 같은 CTA 가
    // 둘이 서지 않도록, 여기 있는 링크는 바닥 힌트 하나뿐이다.
    expect(container.querySelectorAll(`a[href="${passRoutes.accessRequests}"]`).length).toBe(1);
    unmount();
  });

  it('검색 결과 0건은 검색 문장으로 갈린다', () => {
    const { container, unmount } = mount({ searchQuery: 'zzz' });
    expect(container.textContent).toContain('‘zzz’와 일치하는 서비스가 없습니다');
    unmount();
  });

  it('로딩 중에는 빈 문장 대신 스켈레톤을 세운다', () => {
    const { container, unmount } = mount({ loading: true });
    expect(container.textContent).not.toContain('서비스가 없습니다');
    expect(container.querySelectorAll('li[aria-hidden="true"]').length).toBe(8);
    unmount();
  });
});
