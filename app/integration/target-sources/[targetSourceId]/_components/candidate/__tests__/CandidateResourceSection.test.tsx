// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ScanControllerRenderProps } from '@/app/components/features/scan/ScanPanel';

vi.mock('@/app/lib/api', () => ({
  getConfirmResources: vi.fn().mockResolvedValue({ resources: [] }),
  createApprovalRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/app/components/features/scan/ScanPanel', () => ({
  ScanController: ({
    children,
  }: {
    targetSourceId: number;
    onScanComplete?: () => void;
    children: (props: ScanControllerRenderProps) => React.ReactNode;
  }) =>
    children({
      state: 'EMPTY',
      latestJob: null,
      lastResult: null,
      lastScanAt: undefined,
      progress: 0,
      starting: false,
      loading: false,
      isInProgress: false,
      canStart: true,
      startScan: () => {},
      refresh: () => {},
    }),
}));

vi.mock('@/app/components/features/scan/ScanEmptyState', () => ({
  ScanEmptyState: () => null,
}));
vi.mock('@/app/components/features/scan/ScanErrorState', () => ({
  ScanErrorState: () => null,
}));
vi.mock('@/app/components/features/scan/ScanRunningState', () => ({
  ScanRunningState: () => null,
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable',
  () => ({ CandidateResourceTable: () => null }),
);

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ warning: () => {}, success: () => {}, error: () => {}, info: () => {} }),
}));

import { CandidateResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceSection';

describe('CandidateResourceSection', () => {
  it('renders the card title with the cardTitle token', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    const h2 = await screen.findByRole('heading', { level: 2, name: '연동 대상 DB 선택' });
    expect(h2.className).toContain('text-[26px]');
    expect(h2.className).toContain('font-extrabold');
  });
});
