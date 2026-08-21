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
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { passRoutes } from '@/lib/routes';

const getAlertTargetSources = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    // 진짜 redirect 처럼 흐름을 끊는다 — 이어서 렌더되면 이동이 안 일어난 것이다.
    throw new Error(`REDIRECT:${url}`);
  }),
);

vi.mock('@/lib/bff/client', () => ({ bff: { taskQueue: { getAlertTargetSources } } }));
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ push: vi.fn() }) }));

import { AlertWorklistSection } from '@/app/admin/pipelines/ops/alerts/_components/AlertWorklistSection';
import { AlertsHeader } from '@/app/admin/pipelines/ops/alerts/_components/AlertsHeader';

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

  it('조회 실패에는 되돌리기를 걸지 않는다 — 페이지 수를 모르는 상태다', async () => {
    getAlertTargetSources.mockRejectedValue(new Error('upstream 503'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(await section(98));

    expect(redirect).not.toHaveBeenCalled();
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
