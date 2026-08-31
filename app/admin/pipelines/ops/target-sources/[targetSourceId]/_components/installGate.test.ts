import { describe, expect, it } from 'vitest';
import {
  installPendingGate,
  installStepTitle,
  serviceWorkGate,
  serviceWorkStep,
  type InstallPendingInput,
  type ServiceWorkInput,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type {
  InstallDetailResource,
  InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';

/** 한 리소스 — 관심 있는 단계의 셀만 든다(다른 셀은 이 판정에 들어가지 않는다). */
const resource = (
  resourceId: string,
  cells: Record<string, InstallStepValue>,
): InstallDetailResource => ({
  resourceId,
  resourceName: resourceId,
  rollup: { status: 'IN_PROGRESS', guide: null },
  cells: Object.fromEntries(
    Object.entries(cells).map(([key, status]) => [key, { status, guide: null }]),
  ),
});

// 이름은 이 콘솔의 것이다 — 서비스 화면 Step 4 의 「Terraform 직접 적용」이 아니다.
const AWS_STEP = { id: 'service', title: '서비스 측 Terraform 적용' };
const GCP_STEP = { id: 'subnet', title: 'PSC용 Subnet 생성' };

const gate = (
  step: { id: string; title: string },
  resources: readonly InstallDetailResource[],
): ReturnType<typeof serviceWorkGate> =>
  serviceWorkGate({
    step,
    detail: {
      lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
      unavailable: false,
      resources,
    },
  });

describe('serviceWorkStep — 서비스가 손댈 단계가 있는 대상만', () => {
  it('AWS 수동 설치와 GCP 만 단계를 가진다', () => {
    expect(serviceWorkStep('aws', true)).toEqual(AWS_STEP);
    expect(serviceWorkStep('gcp', false)).toEqual(GCP_STEP);
    // GCP 는 설치 모드와 무관하다 — Subnet 은 언제나 서비스가 만든다.
    expect(serviceWorkStep('gcp', true)).toEqual(GCP_STEP);
  });

  it('AWS 자동 설치·Azure·IDC·SDU 는 null — 조회조차 하지 않는다', () => {
    // 자동 설치는 BDC 가 스크립트를 적용한다: 서비스가 기다릴 단계가 없다.
    expect(serviceWorkStep('aws', false)).toBeNull();
    expect(serviceWorkStep('azure', true)).toBeNull();
    expect(serviceWorkStep('idc', true)).toBeNull();
    expect(serviceWorkStep('sdu', true)).toBeNull();
  });
});

describe('serviceWorkGate — 그 한 단계의 판정과 행', () => {
  it('AWS 수동 설치에 안 끝난 리소스가 있으면 needed 이고, 그 리소스가 맨 위다', () => {
    const result = gate(AWS_STEP, [
      resource('rds-done', { service: 'COMPLETED' }),
      resource('rds-fail', { service: 'FAIL' }),
      resource('rds-run', { service: 'IN_PROGRESS' }),
    ]);

    expect(result.kind).toBe('needed');
    expect(result.done).toBe(1);
    expect(result.total).toBe(3);
    // 안 끝난 둘이 먼저, 같은 무리 안에서는 들어온 순서 그대로(안정 정렬).
    expect(result.rows.map((row) => row.resourceId)).toEqual(['rds-fail', 'rds-run', 'rds-done']);
    expect(result.rows[0].status).toBe('FAIL');
  });

  it('GCP Subnet 이 전부 정착했으면 done — 경고할 것이 없다', () => {
    const result = gate(GCP_STEP, [
      resource('vm-1', { subnet: 'COMPLETED' }),
      // SKIP 은 해당 없음이라 정착으로 센다 — 기다릴 사람이 없다.
      resource('vm-2', { subnet: 'SKIP' }),
    ]);

    expect(result.kind).toBe('done');
    expect(result.done).toBe(2);
    expect(result.total).toBe(2);
  });

  it('판정은 제 셀만 읽는다 — 다른 단계의 실패를 물려받지 않는다', () => {
    const result = gate(AWS_STEP, [
      resource('rds-1', { service: 'COMPLETED', bdcService: 'FAIL', bdcCommon: 'FAIL' }),
    ]);

    expect(result.kind).toBe('done');
    expect(result.rows).toHaveLength(1);
  });

  it.each<[string, ServiceWorkInput]>([
    ['조회 자체가 실패했다', { step: AWS_STEP, detail: null }],
    [
      'last_check 가 FAILED 다',
      {
        step: AWS_STEP,
        detail: {
          lastCheck: { status: 'FAILED', failReason: 'assume role denied' },
          unavailable: false,
          resources: [resource('rds-1', { service: 'FAIL' })],
        },
      },
    ],
    [
      'installation_status_unavailable 이다',
      {
        step: AWS_STEP,
        detail: {
          lastCheck: { status: 'SUCCESS' },
          unavailable: true,
          resources: [resource('rds-1', { service: 'FAIL' })],
        },
      },
    ],
    [
      '리소스가 0건이다',
      {
        step: AWS_STEP,
        detail: { lastCheck: { status: 'SUCCESS' }, unavailable: false, resources: [] },
      },
    ],
    [
      '이 단계의 셀을 가진 리소스가 하나도 없다',
      {
        step: AWS_STEP,
        detail: {
          lastCheck: { status: 'SUCCESS' },
          unavailable: false,
          resources: [resource('rds-1', { bdcCommon: 'FAIL' })],
        },
      },
    ],
  ])('%s 면 unknown 이고, 절대 needed 가 아니다', (_name, input) => {
    const result = serviceWorkGate(input);

    // 못 읽은 것은 「안 끝났다」도 「끝났다」도 아니다 — 그래서 경고하지 않는다.
    expect(result.kind).toBe('unknown');
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// installPendingGate — 설치 전체
// ---------------------------------------------------------------------------

const pending = (
  resources: readonly InstallDetailResource[],
  over: Partial<InstallPendingInput> = {},
): ReturnType<typeof installPendingGate> =>
  installPendingGate({
    provider: 'aws',
    manualInstall: true,
    detail: {
      lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
      unavailable: false,
      resources,
    },
    ...over,
  });

describe('installStepTitle — 셀 키가 무슨 단계인가', () => {
  it('AWS 는 설치 모드가 이름을 가른다', () => {
    expect(installStepTitle('aws', true, 'service')).toBe('서비스 측 Terraform 적용');
    expect(installStepTitle('aws', false, 'service')).toBe('서비스 측 Terraform 자동 적용');
    expect(installStepTitle('aws', true, 'bdcService')).toBe('BDC 서비스 영역');
    expect(installStepTitle('aws', true, 'bdcCommon')).toBe('BDC 공통 영역');
  });

  it('나머지 셋은 각 화면의 이름 그대로다', () => {
    expect(installStepTitle('gcp', true, 'subnet')).toBe('PSC용 Subnet 생성');
    expect(installStepTitle('azure', true, 'pe')).toBe('Private Endpoint 승인');
    expect(installStepTitle('azure', true, 'vmApply')).toBe('VM Terraform 적용');
    expect(installStepTitle('idc', true, 'cx')).toBe('BDC CX 영역');
    expect(installStepTitle('idc', true, 'firewall')).toBe('접근 허용');
  });

  it('모르는 키는 원문 그대로다 — 모르는 것을 아는 이름으로 부르지 않는다', () => {
    expect(installStepTitle('aws', true, 'brandNewStep')).toBe('brandNewStep');
    expect(installStepTitle('sdu', true, 'cx')).toBe('cx');
  });
});

describe('installPendingGate — 못 읽었으면 아무 말도 하지 않는다', () => {
  it('조회 전·조회 실패(detail null)는 unknown 이고 행이 없다', () => {
    expect(pending([], { detail: null })).toEqual({
      kind: 'unknown',
      open: 0,
      total: 0,
      rows: [],
    });
  });

  it('unavailable 은 unknown 이다 — 딸려 온 셀은 설치의 판독이 아니다', () => {
    const result = installPendingGate({
      provider: 'aws',
      manualInstall: true,
      detail: {
        lastCheck: { status: 'SUCCESS' },
        unavailable: true,
        resources: [resource('rds-1', { service: 'IN_PROGRESS' })],
      },
    });

    expect(result.kind).toBe('unknown');
    expect(result.rows).toEqual([]);
  });

  it('FAILED last_check 도 unknown 이다', () => {
    const result = pending([resource('rds-1', { service: 'IN_PROGRESS' })], {
      detail: {
        lastCheck: { status: 'FAILED', failReason: 'TIMEOUT' },
        unavailable: false,
        resources: [resource('rds-1', { service: 'IN_PROGRESS' })],
      },
    });

    expect(result.kind).toBe('unknown');
  });

  it('리소스 0건은 done 이 아니라 unknown 이다 — 빈 집합의 「전부 완료」는 사실이 아니다', () => {
    expect(pending([]).kind).toBe('unknown');
  });
});

describe('installPendingGate — 판정과 행', () => {
  it('모든 셀이 COMPLETED·SKIP 이면 done 이고 행이 없다', () => {
    const result = pending([
      resource('rds-1', { service: 'COMPLETED', bdcService: 'SKIP', bdcCommon: 'COMPLETED' }),
      resource('rds-2', { service: 'SKIP', bdcService: 'SKIP', bdcCommon: 'SKIP' }),
    ]);

    expect(result).toEqual({ kind: 'done', open: 0, total: 2, rows: [] });
  });

  it('셀 하나가 안 끝나면 needed 다 — 어느 단계든, 누구의 단계든', () => {
    const result = pending([
      resource('rds-1', { service: 'COMPLETED', bdcService: 'BDC_INSTALL_REQUIRED' }),
    ]);

    expect(result.kind).toBe('needed');
    expect(result.open).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].stepTitle).toBe('BDC 서비스 영역');
  });

  it('한 리소스의 안 끝난 셀이 둘이면 행도 둘, 그래도 open 은 1 이다', () => {
    const result = pending([
      resource('rds-1', { service: 'IN_PROGRESS', bdcService: 'UNKNOWN', bdcCommon: 'COMPLETED' }),
    ]);

    // 상자가 세는 것은 리소스이고(운영자가 기다리는 것의 수), 표가 세는 것은 셀이다.
    expect(result.open).toBe(1);
    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.stepTitle)).toEqual([
      '서비스 측 Terraform 적용',
      'BDC 서비스 영역',
    ]);
  });

  it('행 순서는 리소스 순서, 그 안에서 어댑터가 낸 셀 순서다', () => {
    const result = pending([
      resource('rds-1', { service: 'IN_PROGRESS', bdcCommon: 'FAIL' }),
      resource('rds-2', { bdcService: 'IN_PROGRESS' }),
    ]);

    expect(result.rows.map((row) => `${row.resourceId}/${row.stepTitle}`)).toEqual([
      'rds-1/서비스 측 Terraform 적용',
      'rds-1/BDC 공통 영역',
      'rds-2/BDC 서비스 영역',
    ]);
    expect(result.open).toBe(2);
  });

  it('행은 상태·안내·이름을 그대로 나른다', () => {
    const result = installPendingGate({
      provider: 'gcp',
      manualInstall: false,
      detail: {
        lastCheck: { status: 'SUCCESS' },
        unavailable: false,
        resources: [
          {
            resourceId: 'gcp-1',
            resourceName: 'sql-primary',
            rollup: { status: 'IN_PROGRESS', guide: null },
            cells: { subnet: { status: 'FAIL', guide: 'Subnet 대역이 겹칩니다.' } },
          },
        ],
      },
    });

    expect(result.rows[0]).toEqual({
      resourceId: 'gcp-1',
      resourceName: 'sql-primary',
      stepTitle: 'PSC용 Subnet 생성',
      status: 'FAIL',
      guide: 'Subnet 대역이 겹칩니다.',
    });
  });

  it('total 은 읽은 리소스 전체다 — 안 끝난 것만 세지 않는다', () => {
    const result = pending([
      resource('rds-1', { service: 'COMPLETED' }),
      resource('rds-2', { service: 'IN_PROGRESS' }),
      resource('rds-3', { service: 'COMPLETED' }),
    ]);

    expect(result.total).toBe(3);
    expect(result.open).toBe(1);
  });
});
