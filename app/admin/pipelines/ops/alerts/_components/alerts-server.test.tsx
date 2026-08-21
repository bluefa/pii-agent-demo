// @vitest-environment jsdom
/**
 * 운영 알림 — **서버 쪽** 축. `alerts.test.tsx` 가 props 를 받은 뒤의 렌더를 박는다면,
 * 여기서는 그 props 가 만들어지기까지를 박는다.
 *
 * 서버 컴포넌트는 element 를 resolve 하는 async 함수라, 여기서는 그것을 await 해서
 * 나온 트리를 그대로 render 한다 — 아래 `AlertWorklist` 는 클라이언트 컴포넌트라
 * jsdom 이 그릴 수 있다.
 *
 * 박는 것 셋:
 *  ① 목록 실패가 화면을 비우지 않고 자기 문장을 받는다
 *  ② 범위 밖 페이지는 빈 목록이 아니라 마지막 페이지로 되돌아간다
 *  ③ 요약 실패는 0 건이 아니다 — 건수 자리가 사라지지 값이 지어지지 않는다
 */
import { isValidElement, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { passRoutes } from '@/lib/routes';

const getAlertTargetSources = vi.hoisted(() => vi.fn());
const getDashboardSummary = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    // 진짜 redirect 처럼 흐름을 끊는다 — 이어서 렌더되면 이동이 안 일어난 것이다.
    throw new Error(`REDIRECT:${url}`);
  }),
);

vi.mock('@/lib/bff/client', () => ({
  bff: { taskQueue: { getAlertTargetSources, getDashboardSummary } },
}));
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ push: vi.fn() }) }));

import { AlertWorklistSection } from '@/app/admin/pipelines/ops/alerts/_components/AlertWorklistSection';
import { AlertsHeader } from '@/app/admin/pipelines/ops/alerts/_components/AlertsHeader';
import { pageIndexFromParam } from '@/app/admin/pipelines/ops/alerts/_components/buckets';
import OpsAlertsPage from '@/app/admin/pipelines/ops/alerts/page';

const wirePage = (content: unknown[], number: number, totalPages: number) => ({
  content,
  number,
  totalPages,
  totalElements: content.length,
  size: 10,
  first: number === 0,
  last: number >= totalPages - 1,
  numberOfElements: content.length,
  empty: content.length === 0,
});

const ROW = {
  targetSourceId: 1861,
  serviceName: '정산서비스',
  serviceCode: 'STL',
  cloudProvider: 'AWS',
  confirmStatus: 'CONFIRMED',
};

const section = (pageIndex: number, count: number | null = 3) =>
  AlertWorklistSection({ kind: 'need-install', pageIndex, size: 10, count });

/**
 * `page.tsx` 가 Suspense 안에 매달아 둔 서버 컴포넌트를 찾아 실제로 실행한다.
 *
 * render() 만으로는 그 자식이 안 돈다 — Suspense 는 fallback 을 그리고 멈춘다. 그래서
 * page.tsx 가 계산한 props(여기서는 변환된 페이지 인덱스)가 계약까지 갔는지 보려면
 * 트리에서 그 element 를 찾아 직접 호출해야 한다.
 */
const resolveSuspendedChild = async (node: ReactNode): Promise<void> => {
  if (Array.isArray(node)) {
    for (const child of node) await resolveSuspendedChild(child);
    return;
  }
  if (!isValidElement(node)) return;
  if (node.type === AlertWorklistSection) {
    await AlertWorklistSection(node.props as Parameters<typeof AlertWorklistSection>[0]);
    return;
  }
  const { children } = node.props as { children?: ReactNode };
  await resolveSuspendedChild(children);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AlertWorklistSection — 서버가 한 페이지를 읽는다', () => {
  it('목록 조회가 실패해도 표는 서고, 자기 실패를 말한다', async () => {
    getAlertTargetSources.mockRejectedValue(new Error('upstream 503'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(await section(0));

    expect(screen.getByText('목록을 불러오지 못했습니다.')).toBeDefined();
    // 실패는 빈 결과가 아니다 — 0건 문장을 받아서는 안 된다.
    expect(screen.queryByText('해당 단계의 대상이 없습니다.')).toBeNull();
    // 그리고 타일·머리글까지 데려가지 않는다: 이 컴포넌트는 throw 하지 않는다.
    expect(screen.getByText('설치 필요')).toBeDefined();
  });

  it('범위 밖 페이지는 마지막 페이지로 되돌린다 — 빈 목록으로 그리지 않는다', async () => {
    // 공유받은 `?page=99` 의 실제 응답 모양: content 는 비었는데 totalPages 는 살아 있다.
    getAlertTargetSources.mockResolvedValue(wirePage([], 98, 2));

    await expect(section(98)).rejects.toThrow(
      `REDIRECT:${passRoutes.pipelines.ops.alerts}?kind=need-install&page=2`,
    );
    expect(redirect).toHaveBeenCalledOnce();
  });

  it('마지막 페이지가 진짜 0건이면 되돌리지 않는다', async () => {
    getAlertTargetSources.mockResolvedValue(wirePage([], 0, 0));

    render(await section(0, 0));

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByText('해당 단계의 대상이 없습니다.')).toBeDefined();
  });

  it.each([
    ['content 가 없는 봉투', { number: 0, totalPages: 2 }],
    ['totalPages 가 없는 봉투', { content: [ROW], number: 0 }],
  ])('%s 는 실패다 — 빈 목록으로도 1 페이지로도 접지 않는다', async (_label, envelope) => {
    // LOOSE 스키마라 이런 응답도 parse 를 통과한다. 접으면 화면은 "대상이 없습니다"를
    // 말하거나 2 페이지를 1 페이지로 되돌린다 — 둘 다 못 읽은 것을 읽은 척하는 문장이다.
    getAlertTargetSources.mockResolvedValue(envelope);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(await section(0));

    expect(screen.getByText('목록을 불러오지 못했습니다.')).toBeDefined();
    expect(screen.queryByText('해당 단계의 대상이 없습니다.')).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('조회 실패에는 되돌리기도 페이저도 없다 — 넘길 페이지를 모르는 상태다', async () => {
    getAlertTargetSources.mockRejectedValue(new Error('upstream 503'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(await section(98));

    expect(redirect).not.toHaveBeenCalled();
    // 실패하면 totalPages 는 1 로 떨어지는데 주소의 page 는 98 그대로다. 페이저를
    // 그대로 두면 "이전" 이 살아 있어 또 다른 잘못된 주소를 밀게 된다.
    expect(screen.queryByLabelText('이전 페이지')).toBeNull();
    expect(screen.queryByLabelText('다음 페이지')).toBeNull();
  });

  it('요약을 못 읽었으면(count=null) 건수 조각이 빠진다 — 0 이라 적지 않는다', async () => {
    getAlertTargetSources.mockResolvedValue(wirePage([ROW], 0, 1));

    render(await section(0, null));

    expect(screen.getByText('설치 필요')).toBeDefined();
    expect(screen.getByText('인프라 담당')).toBeDefined();
    expect(screen.queryByText('0')).toBeNull();
    // 건수 조각이 없으면 그 앞 구분점도 남지 않는다.
    expect(screen.queryByText('건')).toBeNull();
  });
});

describe('AlertsHeader — 요약 실패는 0 건이 아니다', () => {
  it('총계 문장이 건수를 지어내지 않고 못 읽었다고 말한다', () => {
    render(<AlertsHeader total={null} counts={null} selected="need-install" />);

    expect(screen.getByText(/건수를 불러오지 못했어요/)).toBeDefined();
    // 네 타일 모두 값 대신 '—' 를 든다.
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('0')).toBeNull();
  });
});

describe('page.tsx — 주소와 요약이 props 가 되기까지', () => {
  const FULL_SUMMARY = {
    confirming_count: 2,
    need_install_count: 3,
    need_test_connection_count: 3,
    need_pii_agent_confirm_count: 3,
  };

  /** 페이지는 목록을 Suspense 안에서 스트리밍한다. 여기서 보는 것은 머리글(타일)이고,
   *  표 자리에는 스켈레톤이 든다 — 요약이 props 가 되는 경로만 보면 되므로 충분하다. */
  const renderPage = async (params: { kind?: string; page?: string }) =>
    render(await OpsAlertsPage({ searchParams: Promise.resolve(params) }));

  it('요약 조회가 깨지면 타일은 0 이 아니라 모른다고 그린다', async () => {
    getDashboardSummary.mockRejectedValue(new Error('upstream 503'));
    getAlertTargetSources.mockResolvedValue(wirePage([ROW], 0, 1));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await renderPage({ kind: 'need-install' });

    expect(screen.getByText(/건수를 불러오지 못했어요/)).toBeDefined();
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('200 이어도 건수 하나가 비면 모른다 — LOOSE 스키마는 빠진 필드를 통과시킨다', async () => {
    getDashboardSummary.mockResolvedValue({ ...FULL_SUMMARY, need_install_count: null });
    getAlertTargetSources.mockResolvedValue(wirePage([ROW], 0, 1));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await renderPage({ kind: 'need-install' });

    // 빠진 건수가 '0' 으로 접히면 이 줄이 안 뜬다.
    expect(screen.getByText(/건수를 불러오지 못했어요/)).toBeDefined();
  });

  it('요약이 온전하면 총계와 타일 값을 그대로 싣는다', async () => {
    getDashboardSummary.mockResolvedValue(FULL_SUMMARY);
    getAlertTargetSources.mockResolvedValue(wirePage([ROW], 0, 1));

    await renderPage({ kind: 'need-install' });

    expect(screen.getByText('11')).toBeDefined(); // 2 + 3 + 3 + 3
    expect(screen.queryByText(/건수를 불러오지 못했어요/)).toBeNull();
  });

  it('주소의 1-based page 가 계약의 0-based 로 요청에 실린다', async () => {
    getDashboardSummary.mockResolvedValue(FULL_SUMMARY);
    getAlertTargetSources.mockResolvedValue(wirePage([ROW], 1, 2));

    // 페이지는 Suspense 안에서 스트리밍되므로 render 만으로는 요청이 안 나간다 —
    // 그 자식을 직접 await 해서 변환된 값이 계약에 도착하는지 본다.
    const tree = await OpsAlertsPage({
      searchParams: Promise.resolve({ kind: 'need-install', page: '2' }),
    });
    await resolveSuspendedChild(tree);

    expect(getAlertTargetSources).toHaveBeenCalledWith({
      kind: 'need-install',
      page: 1,
      size: 10,
    });
  });
});

describe('pageIndexFromParam — 주소는 1-based, 계약은 0-based', () => {
  it('1-based 주소를 계약 인덱스로 한 번만 내린다', () => {
    expect(pageIndexFromParam('2')).toBe(1);
    expect(pageIndexFromParam('99')).toBe(98);
  });

  it('없거나 말이 안 되는 값은 첫 페이지다', () => {
    // '0' 과 음수는 1-based 주소에 존재하지 않는 자리고, 소수·문자는 페이지가 아니다.
    for (const raw of [undefined, '', '1', '0', '-3', '1.5', 'abc']) {
      expect(pageIndexFromParam(raw)).toBe(0);
    }
  });
});
