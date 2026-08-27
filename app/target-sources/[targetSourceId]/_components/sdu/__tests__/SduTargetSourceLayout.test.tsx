// @vitest-environment jsdom

/**
 * Which of the four screens a status lands on.
 *
 * The cloud and IDC layouts switch on `processStatus` and get one screen per status. SDU
 * folds — 2·3·4 → 데이터 업로드, 5·6 → SDU 연동중 — and a fold is the kind of thing that is
 * silently wrong: routing status 5 to a 연결 테스트 screen that SDU does not have would
 * render a perfectly healthy-looking page for a step the owner cannot act on.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessStatus, type TargetSource } from '@/lib/types';

vi.mock('@/app/target-sources/[targetSourceId]/_components/common', () => ({
  ProjectPageMeta: ({
    project,
    identity,
  }: {
    project: TargetSource;
    identity: { cloudProvider: string; identifiers: unknown[] };
  }) => (
    <div
      data-testid="page-meta"
      data-sdu={String(project.isSduType)}
      data-provider={identity.cloudProvider}
      data-identifiers={String(identity.identifiers.length)}
    />
  ),
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep1Define', () => ({
  SduStep1Define: () => <div data-testid="step-1" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep4Upload', () => ({
  SduStep4Upload: () => <div data-testid="step-4" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep6Integrating', () => ({
  SduStep6Integrating: () => <div data-testid="step-6" />,
}));
vi.mock('@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep7Complete', () => ({
  SduStep7Complete: () => <div data-testid="step-7" />,
}));

import { SduProjectPage } from '@/app/target-sources/[targetSourceId]/_components/sdu/SduProjectPage';

const project = (processStatus: ProcessStatus): TargetSource => ({
  id: 'sdu-1',
  targetSourceId: 4242,
  projectCode: 'SDU-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus,
  createdAt: '2026-08-20T09:00:00Z',
  updatedAt: '2026-08-25T09:00:00Z',
  name: 'SDU target',
  description: '',
  isRejected: false,
  cloudProvider: 'AWS',
  awsAccountId: '482915736204',
  isTerraformExecutionGranted: false,
  isSduType: true,
});

const mount = (processStatus: ProcessStatus) =>
  render(<SduProjectPage project={project(processStatus)} onProjectUpdate={vi.fn()} />);

describe('SduProjectPage — the fold', () => {
  it.each([
    ['WAITING_TARGET_CONFIRMATION', ProcessStatus.WAITING_TARGET_CONFIRMATION, 1],
    ['WAITING_APPROVAL', ProcessStatus.WAITING_APPROVAL, 4],
    ['APPLYING_APPROVED', ProcessStatus.APPLYING_APPROVED, 4],
    ['INSTALLING', ProcessStatus.INSTALLING, 4],
    ['WAITING_CONNECTION_TEST', ProcessStatus.WAITING_CONNECTION_TEST, 6],
    ['CONNECTION_VERIFIED', ProcessStatus.CONNECTION_VERIFIED, 6],
    ['INSTALLATION_COMPLETE', ProcessStatus.INSTALLATION_COMPLETE, 7],
  ] as const)('%s renders step %d', (_name, status, step) => {
    mount(status);
    expect(screen.getByTestId(`step-${step}`)).toBeTruthy();
    // Exactly one screen — a fold that rendered two would look like a long page.
    expect(screen.getAllByTestId(/^step-\d$/)).toHaveLength(1);
  });

  it('renders nothing for a status outside the seven', () => {
    // The status arrives over the wire. Guessing a screen for an unknown one would put
    // the owner on a step they are provably not on.
    const { container } = mount(99 as ProcessStatus);
    expect(container.innerHTML).toBe('');
  });
});

describe('SduProjectPage — identity', () => {
  it('carries the header, and hands it a target it can recognise as SDU', () => {
    mount(ProcessStatus.INSTALLING);
    expect(screen.getByTestId('page-meta').getAttribute('data-sdu')).toBe('true');
  });

  it('publishes no cloud identifiers', () => {
    // ⛔ The fixture HAS an `awsAccountId`. Nothing on this page installs into that
    // account — the owner uploads the data themselves — so naming it on the header would
    // point at a thing no step here acts on. IDC made the same call (결정 #49).
    mount(ProcessStatus.INSTALLING);
    expect(screen.getByTestId('page-meta').getAttribute('data-identifiers')).toBe('0');
  });

  it('passes the underlying cloud through untouched', () => {
    // SDU is not a `CloudProvider` (lib/types/sdu.ts), so `identity.cloudProvider` keeps
    // whatever the target really sits on. It never reaches the screen — the header reads
    // `isSduType` and draws the SDU mark off that — but forcing a fake value here would
    // put a lie into a typed field for the sake of a rendering decision made elsewhere.
    mount(ProcessStatus.INSTALLING);
    expect(screen.getByTestId('page-meta').getAttribute('data-provider')).toBe('AWS');
  });
});
