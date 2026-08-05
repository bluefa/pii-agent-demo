// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AzureInstallDetail } from '@/app/components/features/process-status/azure/install-detail-adapter';

let statusResult: Promise<unknown>;

vi.mock('@/app/lib/api/azure', () => ({
  getAzureInstallationStatus: () => statusResult,
}));

const detail: AzureInstallDetail = {
  lastCheck: { status: 'SUCCESS' },
  resources: [],
};

vi.mock('@/app/components/features/process-status/azure/install-detail-adapter', () => ({
  buildAzureInstallDetail: () => detail,
}));

vi.mock('@/app/components/features/process-status/install-status-detail/InstallStatusDetail', () => ({
  InstallStatusDetail: () => <div data-testid="install-detail" />,
}));

import { AzureInstallationInline } from '@/app/components/features/process-status/azure/AzureInstallationInline';

const SKELETON = 'Azure 설치 상태 확인 중';

const renderInline = (confirmedLoading: boolean) =>
  render(
    <AzureInstallationInline targetSourceId={1003} confirmed={[]} confirmedLoading={confirmedLoading} />,
  );

describe('AzureInstallationInline gate', () => {
  beforeEach(() => {
    statusResult = Promise.resolve({});
  });

  /**
   * The caller's test only proves the prop is passed; this proves it is acted
   * on. Without it the inline paints the detail with an empty meta the moment
   * installation-status lands, blanking Region / Database Type until the
   * confirmed rows arrive.
   */
  it('holds the skeleton while 확정 연동 loads, even after the status lands', async () => {
    renderInline(true);

    await waitFor(() => expect(screen.getByLabelText(SKELETON)).toBeTruthy());
    expect(screen.queryByTestId('install-detail')).toBeNull();
  });

  it('shows the detail once neither fetch is pending', async () => {
    renderInline(false);

    await waitFor(() => expect(screen.getByTestId('install-detail')).toBeTruthy());
    expect(screen.queryByLabelText(SKELETON)).toBeNull();
  });

  /**
   * Error before loading: `confirmedLoading` is OR'd into the loading branch, so
   * checking loading first would hide a failed installation-status — and its
   * retry — behind the confirmed fetch. If that one then fails too, the card
   * unmounts and the user never learns why.
   */
  it('surfaces an installation-status failure even while 확정 연동 is still pending', async () => {
    statusResult = Promise.reject(new Error('상태 조회 실패'));
    renderInline(true);

    await waitFor(() => expect(screen.getByText('상태 조회 실패')).toBeTruthy());
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
    expect(screen.queryByLabelText(SKELETON)).toBeNull();
  });
});
