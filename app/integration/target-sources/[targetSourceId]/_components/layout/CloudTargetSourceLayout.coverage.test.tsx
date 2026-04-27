// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingTargetConfirmationStep',
  () => ({
    WaitingTargetConfirmationStep: () => <div data-testid="step-waiting-target-confirmation" />,
  }),
);

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep',
  () => ({
    WaitingApprovalStep: () => <div data-testid="step-waiting-approval" />,
  }),
);

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep',
  () => ({
    ApplyingApprovedStep: () => <div data-testid="step-applying-approved" />,
  }),
);

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/InstallingStep',
  () => ({
    InstallingStep: () => <div data-testid="step-installing" />,
  }),
);

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestStep',
  () => ({
    ConnectionTestStep: () => <div data-testid="step-connection-test" />,
  }),
);

import { CloudTargetSourceLayout } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

const baseFixture: CloudTargetSource = {
  id: 'proj-1',
  targetSourceId: 1001,
  projectCode: 'TEST-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Test',
  description: 'fixture',
  isRejected: false,
  cloudProvider: 'Azure',
};

const identityFixture: ProjectIdentity = {
  cloudProvider: 'Azure',
  monitoringMethod: 'Azure Agent',
  jiraLink: null,
  identifiers: [],
};

// Single source of truth — adding a new ProcessStatus enum value will fail the
// `Object.values` exhaustion check below until it's mapped here.
const STATUS_TO_SENTINEL: Record<ProcessStatus, string> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]: 'step-waiting-target-confirmation',
  [ProcessStatus.WAITING_APPROVAL]: 'step-waiting-approval',
  [ProcessStatus.APPLYING_APPROVED]: 'step-applying-approved',
  [ProcessStatus.INSTALLING]: 'step-installing',
  [ProcessStatus.WAITING_CONNECTION_TEST]: 'step-connection-test',
  [ProcessStatus.CONNECTION_VERIFIED]: 'step-connection-test',
  [ProcessStatus.INSTALLATION_COMPLETE]: 'step-connection-test',
};

const renderForStatus = (status: ProcessStatus) =>
  render(
    <CloudTargetSourceLayout
      project={{ ...baseFixture, processStatus: status }}
      identity={identityFixture}
      providerLabel="Azure Infrastructure"
      action={null}
      onProjectUpdate={() => {}}
    />,
  );

const ENUM_VALUES = Object.values(ProcessStatus).filter(
  (value): value is ProcessStatus => typeof value === 'number',
);

describe('CloudTargetSourceLayout process-status coverage', () => {
  it.each(Object.entries(STATUS_TO_SENTINEL).map(([status, sentinel]) => [Number(status) as ProcessStatus, sentinel]))(
    'routes ProcessStatus=%s to %s',
    (status, sentinel) => {
      renderForStatus(status);
      expect(screen.getByTestId(sentinel)).toBeTruthy();
    },
  );

  it('maps every ProcessStatus enum value to a step sentinel (no silent default)', () => {
    for (const status of ENUM_VALUES) {
      expect(STATUS_TO_SENTINEL[status], `ProcessStatus=${status} missing from coverage map`).toBeDefined();
    }
  });
});
