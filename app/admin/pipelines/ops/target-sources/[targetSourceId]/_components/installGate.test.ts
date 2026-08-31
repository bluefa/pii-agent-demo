import { describe, expect, it } from 'vitest';
import {
  serviceWorkGate,
  serviceWorkStep,
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

const AWS_STEP = { id: 'service', title: 'Terraform 직접 적용' };
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
