// @vitest-environment jsdom
/**
 * P2 연동 요청 — the rail owns which view is on screen.
 *
 * What is pinned here is what the redesign can silently lose:
 *   1. 세 뷰 중 하나만 표가 된다 — 레일이 나머지 둘을 대신 말한다.
 *   2. 안 보이는 뷰의 건수도 사실이어야 하므로 셋 다 첫 페이지를 읽는다. 그러나
 *      도착 전에는 '0' 이 아니라 아무것도 쓰지 않는다.
 *   3. 뷰를 바꾸면 표가 바뀌고 주소가 따라온다 — replace 이므로 기록은 늘지 않는다.
 *   4. `?view=` 딥링크는 첫 페인트부터 그 뷰다.
 *   5. 페이지를 넘겨도 고른 뷰만 다시 읽는다.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApprovalHistoryRow, Paged, RequestListRow } from '@/lib/types/task-queue';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin/pipelines/queue/requests',
}));

const getRequestList = vi.fn();
const getApprovalHistory = vi.fn();

vi.mock('@/app/lib/api/task-queue-requests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/api/task-queue-requests')>();
  return {
    ...actual,
    getRequestList: (...args: unknown[]) => getRequestList(...args),
    getApprovalHistory: (...args: unknown[]) => getApprovalHistory(...args),
  };
});

import { RequestsView } from '@/app/admin/pipelines/queue/requests/_components/RequestsView';
import { requestView } from '@/app/admin/pipelines/queue/requests/_views';

const row = (over: Partial<RequestListRow> = {}): RequestListRow => ({
  targetSourceId: 1801,
  serviceName: '정산서비스',
  description: '정산 마감 배치 RDS',
  serviceCode: 'STL',
  cloudProvider: 'AWS',
  confirmStatus: 'PENDING',
  latestApprovalRequest: {
    requestId: 91,
    status: 'PENDING',
    reason: null,
    requestedAt: '2026-08-20T02:00:00Z',
    processedAt: null,
  },
  ...over,
});

const historyRow: ApprovalHistoryRow = {
  historyRecordId: 7,
  requestId: 91,
  targetSourceId: 1801,
  status: 'APPROVED',
  createdAt: '2026-08-22T02:00:00Z',
  serviceName: '이력서비스',
  serviceCode: 'HIS',
  actorId: 'admin@example.com',
  cloudProvider: 'AWS',
};

const paged = <T,>(content: T[], totalElements: number, totalPages = 1): Paged<T> => ({
  content,
  totalElements,
  totalPages,
  number: 0,
  size: 8,
  first: true,
  last: totalPages <= 1,
  numberOfElements: content.length,
  empty: content.length === 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/queue/requests');
  getRequestList.mockImplementation((status: string) =>
    Promise.resolve(
      status === 'PENDING'
        ? paged([row()], 3)
        : paged([row({ serviceName: '반려서비스', serviceCode: 'REJ' })], 2),
    ),
  );
  getApprovalHistory.mockResolvedValue(paged([historyRow], 41));
});

const draw = async (initial: 'pending' | 'rejected' | 'history' = 'pending'): Promise<void> => {
  await act(async () => {
    render(<RequestsView initialView={initial} />);
  });
};

describe('`?view=` 는 세 값만 인정한다', () => {
  it('아는 값은 그대로, 모르는 값과 빈 값은 승인 대기로', () => {
    expect(requestView('rejected')).toBe('rejected');
    expect(requestView('history')).toBe('history');
    expect(requestView('nope')).toBe('pending');
    expect(requestView(undefined)).toBe('pending');
  });
});

describe('레일이 표 한 장을 고른다', () => {
  it('고른 뷰만 표가 되고, 나머지 둘은 레일 항목으로만 있다', async () => {
    await draw();

    expect(screen.getByRole('table', { name: '연동 요청 확인 목록' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: '연동 요청 반려 확인 목록' })).toBeNull();
    expect(screen.queryByRole('table', { name: '전체 History 확인 목록' })).toBeNull();

    const rail = screen.getByRole('navigation', { name: '연동 요청 보기' });
    expect(
      Array.from(rail.querySelectorAll('button')).map((b) => b.textContent),
    ).toEqual(['승인 대기3', '반려 미확인2', '전체 이력41']);
  });

  it('고른 항목만 aria-current 를 든다', async () => {
    await draw('history');
    expect(screen.getByRole('button', { name: /전체 이력/ }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('button', { name: /승인 대기/ }).getAttribute('aria-current')).toBeNull();
  });

  it('건수가 도착하기 전에는 수를 쓰지 않는다 — 0 이라고도 말하지 않는다', async () => {
    getRequestList.mockImplementation(() => new Promise<never>(() => {}));
    getApprovalHistory.mockImplementation(() => new Promise<never>(() => {}));
    await draw();

    const rail = screen.getByRole('navigation', { name: '연동 요청 보기' });
    expect(Array.from(rail.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      '승인 대기',
      '반려 미확인',
      '전체 이력',
    ]);
  });
});

describe('보이지 않는 뷰의 건수도 읽는다', () => {
  it('진입에 세 뷰가 각각 첫 페이지를 한 번씩 읽는다', async () => {
    await draw();
    expect(getRequestList.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['PENDING', 0],
      ['REJECTED', 0],
    ]);
    expect(getApprovalHistory).toHaveBeenCalledTimes(1);
    expect(getApprovalHistory.mock.calls[0][0]).toBe(0);
  });
});

describe('뷰를 바꾸면 표와 주소가 함께 바뀐다', () => {
  it('표가 갈리고 ?view= 가 따라온다', async () => {
    await draw();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /반려 미확인/ }));
    });

    expect(screen.getByRole('table', { name: '연동 요청 반려 확인 목록' })).toBeTruthy();
    expect(screen.getByText('반려서비스')).toBeTruthy();
    expect(window.location.search).toBe('?view=rejected');
  });

  it('바꿔도 그 뷰를 다시 읽지 않는다 — 이미 손에 있다', async () => {
    await draw();
    const before = getRequestList.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /반려 미확인/ }));
    });

    expect(getRequestList.mock.calls.length).toBe(before);
  });

  it('?view=rejected 딥링크는 첫 페인트부터 반려 뷰다', async () => {
    await draw('rejected');
    expect(screen.getByRole('table', { name: '연동 요청 반려 확인 목록' })).toBeTruthy();
  });
});

describe('페이지는 고른 뷰만 넘어간다', () => {
  it('다음 페이지는 고른 뷰만 다시 읽는다', async () => {
    getRequestList.mockImplementation((status: string) =>
      Promise.resolve(
        status === 'PENDING' ? paged([row()], 20, 3) : paged([row({ serviceCode: 'REJ' })], 2),
      ),
    );
    await draw();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }));
    });

    await waitFor(() =>
      expect(getRequestList.mock.calls.map((c) => [c[0], c[1]])).toEqual([
        ['PENDING', 0],
        ['REJECTED', 0],
        ['PENDING', 1],
      ]),
    );
    expect(getApprovalHistory).toHaveBeenCalledTimes(1);
  });
});

describe('일곱 열짜리 이력만 옆으로 민다', () => {
  it('전체 이력의 행 블록에만 바닥값이 있고, 두 작업 뷰에는 없다', async () => {
    await draw('history');
    // 바닥값은 스크롤러가 아니라 **안쪽** 블록에 있어야 한다 — 블록의 scrollWidth 는
    // 제 상자 폭이라, 안쪽에 min-width 가 없으면 넘칠 것이 없어 스크롤러가 안 열린다.
    const historyRows = screen.getByRole('table', { name: '전체 History 확인 목록' });
    expect(historyRows.className).toContain('min-w-[704px]');
    expect(historyRows.parentElement?.className).toContain('overflow-x-auto');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /승인 대기/ }));
    });
    expect(screen.getByRole('table', { name: '연동 요청 확인 목록' }).className).not.toContain(
      'min-w-',
    );
  });
});

describe('행은 여전히 상세로 간다', () => {
  it('작업 뷰의 행은 상세 링크를 품고, 이력 행은 품지 않는다', async () => {
    await draw();
    expect(
      screen.getByRole('link', { name: '정산서비스 연동 요청 상세 보기' }).getAttribute('href'),
    ).toBe('/admin/pipelines/queue/requests/1801');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /전체 이력/ }));
    });
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});
