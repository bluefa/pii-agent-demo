// @vitest-environment jsdom
/**
 * 무권한 안내는 **권한에 대한 판정**이라, 목록이 비었다는 사실만으로 말할 수 없다.
 *
 * 여기서 지키는 줄은 `fetchServicesPage` 의 `if (!searchQuery)` 하나다. 그게 빠지면
 * 검색어를 잘못 친 사람에게 "아직 접근 권한이 있는 서비스가 없습니다" 가 뜬다 — 화면이
 * 거짓 판정을 내리는 건데, 레일 쪽 테스트(`ServiceSidebar.states.test.tsx`)는 초록으로
 * 남는다. 그 문장은 레일이 아니라 이 콘텐츠 칸에만 살기 때문이다.
 *
 * 세 번째 케이스가 지키는 건 `!servicesLoaded` 게이트다. 없으면 첫 응답 전에
 * 서비스를 선택하세요 를 그렸다가 무권한 안내로 바꿔 다는 깜빡임이 돌아온다.
 *
 * 이 저장소에는 RTL 자동 cleanup 이 없다 — 모든 render 는 스스로 unmount 한다.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ServiceManagementView } from '@/app/services/_components/ServiceManagementView';
import type { PageServiceItem } from '@/app/lib/api';

const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

const getServicesPage = vi.fn();

vi.mock('@/app/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/api')>();
  return {
    ...actual,
    getServicesPage: (...args: unknown[]) => getServicesPage(...args),
    getProjects: vi.fn(async () => []),
  };
});

const NO_ACCESS = '아직 접근 권한이 있는 서비스가 없습니다';
const PICK_ONE = '서비스를 선택하세요';

/** `as` 캐스트를 쓰지 않는다 — 계약에 필드가 늘어나면 픽스처가 먼저 컴파일에서 걸린다. */
type ServiceItem = NonNullable<PageServiceItem['content']>[number];

const service = (id: number, code: string): ServiceItem => ({
  id,
  service_code: code,
  service_name: code,
});

const page = (content: ServiceItem[]): PageServiceItem => ({
  content,
  totalElements: content.length,
  totalPages: content.length === 0 ? 0 : 1,
  number: 0,
  size: 8,
});

describe('무권한 안내는 무필터 응답에서만 나온다', () => {
  beforeEach(() => {
    getServicesPage.mockReset();
  });

  it('검색어 없이 0건이면 — 완전한 집합이라 권한을 말할 수 있다', async () => {
    getServicesPage.mockResolvedValue(page([]));

    const { container, unmount } = render(<ServiceManagementView />);
    await waitFor(() => expect(container.textContent).toContain(NO_ACCESS));
    unmount();
  });

  it('검색이 0건을 돌려줘도 판정을 뒤집지 않는다 — 걸러진 0건은 부분집합이다', async () => {
    getServicesPage.mockResolvedValue(page([service(1, 'PAY'), service(2, 'DLV'), service(3, 'CPN')]));

    const { container, unmount } = render(<ServiceManagementView />);
    await waitFor(() => expect(container.textContent).toContain(PICK_ONE));

    // 이제 검색이 0건을 돌려준다. 이 응답은 "이 계정에 서비스가 없다"가 아니라
    // "이 검색어에 맞는 게 없다"이므로, 무권한 안내가 나오면 안 된다.
    getServicesPage.mockResolvedValue(page([]));
    const search = container.querySelector('input');
    expect(search).not.toBeNull();
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(search as HTMLInputElement, { target: { value: 'zzzzq' } });

    await waitFor(() => expect(getServicesPage).toHaveBeenCalledTimes(2));
    expect(container.textContent).not.toContain(NO_ACCESS);
    unmount();
  });

  it('첫 응답이 오기 전에는 어느 쪽도 말하지 않는다', () => {
    getServicesPage.mockReturnValue(new Promise(() => {}));

    const { container, unmount } = render(<ServiceManagementView />);
    expect(container.textContent).not.toContain(NO_ACCESS);
    expect(container.textContent).not.toContain(PICK_ONE);
    unmount();
  });
});
