// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import type { IdcApprovalRequestView } from '@/app/lib/api/idc';

vi.mock('@/app/lib/api', () => ({ getProject: vi.fn(), confirmApprovalUnavailable: vi.fn() }));
vi.mock('@/app/lib/api/idc', () => ({ getIdcApprovalRequestLatest: vi.fn() }));
vi.mock('@/app/components/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { getIdcApprovalRequestLatest } from '@/app/lib/api/idc';
import { IdcStep2WaitingApproval } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep2WaitingApproval';

const project: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'idc-1',
  targetSourceId: 1021,
  projectCode: 'IDC-021',
  serviceCode: 'idc',
  serviceName: 'idc',
  processStatus: ProcessStatus.WAITING_APPROVAL,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'IDC',
  description: 'desc',
  isRejected: false,
  cloudProvider: 'IDC',
};

const view = (rejected: IdcApprovalRequestView['rejected']): IdcApprovalRequestView => ({
  resources: [],
  unavailableReason: null,
  rejected,
  requestedAt: '2026-09-01T00:00:00Z',
  requestedBy: 'dev-1',
});

const mount = () =>
  render(
    <IdcStep2WaitingApproval
      project={project}
      identity={{} as ProjectIdentity}
      providerLabel="IDC"
      onProjectUpdate={vi.fn()}
    />,
  );

describe('IdcStep2WaitingApproval verdict', () => {
  it('holds the badge and the cancel button until the verdict arrives, then shows the rejection', async () => {
    let resolve!: (v: IdcApprovalRequestView) => void;
    vi.mocked(getIdcApprovalRequestLatest).mockReturnValueOnce(
      new Promise<IdcApprovalRequestView>((r) => { resolve = r; }),
    );
    mount();

    // Loading: no pending copy to flash, no cancel a closed request would answer with 404/409.
    expect(screen.queryByText('승인 대기')).toBeNull();
    expect(screen.queryByText('반려')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    resolve(view({ reason: 'Port 확인 필요', processedAt: '2026-09-02T00:00:00Z', processedBy: 'admin-1' }));

    expect(await screen.findByText('반려')).toBeTruthy();
    expect(screen.getByText('Port 확인 필요')).toBeTruthy();
    expect(screen.getByText('admin-1')).toBeTruthy();
    expect(screen.queryByText('승인 대기')).toBeNull();
    expect(screen.getByRole('button', { name: /연동 대상 다시 선택하기/ })).toBeTruthy();
  });

  it('shows the pending badge and the cancel button when there is no verdict', async () => {
    vi.mocked(getIdcApprovalRequestLatest).mockResolvedValueOnce(view(null));
    mount();
    expect(await screen.findByText('승인 대기')).toBeTruthy();
    expect(screen.queryByText('반려')).toBeNull();
  });
});
