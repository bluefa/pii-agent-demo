import { describe, it, expect } from 'vitest';
import { getCurrentStep, createInitialProjectStatus } from '@/lib/process/calculator';
import { ProcessStatus } from '@/lib/types';
import type { ProjectStatus } from '@/lib/types';

describe('getCurrentStep — REJECTED 분기', () => {
  it('targets.confirmed=true + approval.status=REJECTED → WAITING_APPROVAL (Step 2 유지)', () => {
    const status: ProjectStatus = {
      ...createInitialProjectStatus(),
      scan: { status: 'COMPLETED' },
      targets: { confirmed: true, selectedCount: 1, excludedCount: 0 },
      approval: {
        status: 'REJECTED',
        rejectedAt: '2026-04-29T00:00:00Z',
        rejectionReason: '재검토',
      },
    };

    expect(getCurrentStep(status)).toBe(ProcessStatus.WAITING_APPROVAL);
  });

  it('targets.confirmed=false + approval.status=REJECTED → WAITING_APPROVAL (defensive: legacy snapshot)', () => {
    const status: ProjectStatus = {
      ...createInitialProjectStatus(),
      scan: { status: 'COMPLETED' },
      targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
      approval: { status: 'REJECTED', rejectedAt: '2026-04-29T00:00:00Z', rejectionReason: '재검토' },
    };

    expect(getCurrentStep(status)).toBe(ProcessStatus.WAITING_APPROVAL);
  });

  it('targets.confirmed=false + approval.status=CANCELLED (system-reset 직후) → WAITING_TARGET_CONFIRMATION', () => {
    const status: ProjectStatus = {
      ...createInitialProjectStatus(),
      scan: { status: 'COMPLETED' },
      targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
      approval: { status: 'CANCELLED' },
    };

    expect(getCurrentStep(status)).toBe(ProcessStatus.WAITING_TARGET_CONFIRMATION);
  });

  it('targets.confirmed=true + approval.status=PENDING → WAITING_APPROVAL (기존 동작 보존)', () => {
    const status: ProjectStatus = {
      ...createInitialProjectStatus(),
      scan: { status: 'COMPLETED' },
      targets: { confirmed: true, selectedCount: 1, excludedCount: 0 },
      approval: { status: 'PENDING' },
    };

    expect(getCurrentStep(status)).toBe(ProcessStatus.WAITING_APPROVAL);
  });
});
