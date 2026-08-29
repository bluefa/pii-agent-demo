// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';

/** The identity is built HERE, so the label it carries can only be read from this hop. */
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

import { GcpProjectPage } from '@/app/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage';

const gcpBaseFixture: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'gcp-proj-1',
  targetSourceId: 1020,
  projectCode: 'GCP-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'GCP PII Agent - DB 연동',
  description: 'GCP Cloud SQL 리소스에 PII Agent 설치',
  isRejected: false,
  cloudProvider: 'GCP',
  gcpProjectId: 'gcp-fixture-1',
};

describe('GcpProjectPage routing', () => {
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
      <GcpProjectPage
        project={{ ...gcpBaseFixture, processStatus: status }}
        onProjectUpdate={() => {}}
      />,
    );
    expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
  });
});

describe('GcpProjectPage — the one fact it states', () => {
  it('names it 「GCP Project ID」 (오너 2026-08-29)', () => {
    // ⛔ The owner's spelling, replacing the v16 mockup's bare 「Project ID」. It is
    // pinned because nothing else would notice it changing: the label is the whole of
    // this page's contribution to the header, and it is a lone cell so a longer label
    // costs no height.
    //
    // 📝 The ops console names this same field 「프로젝트」, so the two screens differ here
    // on purpose. 「프로젝트 ID」 is the one-word change if that is ever revisited.
    render(<GcpProjectPage project={gcpBaseFixture} onProjectUpdate={() => {}} />);
    expect(seen.identity?.identifiers.map((it) => it.label)).toEqual(['GCP Project ID']);
    expect(seen.identity?.identifiers[0].mono).toBe(true);
  });

  it('states exactly one fact and no install mode — which is why it renders inline', () => {
    // The inline rule counts cells, so this page's cell COUNT is load-bearing: add a
    // second identifier or an install mode here and GCP goes back to stacked, silently.
    render(<GcpProjectPage project={gcpBaseFixture} onProjectUpdate={() => {}} />);
    expect(seen.identity?.identifiers).toHaveLength(1);
    expect(seen.identity?.installMode).toBeUndefined();
  });
});
