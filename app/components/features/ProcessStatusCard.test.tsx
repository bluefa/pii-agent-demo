// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';

vi.mock('@/app/components/features/process-status/ApprovalWaitingCard', () => ({
  ApprovalWaitingCard: () => {
    throw new Error('ApprovalWaitingCard must not mount inside ProcessStatusCard after Phase 3');
  },
}));

vi.mock('@/app/components/features/process-status/ApprovalApplyingBanner', () => ({
  ApprovalApplyingBanner: () => {
    throw new Error('ApprovalApplyingBanner must not mount inside ProcessStatusCard after Phase 3');
  },
}));

vi.mock('@/app/lib/api', () => ({
  getProcessStatus: vi.fn().mockResolvedValue({ process_status: 'PENDING' }),
  getProject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/app/components/features/process-status', () => ({
  StepProgressBar: () => null,
}));

vi.mock('@/app/components/features/history', () => ({
  ProjectHistoryPanel: () => null,
}));

import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';

const baseFixture: CloudTargetSource = {
  id: 'aws-proj-1',
  targetSourceId: 2001,
  projectCode: 'AWS-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.WAITING_APPROVAL,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'AWS PII Agent',
  description: 'AWS RDS, S3 resources',
  isRejected: false,
  cloudProvider: 'AWS',
  awsAccountId: '123456789012',
};

describe('ProcessStatusCard Phase 3 extraction', () => {
  it('renders without mounting ApprovalWaitingCard for WAITING_APPROVAL', () => {
    expect(() =>
      render(
        <ProcessStatusCard
          project={{ ...baseFixture, processStatus: ProcessStatus.WAITING_APPROVAL, isRejected: false }}
        />,
      ),
    ).not.toThrow();
  });

  it('renders without mounting ApprovalApplyingBanner for APPLYING_APPROVED', () => {
    expect(() =>
      render(
        <ProcessStatusCard
          project={{ ...baseFixture, processStatus: ProcessStatus.APPLYING_APPROVED }}
        />,
      ),
    ).not.toThrow();
  });
});
