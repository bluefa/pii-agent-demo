import { describe, expect, it } from 'vitest';
import type { Project } from '@/lib/types';
import { extractTargetSource } from '@/lib/target-source-response';

const project = {
  id: 'proj-1',
  targetSourceId: 1001,
  projectCode: 'N-IRP-001',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'Azure',
  processStatus: 1,
  status: {},
  resources: [],
  terraformState: { bdcTf: 'PENDING' },
  createdAt: '2026-02-16T10:00:00Z',
  updatedAt: '2026-02-16T10:10:00Z',
  name: 'proj-1',
  description: 'PII Agent 설치 대상',
  isRejected: false,
} as unknown as Project;

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
});
