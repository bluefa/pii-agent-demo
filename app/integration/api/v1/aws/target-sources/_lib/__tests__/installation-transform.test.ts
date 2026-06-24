import { describe, expect, it } from 'vitest';
import type {
  AwsInstallationStatusResponse,
  AwsResourceInstallationStatus,
} from '@/lib/bff/types/aws';
import { transformAwsInstallationStatus } from '@/app/integration/api/v1/aws/target-sources/_lib/installation-transform';

const buildResource = (
  overrides: Partial<AwsResourceInstallationStatus> = {},
): AwsResourceInstallationStatus => ({
  resourceId: 'arn:aws:rds:ap-northeast-2:123456789012:db:demo',
  resourceName: 'demo',
  installationStatus: 'COMPLETED',
  serviceTerraform: { status: 'COMPLETED' },
  bdcServiceTerraform: { status: 'COMPLETED' },
  bdcCommonTerraform: { status: 'COMPLETED' },
  ...overrides,
});

const buildResponse = (
  overrides: Partial<AwsInstallationStatusResponse> = {},
): AwsInstallationStatusResponse => ({
  lastCheck: { status: 'SUCCESS', checkedAt: '2026-03-02T00:00:00Z' },
  resources: [buildResource()],
  terraformExecutionRoleVerify: {
    status: 'COMPLETED',
    roleArn: 'arn:aws:iam::123456789012:role/TerraformExecutionRole',
  },
  ...overrides,
});

describe('installation-transform (swagger AwsInstallationStatusResponse → UI domain)', () => {
  it('maps each resource to a service script and aggregates the BDC steps', () => {
    const result = transformAwsInstallationStatus(
      buildResponse({
        resources: [
          buildResource({
            resourceId: 'r-1',
            resourceName: 'Script-1',
            installationStatus: 'COMPLETED',
            serviceTerraform: { status: 'COMPLETED' },
            bdcServiceTerraform: { status: 'IN_PROGRESS' },
            bdcCommonTerraform: { status: 'COMPLETED' },
          }),
          buildResource({
            resourceId: 'r-2',
            resourceName: 'Script-2',
            installationStatus: 'IN_PROGRESS',
            serviceTerraform: { status: 'IN_PROGRESS' },
            bdcServiceTerraform: { status: 'UNKNOWN' },
            bdcCommonTerraform: { status: 'UNKNOWN' },
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
        lastCheck: { status: 'FAILED', checkedAt: '2026-03-02T02:00:00Z', failReason: '검증 실패' },
        resources: [buildResource({ serviceTerraform: { status: 'FAIL' }, bdcServiceTerraform: { status: 'FAIL' } })],
        terraformExecutionRoleVerify: { status: 'IN_PROGRESS' },
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
