import { describe, expect, it } from 'vitest';
import type { ServiceTfScript } from '@/lib/types';
import type {
  BffAwsCheckInstallationResponse,
  BffAwsInstallationStatus,
} from '@/lib/bff/types/aws';
import { transformAwsInstallationStatus } from '@/app/integration/api/v1/aws/target-sources/_lib/installation-transform';

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

const buildBffStatus = (
  overrides: Partial<BffAwsInstallationStatus> = {},
): BffAwsInstallationStatus => ({
  provider: 'AWS',
  has_tf_permission: true,
  tf_execution_role_arn: 'arn:aws:iam::123456789012:role/TerraformExecutionRole',
  service_tf_scripts: [buildScript()],
  bdc_tf: { status: 'PENDING' },
  service_tf_completed: false,
  bdc_tf_completed: false,
  last_checked_at: '2026-03-02T00:00:00Z',
  ...overrides,
});

describe('installation-transform', () => {
  it('설치 상태 조회 응답에 UI 보조 필드(actionSummary, script meta, resource display)를 포함한다', () => {
    const status = buildBffStatus({
      service_tf_scripts: [
        buildScript({ id: 'svc-1', label: 'Script-1', status: 'COMPLETED' }),
        buildScript({ id: 'svc-2', label: 'Script-2', status: 'PENDING' }),
      ],
      bdc_tf: { status: 'IN_PROGRESS' },
    });

    const result = transformAwsInstallationStatus(status);

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
    expect(result.serviceScripts[0].resources[0]).toMatchObject({
      type: 'RDS',
      resource_type: 'RDS',
      resourceId: 'arn:aws:rds:ap-northeast-2:123456789012:db:demo',
      resource_id: 'arn:aws:rds:ap-northeast-2:123456789012:db:demo',
    });

    expect(result.serviceScripts[0].resources[0].installationDisplayStatus).toBe('NOT_INSTALLED');
    expect(result.serviceScripts[1].resources[0].installationDisplayStatus).toBe('NOT_INSTALLED');
    expect(result.bdcStatus.status).toBe('INSTALLING');
  });

  it('service/bdc 모두 완료면 resource installationDisplayStatus를 COMPLETED로 반환한다', () => {
    const status = buildBffStatus({
      service_tf_scripts: [buildScript({ status: 'COMPLETED' })],
      bdc_tf: { status: 'COMPLETED' },
      service_tf_completed: true,
      bdc_tf_completed: true,
      completed_at: '2026-03-02T01:00:00Z',
    });

    const result = transformAwsInstallationStatus(status);

    expect(result.actionSummary).toEqual({
      serviceActionRequired: false,
      bdcInstallationRequired: false,
    });
    expect(result.serviceScripts[0].resources[0].installationDisplayStatus).toBe('COMPLETED');
  });

  it('check-installation 에러가 있으면 lastCheck를 FAILED로 반환한다', () => {
    const status: BffAwsCheckInstallationResponse = {
      ...buildBffStatus({
        service_tf_scripts: [buildScript({ status: 'FAILED' })],
        bdc_tf: { status: 'FAILED' },
      }),
      error: { code: 'VALIDATION_FAILED', message: '검증 실패' },
      last_checked_at: '2026-03-02T02:00:00Z',
    };

    const result = transformAwsInstallationStatus(status);

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
