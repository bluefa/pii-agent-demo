import { describe, expect, it } from 'vitest';
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
  createdAt: '2026-02-16T10:00:00Z',
  updatedAt: '2026-02-16T10:10:00Z',
  name: 'proj-1',
  description: 'PII Agent 설치 대상',
  isRejected: false,
};

describe('extractTargetSource', () => {
  it('unwraps camelCase envelope payload', () => {
    expect(extractTargetSource({ targetSource: project })).toEqual(project);
  });

  it('normalizes Issue #222 camelCase target source detail to the TargetSource read model', () => {
    expect(extractTargetSource({
      description: 'Azure detail only payload',
      targetSourceId: 4242,
      processStatus: 'CONFIRMED',
      cloudProvider: 'AZURE',
      createdAt: '2026-03-29T00:00:00Z',
      metadata: {
        tenantId: 'tenant-1',
        subscriptionId: 'subscription-1',
      },
    })).toEqual({
      id: 'target-source-4242',
      targetSourceId: 4242,
      projectCode: '',
      serviceCode: '',
      cloudProvider: 'Azure',
      processStatus: ProcessStatus.INSTALLING,
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
      createdAt: '2026-02-16T10:00:00Z',
      updatedAt: '2026-02-16T10:10:00Z',
      name: 'proj-1',
      description: '',
      isRejected: false,
    });
    expect(result.cloudProvider).toBe('Azure');
  });
});
