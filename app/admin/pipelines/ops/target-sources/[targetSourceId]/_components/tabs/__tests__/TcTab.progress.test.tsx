// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';

/**
 * 진행률 분모가 확정 행이 아니라 결과 단위인지 — 배선 자체를 잡는 트립와이어.
 *
 * `toConfirmedUnits`/`runProgress` 를 각자 단언하는 순수 함수 테스트는 이 결함을 못 잡는다.
 * 접기는 두 함수 다 옳게 하고 있었고, 틀린 것은 TcTab 이 카드에 넘기는 값이었다(확정 행 수).
 * 그래서 여기서는 카드가 실제로 받은 prop 을 본다 — TcTab 이 다시 행 수를 넘기면 빨개진다.
 *
 * Athena 는 Step 4 부터 리전이 곧 리소스다: 한 리전의 데이터베이스 셋은 결과 한 건이므로
 * 확정 4행(RDS 1 + Athena 3)의 분모는 4 가 아니라 2 여야 한다.
 */
const ATHENA_REGION = 'athena:1:ap-northeast-1/AwsDataCatalog';

const athenaDb = (db: string): ConfirmedIntegrationResourceItem =>
  ({
    resource_id: `athena:1:ap-northeast-1:AwsDataCatalog/${db}`,
    resource_name: db,
    database_type: 'athena',
    database_region: 'ap-northeast-1',
    athena_region_resource_id: ATHENA_REGION,
  }) as ConfirmedIntegrationResourceItem;

const confirmedRows: ConfirmedIntegrationResourceItem[] = [
  {
    resource_id: 'arn:aws:rds:ap-northeast-2:1:cluster:db-1',
    resource_name: 'db-1',
    database_type: 'mysql',
    database_region: 'ap-northeast-2',
  } as ConfirmedIntegrationResourceItem,
  athenaDb('sampledb'),
  athenaDb('integration'),
  athenaDb('logs'),
];

vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: vi.fn().mockResolvedValue({ resource_infos: confirmedRows }),
  getSecrets: vi.fn().mockResolvedValue([]),
  triggerTestConnection: vi.fn(),
}));

vi.mock('@/app/lib/api/task-queue-requests', () => ({
  getApprovalRequestLatest: vi.fn().mockRejectedValue(new Error('no request')),
}));

// 확정 정보 표는 이 테스트의 관심 밖이고 자기 몫의 조회를 또 건다.
vi.mock(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard',
  () => ({ ConfirmedInfoCard: () => null }),
);

// 밴드는 받은 분모를 그대로 찍는 대역으로 세운다 — 진짜 카드의 렌더 조건에 기대지 않는다.
vi.mock(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcLatestRunCard',
  () => ({
    TcLatestRunCard: ({ confirmedResourceCount }: { confirmedResourceCount: number }) => (
      <output data-testid="denominator">{confirmedResourceCount}</output>
    ),
  }),
);

const { TcTab } = await import(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/TcTab'
);

describe('TcTab — 진행률 분모', () => {
  it('한 리전의 Athena 데이터베이스 셋을 한 단위로 접어서 넘긴다', async () => {
    render(
      <TcTab
        targetSourceId={1}
        isIdc={false}
        status={null}
        latest={null}
        results={[]}
        statusLoaded
        latestFailed={false}
        onStatusReload={vi.fn()}
      />,
    );

    // 확정 4행이지만 결과는 2건(RDS 하나 + Athena 리전 하나)만 온다.
    await waitFor(() => expect(screen.getByTestId('denominator').textContent).toBe('2'));
  });
});
