import { describe, expect, it } from 'vitest';
import { createInitialProjectStatus } from '@/lib/process';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatus } from '@/lib/types';
import { extractTargetSource } from '@/lib/target-source-response';

const project: CloudTargetSource = {
  id: 'proj-1',
  targetSourceId: 1001,
  projectCode: 'N-IRP-001',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'Azure',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  status: createInitialProjectStatus(),
  terraformState: { bdcTf: 'PENDING' },
  createdAt: '2026-02-16T10:00:00Z',
  updatedAt: '2026-02-16T10:10:00Z',
  name: 'proj-1',
  description: 'PII Agent 설치 대상',
  isRejected: false,
};

describe('extractTargetSource', () => {
  it('returns flat payload as-is', () => {
    expect(extractTargetSource(project)).toBe(project);
  });

  it('unwraps camelCase envelope payload', () => {
    expect(extractTargetSource({ targetSource: project })).toBe(project);
  });

  it('unwraps snake_case envelope payload', () => {
    expect(extractTargetSource({ target_source: project })).toBe(project);
  });

  it('unwraps legacy project envelope payload', () => {
    expect(extractTargetSource({ project })).toBe(project);
  });

  it('normalizes Issue #222 target source detail to the Project read model', () => {
    expect(extractTargetSource({
      description: 'Azure detail only payload',
      target_source_id: 4242,
      process_status: 'CONFIRMED',
      cloud_provider: 'AZURE',
      created_at: '2026-03-29T00:00:00Z',
      metadata: {
        tenant_id: 'tenant-1',
        subscription_id: 'subscription-1',
      },
    })).toEqual({
      id: 'target-source-4242',
      targetSourceId: 4242,
      projectCode: '',
      serviceCode: '',
      cloudProvider: 'Azure',
      processStatus: ProcessStatus.INSTALLING,
      status: {
        scan: {
          status: 'PENDING',
        },
        targets: {
          confirmed: true,
          selectedCount: 0,
          excludedCount: 0,
        },
        approval: {
          status: 'APPROVED',
        },
        installation: {
          status: 'IN_PROGRESS',
        },
        connectionTest: {
          status: 'NOT_TESTED',
        },
      },
      terraformState: {
        bdcTf: 'PENDING',
      },
      createdAt: '2026-03-29T00:00:00Z',
      updatedAt: '2026-03-29T00:00:00Z',
      name: 'TS-4242',
      description: 'Azure detail only payload',
      isRejected: false,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
    });
  });

  it('normalizes AZURE to Azure when a camelCase TargetSource-shaped payload carries the Issue #222 enum', () => {
    const result = extractTargetSource({
      id: 'proj-1',
      targetSourceId: 1003,
      projectCode: 'N-IRP-001',
      serviceCode: 'SERVICE-A',
      cloudProvider: 'AZURE',
      processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
      status: createInitialProjectStatus(),
      terraformState: { bdcTf: 'PENDING' },
      createdAt: '2026-02-16T10:00:00Z',
      updatedAt: '2026-02-16T10:10:00Z',
      name: 'proj-1',
      description: '',
      isRejected: false,
    });
    expect(result.cloudProvider).toBe('Azure');
  });
});
