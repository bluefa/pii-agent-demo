import { describe, expect, it } from 'vitest';
import { camelCaseKeys } from '@/lib/object-case';
import {
  normalizeTargetSourceCreationCandidates,
  normalizeTargetSourceInfo,
  normalizeTargetSourceDetails,
} from '@/lib/target-source-creation';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
type TargetSourceCreationCandidateResponseWire = z.infer<typeof schemas.TargetSourceCreationCandidateResponse>;
type TargetSourceInfoWire = z.infer<typeof schemas.TargetSourceInfo>;
type TargetSourceDetailWire = z.infer<typeof schemas.TargetSourceDetail>;

// Exercises the ADR-019 D1/D6 casing boundary exactly as the route handlers do:
// a swagger-shaped WIRE (snake) payload → camelCaseKeys → normalizeX → camel
// DOMAIN. The normalizers are the only place an `as T` could hide, so they are
// asserted directly (incl. the graceful-degrade fallbacks).

describe('normalizeTargetSourceCreationCandidates (35)', () => {
  it('maps a bare array of snake candidates → camel domain (ADD + DUPLICATE)', () => {
    const wire: TargetSourceCreationCandidateResponseWire[] = [
      {
        status: 'ADD',
        cloud_type: 'AWS',
        is_sdu_type: false,
        is_china_region: true,
        metadata: { aws_account_id: '123456789012', description: 'prod' },
        grant_service_terraform_execution_permission: true,
      },
      {
        status: 'DUPLICATE',
        cloud_type: 'GCP',
        is_sdu_type: true,
        is_china_region: false,
        metadata: { project_id: 'gcp-proj-1' },
        existing_target_source_id: 4242,
      },
    ];

    const domain = normalizeTargetSourceCreationCandidates(camelCaseKeys(wire));

    expect(domain).toEqual([
      {
        status: 'ADD',
        cloudType: 'AWS',
        isSduType: false,
        isChinaRegion: true,
        metadata: { awsAccountId: '123456789012', description: 'prod' },
        grantServiceTerraformExecutionPermission: true,
      },
      {
        status: 'DUPLICATE',
        cloudType: 'GCP',
        isSduType: true,
        isChinaRegion: false,
        metadata: { projectId: 'gcp-proj-1' },
        existingTargetSourceId: 4242,
      },
    ]);
  });

  it('preserves a null existing_target_source_id and defaults unknown enums', () => {
    const wire = [
      {
        status: 'WEIRD',
        cloud_type: 'mars',
        is_sdu_type: false,
        is_china_region: false,
        metadata: {},
        existing_target_source_id: null,
        grant_service_terraform_execution_permission: null,
      },
    ];

    const [c] = normalizeTargetSourceCreationCandidates(camelCaseKeys(wire));

    expect(c.status).toBe('ADD'); // unknown → ADD
    expect(c.cloudType).toBe('UNKNOWN'); // unknown → UNKNOWN
    expect(c.existingTargetSourceId).toBeNull();
    expect(c.grantServiceTerraformExecutionPermission).toBeNull();
  });

  it('returns [] for a non-array payload', () => {
    expect(normalizeTargetSourceCreationCandidates({})).toEqual([]);
    expect(normalizeTargetSourceCreationCandidates(null)).toEqual([]);
  });
});

describe('normalizeTargetSourceInfo (36)', () => {
  it('maps camel-top + snake-metadata wire → uniform camel domain', () => {
    const wire: TargetSourceInfoWire = {
      targetSourceId: 9001,
      description: 'desc',
      cloudProvider: 'AWS',
      createdAt: '2026-06-24T00:00:00Z',
      serviceCode: 'SERVICE-A',
      serviceName: 'Service A',
      updatedAt: '2026-06-24T00:01:00Z',
      metadata: {
        aws_account_id: '123456789012',
        is_sdu_type: false,
        is_china_region: true,
        grant_service_terraform_execution_permission: true,
      },
    };

    const domain = normalizeTargetSourceInfo(camelCaseKeys(wire));

    expect(domain).toEqual({
      targetSourceId: 9001,
      description: 'desc',
      cloudProvider: 'AWS',
      createdAt: '2026-06-24T00:00:00Z',
      serviceCode: 'SERVICE-A',
      serviceName: 'Service A',
      updatedAt: '2026-06-24T00:01:00Z',
      metadata: {
        awsAccountId: '123456789012',
        isSduType: false,
        isChinaRegion: true,
        grantServiceTerraformExecutionPermission: true,
      },
    });
  });

  it('omits absent optional fields (no undefined keys, no metadata)', () => {
    const domain = normalizeTargetSourceInfo(camelCaseKeys({ targetSourceId: 1 }));
    expect(domain).toEqual({ targetSourceId: 1 });
    expect('metadata' in domain).toBe(false);
  });
});

describe('normalizeTargetSourceDetails (37)', () => {
  it('maps a bare array of snake TargetSourceDetail → camel domain', () => {
    const wire: TargetSourceDetailWire[] = [
      {
        description: '승인 반영 중',
        target_source_id: 1011,
        service_code: 'SERVICE-A',
        service_name: 'Service A',
        process_status: 'CONFIRMING',
        cloud_provider: 'AZURE',
        created_at: '2026-03-29T00:00:00Z',
        metadata: { tenant_id: 't-1', subscription_id: 's-1' },
      },
    ];

    const domain = normalizeTargetSourceDetails(camelCaseKeys(wire));

    expect(domain).toEqual([
      {
        description: '승인 반영 중',
        targetSourceId: 1011,
        serviceCode: 'SERVICE-A',
        serviceName: 'Service A',
        processStatus: 'CONFIRMING',
        cloudProvider: 'AZURE',
        createdAt: '2026-03-29T00:00:00Z',
        metadata: { tenantId: 't-1', subscriptionId: 's-1' },
      },
    ]);
  });

  it('drops an unknown process_status (omitted) and returns [] for non-array', () => {
    const [d] = normalizeTargetSourceDetails(
      camelCaseKeys([{ target_source_id: 1, process_status: 'BOGUS' }]),
    );
    expect(d.targetSourceId).toBe(1);
    expect('processStatus' in d).toBe(false);
    expect(normalizeTargetSourceDetails({})).toEqual([]);
  });
});
