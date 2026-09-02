// @vitest-environment jsdom
/**
 * Airflow 확인 탭의 대기 프레임.
 *
 * §10 이 도는 동안 이 탭에는 판정 문장 하나만 있었다 — 카운트 줄도 에이전트 표도 정착본
 * 에서만 그려져서, 응답이 도착하는 순간 그 둘이 통째로 들어서며 탭이 뛰었다.
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A spy, not a fixed stub: 확정 스냅샷은 §10 과 **다른** 조회라, 이 탭이 그 둘의 시차를
// 어떻게 그리는지는 「아직 안 온 상태」를 만들 수 있어야 보인다.
const getConfirmedIntegration = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: (...args: unknown[]) => getConfirmedIntegration(...args),
}));

import { AirflowTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AirflowTab';
import type { DagStatusResponse } from '@/lib/types/dag-status';

const DAG: DagStatusResponse = {
  targetSourceId: 1642,
  connectionStatus: 'SUCCESS',
  healthStatus: 'HEALTHY',
  timezone: 'Asia/Seoul',
  agents: [
    {
      agentId: 'agent-1',
      resourceId: 'arn:aws:rds:ap-northeast-2:1:db:orders',
      gcpRegion: null,
      connectionStatus: 'SUCCESS',
      databaseStatuses: [
        {
          databaseUri: 'mysql://orders/app',
          databaseName: 'app',
          schemaName: null,
          dagName: 'dag-app',
          namespace: null,
          succeededThisWeek: true,
          lastSuccessAt: '2026-09-01T00:00:00Z',
          days: Array.from({ length: 7 }, () => ({
            day: '2026-08-27',
            status: 'SUCCESS',
            successTime: '2026-08-27T00:00:00Z',
          })),
        },
      ],
    },
  ],
};

describe('AirflowTab — 대기 프레임', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfirmedIntegration.mockResolvedValue({ resource_infos: [] });
  });

  it('DAG 상태를 기다리는 동안 카운트 줄과 표의 자국을 그린다', async () => {
    const { container } = render(
      <AirflowTab targetSourceId={1642} isIdc={false} dag={{ phase: 'loading' }} />,
    );
    // 확정 스냅샷 조회(best-effort)가 테스트 밖에서 상태를 건드리지 않게 한 틱 흘린다.
    await act(async () => {});

    // 머리의 메타 슬롯 + 카운트 줄 + 표(머리 1 · 본문 3) — 정착본이 서는 자리마다 하나씩.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(1);
    // 형제 스켈레톤과 같은 문법 — 자국만 그리고 기다린다고 말하지 않으면 낭독은 빈 탭을 읽는다.
    const busy = container.querySelector('[aria-busy]');
    expect(busy).not.toBeNull();
    expect(busy?.textContent).toContain('불러오는 중');
    // 판정 문장은 그대로다 — 스켈레톤이 대신하지 않는다.
    expect(container.textContent).toContain('모니터링 상태를 확인하고 있어요.');
  });

  /**
   * §10 이 먼저 도착하는 창 — 표는 그 순간 서지만 이름·엔진·리전은 확정 정보에서 온다.
   * 그 칸을 대시로 그리면 표가 「이 리소스에는 이름이 없다」고 말했다가 값을 채워 넣는다.
   */
  it('확정 정보를 기다리는 동안 표의 빌린 칸은 대시가 아니다', async () => {
    getConfirmedIntegration.mockReturnValue(new Promise(() => {}));
    render(
      <AirflowTab
        targetSourceId={1642}
        isIdc={false}
        dag={{ phase: 'loaded', data: DAG, fetchedAt: '2026-09-02T00:00:00Z' }}
      />,
    );
    await act(async () => {});

    // 표는 서 있다 — 기다리는 것은 그 안의 세 칸뿐이다.
    expect(screen.getByText('arn:aws:rds:ap-northeast-2:1:db:orders')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });
});
