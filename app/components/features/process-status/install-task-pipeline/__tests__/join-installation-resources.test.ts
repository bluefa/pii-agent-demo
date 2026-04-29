import { describe, expect, it } from 'vitest';

import { joinGcpResources } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import type { GcpResourceStatus, GcpStepStatusValue } from '@/app/api/_lib/v1-types';
import type { ConfirmedResource } from '@/lib/types/resources';

const installResource = (
  resourceId: string,
  resourceName: string | undefined,
  installationStatus: GcpResourceStatus['installationStatus'],
  steps: { subnet?: GcpStepStatusValue; service?: GcpStepStatusValue; bdc?: GcpStepStatusValue } = {},
): GcpResourceStatus => ({
  resourceId,
  resourceName,
  resourceType: 'CLOUD_SQL',
  installationStatus,
  serviceSideSubnetCreation: { status: steps.subnet ?? 'COMPLETED' },
  serviceSideTerraformApply: { status: steps.service ?? 'COMPLETED' },
  bdcSideTerraformApply: { status: steps.bdc ?? 'COMPLETED' },
});

const confirmedResource = (
  resourceId: string,
  databaseType: ConfirmedResource['databaseType'],
): ConfirmedResource => ({
  resourceId,
  type: 'CLOUD_SQL',
  databaseType,
  host: null,
  port: null,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: null,
  connectionStatus: 'CONNECTED',
});

describe('joinGcpResources', () => {
  it('returns empty array when installation is empty', () => {
    expect(joinGcpResources([], [])).toEqual([]);
    expect(joinGcpResources([], [confirmedResource('r1', 'MYSQL')])).toEqual([]);
  });

  it('preserves installation order', () => {
    const result = joinGcpResources(
      [
        installResource('z', 'name-z', 'COMPLETED'),
        installResource('a', 'name-a', 'IN_PROGRESS'),
      ],
      [],
    );
    expect(result.map((r) => r.resourceId)).toEqual(['z', 'a']);
  });

  it('matches confirmed by resourceId and fills databaseType', () => {
    const result = joinGcpResources(
      [installResource('r1', 'r1-name', 'COMPLETED')],
      [confirmedResource('r1', 'MYSQL')],
    );
    expect(result[0]).toMatchObject({
      resourceId: 'r1',
      databaseType: 'MYSQL',
      installationStatus: 'COMPLETED',
    });
  });

  it('falls back to null for missing confirmed entry (databaseType)', () => {
    const result = joinGcpResources(
      [installResource('r1', 'r1-name', 'IN_PROGRESS')],
      [],
    );
    expect(result[0].databaseType).toBeNull();
  });

  it('uses GcpResourceStatus.resourceName for databaseName', () => {
    const result = joinGcpResources(
      [
        installResource('r1', 'service-db-prod', 'COMPLETED'),
        installResource('r2', undefined, 'IN_PROGRESS'),
      ],
      [],
    );
    expect(result[0].databaseName).toBe('service-db-prod');
    expect(result[1].databaseName).toBeNull();
  });

  it('region is null pending later wave (ConfirmedResource lacks the field)', () => {
    const result = joinGcpResources(
      [installResource('r1', 'name', 'COMPLETED')],
      [confirmedResource('r1', 'MYSQL')],
    );
    expect(result[0].region).toBeNull();
  });

  it('preserves source GcpResourceStatus reference for downstream step lookup', () => {
    const installation = installResource('r1', 'name', 'IN_PROGRESS', {
      service: 'IN_PROGRESS',
      bdc: 'FAIL',
    });
    const result = joinGcpResources([installation], []);
    expect(result[0].source).toBe(installation);
    expect(result[0].source.serviceSideTerraformApply.status).toBe('IN_PROGRESS');
    expect(result[0].source.bdcSideTerraformApply.status).toBe('FAIL');
  });

  it('confirmed entries without matching installation are dropped (installation drives output)', () => {
    const result = joinGcpResources(
      [installResource('r1', 'name', 'COMPLETED')],
      [
        confirmedResource('r1', 'MYSQL'),
        confirmedResource('r-orphan', 'POSTGRESQL'),
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0].resourceId).toBe('r1');
  });
});
