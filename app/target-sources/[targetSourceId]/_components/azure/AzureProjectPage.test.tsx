// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';

/** The layout is a sentinel, but the identity is built HERE — nothing downstream can be
 *  asked which cells got a second grid track. */
const seen: { identity?: ProjectIdentity } = {};
vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout',
  () => ({
    CloudTargetSourceLayout: ({ identity }: { identity: ProjectIdentity }) => {
      seen.identity = identity;
      return <div data-testid="cloud-target-source-layout-sentinel" />;
    },
  }),
);

import { AzureProjectPage } from '@/app/target-sources/[targetSourceId]/_components/azure/AzureProjectPage';

const azureBaseFixture: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'azure-proj-1',
  targetSourceId: 1003,
  projectCode: 'AZURE-001',
  name: 'Azure PII Agent - DB 연동',
  description: 'Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  cloudProvider: 'Azure',
  tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  isRejected: false,
};

describe('AzureProjectPage routing', () => {
  it.each([
    ProcessStatus.WAITING_TARGET_CONFIRMATION,
    ProcessStatus.WAITING_APPROVAL,
    ProcessStatus.APPLYING_APPROVED,
    ProcessStatus.INSTALLING,
    ProcessStatus.WAITING_CONNECTION_TEST,
    ProcessStatus.CONNECTION_VERIFIED,
    ProcessStatus.INSTALLATION_COMPLETE,
  ])('mounts CloudTargetSourceLayout for processStatus=%s', (status) => {
    render(
      <AzureProjectPage
        project={{ ...azureBaseFixture, processStatus: status }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
  });
});

/**
 * Both Azure identifiers are 36-character UUIDs. Measured on the running app before the
 * fix: each needed 280px and got 217px inside a 240px track — clipped by 63px. The cell
 * takes two tracks now (오너 2026-08-29).
 */
describe('AzureProjectPage — a 36-char UUID does not fit one track', () => {
  const identityOf = (patch: Partial<CloudTargetSource> = {}) => {
    const { unmount } = render(
      <AzureProjectPage project={{ ...azureBaseFixture, ...patch }} onProjectUpdate={() => {}} />,
    );
    const identity = seen.identity;
    unmount();
    if (!identity) throw new Error('identity was never handed to the layout');
    return identity;
  };

  it('gives both UUIDs a second track', () => {
    expect(identityOf().identifiers.map((it) => [it.label, it.wide])).toEqual([
      ['Subscription ID', true],
      ['Tenant ID', true],
    ]);
  });

  it('reads the length, so a short id keeps one track', () => {
    // ⛔ The rule is not a hand-marked list of fields — the same field is narrow when its
    // value is. That is what stops the list rotting when a value changes shape.
    const identity = identityOf({ subscriptionId: 'sub-1', tenantId: 'ten-1' });
    expect(identity.identifiers.every((it) => it.wide === undefined)).toBe(true);
  });
});
