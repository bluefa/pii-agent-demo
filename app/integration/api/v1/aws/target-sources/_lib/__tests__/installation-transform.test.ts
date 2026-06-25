import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { transformAwsInstallationStatus } from '@/app/integration/api/v1/aws/target-sources/_lib/installation-transform';

type AwsInstallationStatusResponse = z.infer<typeof schemas.AwsInstallationStatusResponse>;
type AwsResourceInstallationStatusDto = z.infer<typeof schemas.AwsResourceInstallationStatusDto>;

const buildResource = (
  overrides: Partial<AwsResourceInstallationStatusDto> = {},
): AwsResourceInstallationStatusDto => ({
  resource_id: 'arn:aws:rds:ap-northeast-2:123456789012:db:demo',
  resource_name: 'demo',
  installation_status: 'COMPLETED',
  service_terraform: { status: 'COMPLETED' },
  bdc_service_terraform: { status: 'COMPLETED' },
  bdc_common_terraform: { status: 'COMPLETED' },
  ...overrides,
});

const buildResponse = (
  overrides: Partial<AwsInstallationStatusResponse> = {},
): AwsInstallationStatusResponse => ({
  last_check: { status: 'SUCCESS', checked_at: '2026-03-02T00:00:00Z' },
  resources: [buildResource()],
  terraform_execution_role_verify: {
    status: 'COMPLETED',
    role_arn: 'arn:aws:iam::123456789012:role/TerraformExecutionRole',
  },
  ...overrides,
});

describe('installation-transform (swagger AwsInstallationStatusResponse → UI domain)', () => {
  it('maps each resource to a service script and aggregates the BDC steps', () => {
    const result = transformAwsInstallationStatus(
      buildResponse({
        resources: [
          buildResource({
            resource_id: 'r-1',
            resource_name: 'Script-1',
            installation_status: 'COMPLETED',
            service_terraform: { status: 'COMPLETED' },
            bdc_service_terraform: { status: 'IN_PROGRESS' },
            bdc_common_terraform: { status: 'COMPLETED' },
          }),
          buildResource({
            resource_id: 'r-2',
            resource_name: 'Script-2',
            installation_status: 'IN_PROGRESS',
            service_terraform: { status: 'IN_PROGRESS' },
            bdc_service_terraform: { status: 'UNKNOWN' },
            bdc_common_terraform: { status: 'UNKNOWN' },
          }),
        ],
      }),
    );

    expect(result.hasExecutionPermission).toBe(true);
    expect(result.executionRoleArn).toBe('arn:aws:iam::123456789012:role/TerraformExecutionRole');
    expect(result.actionSummary).toEqual({
      serviceActionRequired: true,
      bdcInstallationRequired: true,
    });

    expect(result.serviceScripts[0]).toMatchObject({
      scriptId: 'r-1',
      scriptName: 'Script-1',
      terraformScriptName: 'Script-1',
      resourceCount: 1,
      status: 'COMPLETED',
    });
    expect(result.serviceScripts[0].resources[0]).toMatchObject({
      resourceId: 'r-1',
      resource_id: 'r-1',
      installationDisplayStatus: 'COMPLETED',
    });
    expect(result.serviceScripts[1].resources[0].installationDisplayStatus).toBe('NOT_INSTALLED');
    // BDC card aggregates the two bdc step DTOs across resources (worst-wins).
    expect(result.bdcStatus.status).toBe('INSTALLING');
  });

  it('all-COMPLETED resources + role verify → no action required, lastCheck SUCCESS', () => {
    const result = transformAwsInstallationStatus(buildResponse());

    expect(result.actionSummary).toEqual({
      serviceActionRequired: false,
      bdcInstallationRequired: false,
    });
    expect(result.serviceScripts[0].resources[0].installationDisplayStatus).toBe('COMPLETED');
    expect(result.lastCheck).toEqual({ status: 'SUCCESS', checkedAt: '2026-03-02T00:00:00Z' });
  });

  it('FAILED last_check + unverified role → hasExecutionPermission false, lastCheck FAILED', () => {
    const result = transformAwsInstallationStatus(
      buildResponse({
        last_check: { status: 'FAILED', checked_at: '2026-03-02T02:00:00Z', fail_reason: '검증 실패' },
        resources: [buildResource({ service_terraform: { status: 'FAIL' }, bdc_service_terraform: { status: 'FAIL' } })],
        terraform_execution_role_verify: { status: 'IN_PROGRESS' },
      }),
    );

    expect(result.hasExecutionPermission).toBe(false);
    expect(result.executionRoleArn).toBeUndefined();
    expect(result.lastCheck).toEqual({
      status: 'FAILED',
      checkedAt: '2026-03-02T02:00:00Z',
      failReason: '검증 실패',
    });
  });
});
