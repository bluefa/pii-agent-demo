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
// 존재이지 동작이 아니므로 최소한만 세운다.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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

  it('SDU 대상은 카드를 그리지 않고, 비싼 네 건을 아예 쏘지 않는다', async () => {
    get.mockResolvedValue({ target_source_id: 1029, cloud_provider: 'AWS', metadata: { is_sdu_type: true } });
    expect(await StatusCard({ targetSourceId: 1029 })).toBeNull();
    expect(getDagStatus).not.toHaveBeenCalled();
    expect(getHistory).not.toHaveBeenCalled();
    expect(getTerraformStatus).not.toHaveBeenCalled();
    expect(getTestConnectionLatest).not.toHaveBeenCalled();
  });

  it('404 는 「없음」이고 그 밖의 거절만 「조회 실패」다', async () => {
    getTestConnectionLatest.mockImplementation(rejected);
    await draw();
    // 스캔은 404 → 실행 없음, 연결 테스트는 503 → 조회 실패.
    expect(screen.getByText('실행 없음')).toBeTruthy();
    expect(screen.getByText('조회 실패')).toBeTruthy();
    expect(screen.getByRole('button', { name: '연결 테스트 다시 조회' })).toBeTruthy();
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
