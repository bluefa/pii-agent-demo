import { describe, expect, it } from 'vitest';
import {
  installGate,
  openRequiredSteps,
  requiredProgress,
  type InstallGateInput,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type {
  InstallDetailResource,
  InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';

const resource = (
  id: string,
  cells: Record<string, InstallStepValue>,
): InstallDetailResource => ({
  resourceId: id,
  resourceName: id,
  rollup: { status: 'IN_PROGRESS', guide: null },
  cells: Object.fromEntries(
    Object.entries(cells).map(([key, status]) => [key, { status, guide: null }]),
  ),
});

const input = (
  provider: InstallGateInput['provider'],
  resources: InstallDetailResource[],
  overrides: Partial<NonNullable<InstallGateInput['detail']>> = {},
): InstallGateInput => ({
  provider,
  manualInstall: false,
  detail: {
    lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
    unavailable: false,
    resources,
    ...overrides,
  },
});

const azureResource = (cells: Partial<Record<'pe' | 'vmSubnet' | 'vmApply' | 'bdc', InstallStepValue>>) =>
  resource('vm-1', {
    pe: cells.pe ?? 'COMPLETED',
    vmSubnet: cells.vmSubnet ?? 'COMPLETED',
    vmApply: cells.vmApply ?? 'COMPLETED',
    bdc: cells.bdc ?? 'COMPLETED',
  });

describe('installGate — Azure는 VM 두 단계만 제약이다', () => {
  it('PE 승인이 남아 있어도 VM 단계가 정착했으면 완료다', () => {
    const result = installGate(input('azure', [azureResource({ pe: 'IN_PROGRESS' })]));
    expect(result.kind).toBe('complete');
  });

  it('BDC측 Terraform 이 진행 중이어도 완료다 — 제약이 아니다', () => {
    const result = installGate(input('azure', [azureResource({ bdc: 'IN_PROGRESS' })]));
    expect(result.kind).toBe('complete');
  });

  it('VM Subnet 이 진행 중이면 미완료다', () => {
    const result = installGate(input('azure', [azureResource({ vmSubnet: 'IN_PROGRESS' })]));
    expect(result.kind).toBe('incomplete');
    expect(openRequiredSteps(result).map((step) => step.id)).toEqual(['vmSubnet']);
  });

  it('VM Terraform 적용이 실패면 미완료이고, 그 단계의 worst 가 FAIL 이다', () => {
    const result = installGate(input('azure', [azureResource({ vmApply: 'FAIL' })]));
    expect(result.kind).toBe('incomplete');
    expect(result.steps.find((step) => step.id === 'vmApply')?.worst).toBe('FAIL');
  });

  it('VM 이 아닌 리소스의 SKIP 은 정착이다 — 해당 없음이 진행을 막지 않는다', () => {
    const result = installGate(
      input('azure', [azureResource({ vmSubnet: 'SKIP', vmApply: 'SKIP' })]),
    );
    expect(result.kind).toBe('complete');
    expect(result.steps.find((step) => step.id === 'vmSubnet')?.na).toBe(true);
  });
});

describe('installGate — GCP는 제약이 없다', () => {
  it('Subnet 생성이 실패해도 경고하지 않는다 — 다만 완료라 부르지도 않는다', () => {
    const result = installGate(
      input('gcp', [resource('sql-1', { subnet: 'FAIL', service: 'FAIL', bdc: 'IN_PROGRESS' })]),
    );
    expect(result.kind).toBe('unconstrained');
    expect(openRequiredSteps(result)).toEqual([]);
    // 판정이 무엇이든 단계의 사실은 그대로 선다.
    expect(result.steps.find((step) => step.id === 'subnet')?.worst).toBe('FAIL');
  });

  it('단계가 전부 끝나 있어도 complete 가 아니다 — 여기서 끝났다고 말할 것이 없다', () => {
    const result = installGate(
      input('gcp', [
        resource('sql-1', { subnet: 'COMPLETED', service: 'COMPLETED', bdc: 'COMPLETED' }),
      ]),
    );
    expect(result.kind).toBe('unconstrained');
  });

  it('셀 필수 단계가 없으므로 진척은 0/0 이다 — 화면은 이 수를 그리지 않는다', () => {
    const result = installGate(
      input('gcp', [resource('sql-1', { subnet: 'COMPLETED', service: 'COMPLETED', bdc: 'FAIL' })]),
    );
    expect(requiredProgress(result)).toEqual({ done: 0, total: 0 });
  });
});

describe('installGate — AWS는 세 단계 모두 제약이다', () => {
  it('서비스 측 Terraform 이 진행 중이면 미완료다', () => {
    const result = installGate(
      input('aws', [
        resource('rds-1', {
          service: 'IN_PROGRESS',
          bdcCommon: 'COMPLETED',
          bdcService: 'COMPLETED',
        }),
      ]),
    );
    expect(result.kind).toBe('incomplete');
    expect(openRequiredSteps(result).map((step) => step.id)).toEqual(['service']);
  });

  it('BDC 설치 대기도 정착이 아니다', () => {
    const result = installGate(
      input('aws', [
        resource('rds-1', {
          service: 'COMPLETED',
          bdcCommon: 'COMPLETED',
          bdcService: 'BDC_INSTALL_REQUIRED',
        }),
      ]),
    );
    expect(result.kind).toBe('incomplete');
    expect(result.steps.find((step) => step.id === 'bdcService')?.worst).toBe(
      'BDC_INSTALL_REQUIRED',
    );
  });

  it('한 리소스만 남아도 미완료다 — 집계는 worst-wins 다', () => {
    const done = { service: 'COMPLETED', bdcCommon: 'COMPLETED', bdcService: 'COMPLETED' } as const;
    const result = installGate(
      input('aws', [
        resource('rds-1', done),
        resource('rds-2', { ...done, service: 'FAIL' }),
        resource('rds-3', done),
      ]),
    );
    expect(result.kind).toBe('incomplete');
    const service = result.steps.find((step) => step.id === 'service');
    expect(service?.worst).toBe('FAIL');
    expect(service).toMatchObject({ done: 2, total: 3 });
  });

  it('전부 완료면 complete 이고 남은 단계가 없다', () => {
    const result = installGate(
      input('aws', [
        resource('rds-1', {
          service: 'COMPLETED',
          bdcCommon: 'COMPLETED',
          bdcService: 'SKIP',
        }),
      ]),
    );
    expect(result.kind).toBe('complete');
    expect(openRequiredSteps(result)).toEqual([]);
    expect(requiredProgress(result)).toEqual({ done: 3, total: 3 });
  });

  it('수동 설치는 서비스 측 단계의 이름이 다르다', () => {
    const resources = [
      resource('rds-1', { service: 'COMPLETED', bdcCommon: 'COMPLETED', bdcService: 'COMPLETED' }),
    ];
    const auto = installGate(input('aws', resources));
    const manual = installGate({ ...input('aws', resources), manualInstall: true });
    expect(auto.steps[0].title).toBe('서비스 측 Terraform 자동 적용');
    expect(manual.steps[0].title).toBe('Terraform 직접 적용');
  });
});

describe('installGate — IDC는 세 단계 모두 제약이다 (오너 지시 없음, 가정)', () => {
  it('접근 허용 확인이 남으면 미완료다', () => {
    const result = installGate(
      input('idc', [resource('nlb-1', { cx: 'COMPLETED', bdp: 'COMPLETED', firewall: 'UNKNOWN' })]),
    );
    expect(result.kind).toBe('incomplete');
    expect(openRequiredSteps(result).map((step) => step.id)).toEqual(['firewall']);
  });
});

describe('installGate — 확인할 수 없는 것은 경고하지 않는다', () => {
  it('조회 결과가 없으면 unknown 이다', () => {
    const result = installGate({ provider: 'aws', manualInstall: false, detail: null });
    expect(result.kind).toBe('unknown');
    expect(openRequiredSteps(result)).toEqual([]);
    // 단계 골격은 남는다 — 무엇을 확인하지 못했는지는 말할 수 있다.
    expect(result.steps).toHaveLength(3);
    expect(result.steps.every((step) => step.worst === 'UNKNOWN')).toBe(true);
  });

  it('installation_status_unavailable 이면 unknown 이다', () => {
    const result = installGate(
      input('aws', [resource('rds-1', { service: 'FAIL', bdcCommon: 'FAIL', bdcService: 'FAIL' })], {
        unavailable: true,
      }),
    );
    expect(result.kind).toBe('unknown');
  });

  it('last_check 가 FAILED 면 unknown 이다', () => {
    const result = installGate(
      input(
        'azure',
        [azureResource({ vmSubnet: 'IN_PROGRESS' })],
        { lastCheck: { status: 'FAILED', failReason: 'TIMEOUT' } },
      ),
    );
    expect(result.kind).toBe('unknown');
  });

  it('리소스가 하나도 없으면 unknown 이다 — 빈 집합의 「전부 완료」는 사실이 아니다', () => {
    const result = installGate(input('aws', []));
    expect(result.kind).toBe('unknown');
  });
});
