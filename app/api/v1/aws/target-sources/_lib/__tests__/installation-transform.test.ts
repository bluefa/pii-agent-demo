import { describe, expect, it } from 'vitest';
import type { LegacyAwsInstallationStatus, LegacyCheckInstallationResponse, ServiceTfScript } from '@/lib/types';
import { transformAwsInstallationStatus } from '@/app/api/v1/aws/target-sources/_lib/installation-transform';

const buildScript = (
  overrides: Partial<ServiceTfScript> = {},
): ServiceTfScript => ({
  id: 'svc-vpc-apne2',
  type: 'VPC_ENDPOINT',
  status: 'COMPLETED',
  label: 'VPC Endpoint (vpc-001 / ap-northeast-2)',
  resources: [
    {
      resourceId: 'arn:aws:rds:ap-northeast-2:123456789012:db:demo',
      type: 'RDS',
      name: 'demo',
    },
  ],
  ...overrides,
});

const buildLegacyStatus = (
  overrides: Partial<LegacyAwsInstallationStatus> = {},
): LegacyAwsInstallationStatus => ({
  provider: 'AWS',
  hasTfPermission: true,
  tfExecutionRoleArn: 'arn:aws:iam::123456789012:role/TerraformExecutionRole',
  serviceTfScripts: [buildScript()],
  bdcTf: { status: 'PENDING' },
  serviceTfCompleted: false,
  bdcTfCompleted: false,
  lastCheckedAt: '2026-03-02T00:00:00Z',
  ...overrides,
});

describe('installation-transform', () => {
  it('설치 상태 조회 응답에 UI 보조 필드(actionSummary, script meta, resource display)를 포함한다', () => {
    const legacy = buildLegacyStatus({
      serviceTfScripts: [
        buildScript({ id: 'svc-1', label: 'Script-1', status: 'COMPLETED' }),
        buildScript({ id: 'svc-2', label: 'Script-2', status: 'PENDING' }),
      ],
      bdcTf: { status: 'IN_PROGRESS' },
    });

    const result = transformAwsInstallationStatus(legacy);

    expect(result.actionSummary).toEqual({
      serviceActionRequired: true,
      bdcInstallationRequired: true,
    });

    expect(result.serviceScripts[0]).toMatchObject({
      scriptId: 'svc-1',
      scriptName: 'Script-1',
      terraformScriptName: 'Script-1',
      resourceCount: 1,
      status: 'COMPLETED',
    });

    expect(result.serviceScripts[0].resources[0].installationDisplayStatus).toBe('NOT_INSTALLED');
    expect(result.serviceScripts[1].resources[0].installationDisplayStatus).toBe('NOT_INSTALLED');
    expect(result.bdcStatus.status).toBe('PENDING');
  });

  it('service/bdc 모두 완료면 resource installationDisplayStatus를 COMPLETED로 반환한다', () => {
    const legacy = buildLegacyStatus({
      serviceTfScripts: [buildScript({ status: 'COMPLETED' })],
      bdcTf: { status: 'COMPLETED' },
      serviceTfCompleted: true,
      bdcTfCompleted: true,
      completedAt: '2026-03-02T01:00:00Z',
    });

    const result = transformAwsInstallationStatus(legacy);

    expect(result.actionSummary).toEqual({
      serviceActionRequired: false,
      bdcInstallationRequired: false,
    });
    expect(result.serviceScripts[0].resources[0].installationDisplayStatus).toBe('COMPLETED');
  });

  it('check-installation 에러가 있으면 lastCheck를 FAILED로 반환한다', () => {
    const legacy: LegacyCheckInstallationResponse = {
      ...buildLegacyStatus({
        serviceTfScripts: [buildScript({ status: 'FAILED' })],
        bdcTf: { status: 'FAILED' },
      }),
      error: { code: 'VALIDATION_FAILED', message: '검증 실패' },
      lastCheckedAt: '2026-03-02T02:00:00Z',
    };

    const result = transformAwsInstallationStatus(legacy);

    expect(result.lastCheck).toEqual({
      status: 'FAILED',
      checkedAt: '2026-03-02T02:00:00Z',
      failReason: '검증 실패',
    });
    expect(result.actionSummary).toEqual({
      serviceActionRequired: true,
      bdcInstallationRequired: true,
    });
    expect(result.serviceScripts[0].resources[0].installationDisplayStatus).toBe('NOT_INSTALLED');
  });
});
