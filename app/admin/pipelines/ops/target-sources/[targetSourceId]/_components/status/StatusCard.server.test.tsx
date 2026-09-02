// @vitest-environment jsdom
/**
 * 연동 현황 카드의 **서버 쪽** 축. `statusRows.test.ts` 가 접기(wire → 행)를 박는다면,
 * 여기서는 그 wire 가 만들어지기까지 — 무엇을 부르고, 무엇을 안 부르고, 거절과 404 를
 * 어떻게 가르는지 — 를 박는다. 순수 테스트는 이 배선을 볼 수 없다.
 *
 * 서버 컴포넌트는 element 를 resolve 하는 async 함수라 그대로 await 해서 렌더한다
 * (`ops/alerts/_components/alerts-server.test.tsx` 와 같은 방법).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { BffError } from '@/lib/bff/errors';

const get = vi.hoisted(() => vi.fn());
const getHistory = vi.hoisted(() => vi.fn());
const getTestConnectionLatest = vi.hoisted(() => vi.fn());
const getTerraformStatus = vi.hoisted(() => vi.fn());
const getDagStatus = vi.hoisted(() => vi.fn());

// 「다시 시도」가 client 컴포넌트라 라우터가 필요하다 — 이 축이 보는 것은 그 버튼의
// 존재이지 동작이 아니므로 최소한만 세운다. `redirect` 는 진짜처럼 던진다: 만료된
// 세션은 카드를 그리다 말고 렌더를 풀고 나간다.
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const inbound = vi.hoisted(() => ({ current: new Headers() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), redirect: redirectMock }));
// proxy.ts 가 실어 주는 요청 경로 — 재로그인 뒤 돌아올 자리다.
vi.mock('next/headers', () => ({ headers: async () => inbound.current }));

vi.mock('@/lib/bff/client', () => ({
  bff: {
    targetSources: { get },
    scan: { getHistory },
    confirm: { getTestConnectionLatest, getTerraformStatus },
    ops: { getDagStatus },
  },
}));

import { StatusCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/status/StatusCard';

const notFound = () => Promise.reject(new BffError(404, 'NOT_FOUND', 'none'));
const rejected = () => Promise.reject(new BffError(503, 'UPSTREAM', 'down'));

const draw = async (): Promise<void> => {
  const tree = await StatusCard({ targetSourceId: 1029 });
  if (tree) render(tree);
};

beforeEach(() => {
  vi.clearAllMocks();
  inbound.current = new Headers();
  get.mockResolvedValue({ target_source_id: 1029, cloud_provider: 'AWS', metadata: {} });
  getHistory.mockImplementation(notFound);
  getTestConnectionLatest.mockImplementation(notFound);
  getTerraformStatus.mockResolvedValue({ cloud_provider: 'AWS', has_confirmed_infra: false, tasks: [] });
  getDagStatus.mockImplementation(notFound);
});

describe('StatusCard — 서버가 무엇을 묻는가', () => {
  it('§10 dag-status 를 단계와 무관하게 부른다 (오너 2026-08-30)', async () => {
    await draw();
    expect(getDagStatus).toHaveBeenCalledWith(1029);
  });

  it('단계를 말하는 행이 없으므로 process-status 는 부르지 않는다', async () => {
    await draw();
    // 이 카드의 bff 표면에 confirm.getProcessStatus 가 없다는 것으로 못을 박는다 —
    // 부르는 순간 mock 이 없어 TypeError 가 나므로 위 draw() 가 통과할 수 없다.
    expect(getHistory).toHaveBeenCalledTimes(1);
    expect(getTerraformStatus).toHaveBeenCalledTimes(1);
    expect(getTestConnectionLatest).toHaveBeenCalledTimes(1);
  });

  /**
   * 뒤집힌 단언이다. 이 카드는 SDU 에서 조기 반환하며 「본문이 안내 한 장이라 나오지도
   * 않는다」고 적고 있었는데, 그 안내가 사라지고 SDU 도 진행 상태 탭을 받는다. 조기
   * 반환이 살아 있으면 그 탭의 오른쪽 칸이 빈 채로 선다 — 화면에서만 보이고 타입은
   * 통과하는 자리라, 배선을 보는 이 축이 아니면 아무도 못 잡는다.
   */
  it('SDU 대상도 카드를 받고, 다섯 행이 읽는 네 건을 그대로 쏜다', async () => {
    get.mockResolvedValue({ target_source_id: 1029, cloud_provider: 'AWS', metadata: { is_sdu_type: true } });
    await draw();
    expect(screen.getByRole('region', { name: '연동 현황' })).toBeTruthy();
    expect(getDagStatus).toHaveBeenCalledTimes(1);
    expect(getHistory).toHaveBeenCalledTimes(1);
    expect(getTerraformStatus).toHaveBeenCalledTimes(1);
    expect(getTestConnectionLatest).toHaveBeenCalledTimes(1);
  });

  it('cloud_provider 가 SDU 로 와도 스캔 행은 선다 — SDU 는 스캔 탭을 잃지 않는다', async () => {
    // normalizeCloudProvider('SDU') 는 'AWS' 라 IDC 판정에 걸리지 않는다. 다섯 행이
    // 가리키는 탭은 SDU 에도 전부 있다(계약 §9).
    get.mockResolvedValue({ target_source_id: 1099, cloud_provider: 'SDU', metadata: { is_sdu_type: true } });
    await draw();
    expect(screen.getByText('스캔')).toBeTruthy();
  });

  it('404 는 「없음」이고 그 밖의 거절만 「조회 실패」다', async () => {
    getTestConnectionLatest.mockImplementation(rejected);
    await draw();
    // 스캔은 404 → 실행 없음, 연결 테스트는 503 → 조회 실패.
    expect(screen.getByText('실행 없음')).toBeTruthy();
    expect(screen.getByText('조회 실패')).toBeTruthy();
    expect(screen.getByRole('button', { name: '연결 테스트 다시 조회' })).toBeTruthy();
  });

  /**
   * 만료된 세션은 「조회 실패」가 아니다(ADR-008 §91). 이 탭은 브라우저 fetch 가 없어서
   * soft navigation 으로 들어오면 레이아웃도 다시 안 돌고 — 여기서 안 잡으면 운영자는
   * 다시 로그인만 하면 되는 화면 앞에서 다섯 행짜리 실패를 읽는다.
   *
   * 던져진 이동은 이 `Suspense` 경계 안에서 나지만 Next 가 스트리밍 중에도 받는다.
   */
  it('401 은 행을 그리지 않고 보던 경로로 돌아오는 로그인을 연다', async () => {
    // 헤더는 ByteString 이라 한글 탭 슬러그는 퍼센트 인코딩된 채로 실린다 —
    // `nextUrl.search` 가 주는 것이 이미 그 모양이다.
    const path = `/pass/admin/pipelines/ops/target-sources/1029?tab=${encodeURIComponent('진행 상태')}`;
    inbound.current = new Headers({ 'x-pathname': path });
    get.mockRejectedValue(new BffError(401, 'UNAUTHORIZED', 'token expired'));

    await expect(draw()).rejects.toThrow(
      `NEXT_REDIRECT:/sso/login?returnTo=${encodeURIComponent(path)}`,
    );
    expect(screen.queryByText('조회 실패')).toBeNull();
  });

  it('terraform 이 죽어도 IDC 판정은 상세가 진다 — 없는 스캔 행이 서지 않는다', async () => {
    get.mockResolvedValue({ target_source_id: 1583, cloud_provider: 'IDC', metadata: {} });
    getTerraformStatus.mockImplementation(rejected);
    await draw();
    expect(screen.queryByText('스캔')).toBeNull();
    // 같은 응답이 채우던 두 행은 함께 모른다고 말한다.
    expect(screen.getAllByText('조회 실패')).toHaveLength(2);
  });
});
