// @vitest-environment jsdom
/**
 * 확정 정보 조인이 아직 안 온 칸.
 *
 * 표는 §10 이 도착하는 즉시 서지만 Resource Name·Database Type·리전(IDC 는 접속 주소·
 * Port)은 **다른** 조회에서 온다. 그 창에서 대시를 그리면 — 대시는 이 표에서 「그 값이
 * 없다」는 낱말이다 — 표가 없는 사실을 단언했다가 조용히 값으로 바꾼다.
 * 조회 **실패**는 종전대로 대시다: 그 갈래는 AirflowTab 이 근거와 함께 정한 것이라
 * 여기서 뒤집지 않는다.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentDagTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AgentDagTable';
import { indexConfirmedResources } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/agentFacts';
import type { DagStatusResponse } from '@/lib/types/dag-status';

const DATA: DagStatusResponse = {
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
      // 논리 DB 가 하나는 있어야 규모 칸이 수로 선다 — 0 건은 그 칸이 대시로 서는 게
      // 맞는 사실이라, 조인 대기와 섞이면 이 검사가 그 대시를 잡는다.
      databaseStatuses: [
        {
          databaseUri: 'mysql://orders/app',
          databaseName: 'app',
          schemaName: null,
          dagName: 'dag-app',
          namespace: null,
          succeededThisWeek: true,
          lastSuccessAt: '2026-09-01T00:00:00Z',
          days: Array.from({ length: 7 }, (_, index) => ({
            day: `2026-08-2${index + 1}`,
            status: 'SUCCESS',
            successTime: '2026-08-27T00:00:00Z',
          })),
        },
      ],
    },
  ],
};

const table = (confirmed: Parameters<typeof AgentDagTable>[0]['confirmed']) =>
  render(<AgentDagTable data={DATA} onViewDbs={() => {}} confirmed={confirmed} isIdc={false} />);

describe('AgentDagTable — 확정 정보를 기다리는 칸', () => {
  it('조회 중이면 빌려 오는 칸이 대시가 아니라 자국으로 선다', () => {
    const { container } = table(undefined);

    // 대시는 「없다」는 단언이라 이 창에서는 하나도 서지 않는다.
    expect(screen.queryByText('—')).toBeNull();
    const busy = container.querySelector('[aria-busy]');
    expect(busy).not.toBeNull();
    // 이름 · Database Type · 리전 셋.
    expect(busy?.querySelectorAll('.animate-pulse').length).toBe(3);
    // §10 이 보증하는 값은 자국이 아니다 — 표는 그것을 이미 알고 있다.
    expect(screen.getByText('arn:aws:rds:ap-northeast-2:1:db:orders')).toBeTruthy();
  });

  it('조회 실패는 종전대로 대시다', () => {
    const { container } = table(null);

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it('정착한 조인은 값을 그린다', () => {
    table(
      indexConfirmedResources([
        {
          resource_id: 'arn:aws:rds:ap-northeast-2:1:db:orders',
          resource_type: 'AWS_DB_INSTANCE',
          resource_name: 'orders-db',
          database_type: 'MYSQL',
          database_region: 'ap-northeast-2',
          port: 3306,
          host: null,
          oracle_service_id: null,
          network_interface_id: null,
          ip_configuration: null,
          credential_id: null,
        },
      ]),
    );

    expect(screen.getByText('orders-db')).toBeTruthy();
    expect(screen.getByText('ap-northeast-2')).toBeTruthy();
  });
});
