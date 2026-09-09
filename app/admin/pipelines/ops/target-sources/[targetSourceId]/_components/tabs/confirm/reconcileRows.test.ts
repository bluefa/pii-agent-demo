import { describe, expect, it } from 'vitest';
import { buildReconcileTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/reconcileRows';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

const approved = (overrides: Partial<RequestResourceRow> = {}): RequestResourceRow => ({
  resourceId: 'arn:aws:rds:ap-northeast-2:acct:db:mysql-prod-01',
  resourceName: 'mysql-prod-01',
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'mysql',
  region: 'ap-northeast-2',
  idcKind: null,
  connectTargets: [],
  port: null,
  oracleSid: null,
  sourceIps: [],
  nlbIndex: null,
  resourceType: 'AWS_DB_INSTANCE',
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
  ...overrides,
});

const confirmed = (
  overrides: Partial<ConfirmedIntegrationResourceInfo> = {},
): ConfirmedIntegrationResourceInfo => ({
  resource_id: 'arn:aws:rds:ap-northeast-2:acct:db:mysql-prod-01',
  resource_type: 'AWS_DB_INSTANCE',
  database_type: 'mysql',
  database_region: 'ap-northeast-2',
  resource_name: 'mysql-prod-01',
  port: 3306,
  host: 'mysql-prod-01.rds.internal',
  oracle_service_id: null,
  network_interface_id: null,
  ip_configuration: null,
  credential_id: 'cred-1',
  ...overrides,
});

describe('buildReconcileTable — cloud', () => {
  it('승인에만 있는 행도 확정 표의 모양으로 실린다', () => {
    const table = buildReconcileTable({
      isIdc: false,
      approved: [approved({ resourceId: 'arn:only-approved', resourceName: 'only-approved' })],
      confirmed: { resource_infos: [] },
    });

    expect(table.kind).toBe('cloud');
    expect(table.rows).toHaveLength(1);
    // 위 단언이 이미 답했다 — 아래 줄들이 클라우드 행의 필드를 읽을 수 있게 좁혀 준다.
    if (table.kind !== 'cloud') return;
    const [row] = table.rows;
    expect(row.reconcile).toBe('missingConfirmed');
    // 정체와 속성은 승인이 말한 것 그대로다.
    expect(row).toMatchObject({
      resourceId: 'arn:only-approved',
      resourceName: 'only-approved',
      databaseType: 'mysql',
      region: 'ap-northeast-2',
      type: 'AWS_DB_INSTANCE',
    });
    // 확정 쪽에만 있는 사실은 지어내지 않는다 — 연결 상태는 값이 없지 CONNECTED 가 아니다.
    expect(row).toMatchObject({ host: null, port: null, credentialId: null });
    expect(row.connectionStatus).toBeUndefined();
  });

  it('양쪽에 있는 행은 확정 응답의 값을 싣는다 — 실제로 등록된 것이 그쪽이다', () => {
    const table = buildReconcileTable({
      isIdc: false,
      approved: [approved()],
      confirmed: { resource_infos: [confirmed({ resource_name: 'mysql-prod-01-renamed' })] },
    });

    expect(table.diffCount).toBe(0);
    expect(table.rows[0]).toMatchObject({
      reconcile: 'match',
      resourceName: 'mysql-prod-01-renamed',
      host: 'mysql-prod-01.rds.internal',
    });
  });

  it('선택되지 않은 승인 행은 표에 오지 않는다', () => {
    const table = buildReconcileTable({
      isIdc: false,
      approved: [approved(), approved({ resourceId: 'arn:excluded', selected: false })],
      confirmed: { resource_infos: [confirmed()] },
    });

    expect(table.rows).toHaveLength(1);
    expect(table.diffCount).toBe(0);
  });
});

describe('buildReconcileTable — IDC', () => {
  it('resource id 가 없어도 접속 주소와 Port 로 맞물린다', () => {
    const table = buildReconcileTable({
      isIdc: true,
      approved: [
        approved({
          resourceId: null,
          idcKind: 'IP',
          connectTargets: ['10.0.0.1'],
          port: 3306,
        }),
      ],
      confirmed: {
        resource_infos: [
          confirmed({
            resource_id: '',
            idc_host_format: 'IP',
            idc_ips: ['10.0.0.1'],
            port: 3306,
          }),
        ],
      },
    });

    expect(table.kind).toBe('idc');
    expect(table.diffCount).toBe(0);
    // 위 단언이 이미 답했다 — 아래 줄들이 IDC 행의 필드를 읽을 수 있게 좁혀 준다.
    if (table.kind !== 'idc') return;
    expect(table.rows[0].reconcile).toBe('match');
    expect(table.rows[0].connectTargets).toEqual(['10.0.0.1']);
  });

  it('확정에만 있는 엔드포인트는 승인 없음으로 남는다', () => {
    const table = buildReconcileTable({
      isIdc: true,
      approved: [],
      confirmed: {
        resource_infos: [
          confirmed({ resource_id: '', idc_host_format: 'HOST', idc_host: 'db.internal', port: 1521 }),
        ],
      },
    });

    expect(table.missingApproved).toBe(1);
    expect(table.rows[0].reconcile).toBe('missingApproved');
  });
});
