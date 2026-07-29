import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import {
  isAwsInstallationComplete,
  transformAwsInstallationStatus,
} from '@/app/api/v1/aws/target-sources/_lib/installation-transform';

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
  it('mirrors the resource-centric wire 1:1 (per-resource step states + guide)', () => {
    const result = transformAwsInstallationStatus(
      buildResponse({
        resources: [
          buildResource({
            resource_id: 'r-1',
            resource_name: 'prod-mysql',
            installation_status: 'IN_PROGRESS',
            service_terraform: { status: 'COMPLETED' },
            bdc_service_terraform: { status: 'IN_PROGRESS', guide: '자동 진행 중' },
            bdc_common_terraform: { status: 'SKIP', guide: null },
          }),
        ],
      }),
    );

    expect(result.roleVerify).toEqual({
      status: 'COMPLETED',
      roleArn: 'arn:aws:iam::123456789012:role/TerraformExecutionRole',
    });
    expect(result.resources).toEqual([
      {
        resourceId: 'r-1',
        resourceName: 'prod-mysql',
        installationStatus: 'IN_PROGRESS',
        serviceTerraform: { status: 'COMPLETED', guide: null },
        bdcServiceTerraform: { status: 'IN_PROGRESS', guide: '자동 진행 중' },
        bdcCommonTerraform: { status: 'SKIP', guide: null },
      },
    ]);
    expect(result.lastCheck).toEqual({ status: 'SUCCESS', checkedAt: '2026-03-02T00:00:00Z' });
  });

  it('normalizes off-enum / missing step statuses to UNKNOWN', () => {
    const result = transformAwsInstallationStatus(
      buildResponse({
        resources: [
          buildResource({
            installation_status: 'SOMETHING_NEW',
            service_terraform: { status: 'WEIRD' },
            bdc_service_terraform: null,
            bdc_common_terraform: undefined,
          }),
        ],
        terraform_execution_role_verify: {},
      }),
    );

    expect(result.resources[0].installationStatus).toBe('UNKNOWN');
    expect(result.resources[0].serviceTerraform.status).toBe('UNKNOWN');
    expect(result.resources[0].bdcServiceTerraform).toEqual({ status: 'UNKNOWN', guide: null });
    expect(result.resources[0].bdcCommonTerraform).toEqual({ status: 'UNKNOWN', guide: null });
    expect(result.roleVerify).toEqual({ status: 'UNKNOWN', roleArn: null });
  });

  it('maps FAILED last_check with fail reason', () => {
    const result = transformAwsInstallationStatus(
      buildResponse({
        last_check: { status: 'FAILED', checked_at: '2026-03-02T02:00:00Z', fail_reason: '검증 실패' },
      }),
    );

    expect(result.lastCheck).toEqual({
      status: 'FAILED',
      checkedAt: '2026-03-02T02:00:00Z',
      failReason: '검증 실패',
    });
  });
});

describe('isAwsInstallationComplete', () => {
  const complete = transformAwsInstallationStatus(buildResponse());

  it('COMPLETED/SKIP across all steps + verified role → complete', () => {
    expect(isAwsInstallationComplete(complete, false)).toBe(true);
  });

  it('SKIP counts as settled', () => {
    const status = transformAwsInstallationStatus(
      buildResponse({
        resources: [
          buildResource({
            service_terraform: { status: 'SKIP' },
            bdc_service_terraform: { status: 'SKIP' },
            bdc_common_terraform: { status: 'SKIP' },
          }),
        ],
      }),
    );
    expect(isAwsInstallationComplete(status, false)).toBe(true);
  });

  it('any IN_PROGRESS step → not complete', () => {
    const status = transformAwsInstallationStatus(
      buildResponse({
        resources: [buildResource({ bdc_common_terraform: { status: 'IN_PROGRESS' } })],
      }),
    );
    expect(isAwsInstallationComplete(status, false)).toBe(false);
  });

  it('unverified role blocks completion in auto mode but not in manual mode', () => {
    const status = transformAwsInstallationStatus(
      buildResponse({ terraform_execution_role_verify: { status: 'IN_PROGRESS' } }),
    );
    expect(isAwsInstallationComplete(status, false)).toBe(false);
    expect(isAwsInstallationComplete(status, true)).toBe(true);
  });

  it('empty resources → never complete', () => {
    const status = transformAwsInstallationStatus(buildResponse({ resources: [] }));
    expect(isAwsInstallationComplete(status, false)).toBe(false);
  });
});
