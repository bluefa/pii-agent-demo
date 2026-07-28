// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ScanControllerRenderProps } from '@/app/components/features/scan/ScanPanel';

vi.mock('@/app/lib/api', () => ({
  getConfirmResources: vi.fn().mockResolvedValue({ resources: [] }),
  createApprovalRequest: vi.fn().mockResolvedValue(undefined),
}));

// One candidate → the EMPTY-scan fixture below lands in the 'list' phase, which
// mounts the lifted approval CardActionBar (C-2).
vi.mock('@/lib/resource-catalog', () => ({
  catalogToCandidates: () => [
    {
      id: 'c-1',
      resourceId: 'res-1',
      resourceName: 'res-1',
      type: 'RDS',
      databaseType: 'MYSQL',
      integrationCategory: 'TARGET',
      behaviorKey: 'default',
      metadata: { provider: 'AWS', resourceType: 'RDS', region: 'ap-northeast-2' },
    },
  ],
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
  '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable',
  () => ({ CandidateResourceTable: () => null }),
);

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ warning: () => {}, success: () => {}, error: () => {}, info: () => {} }),
}));

import { CandidateResourceSection } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceSection';

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

  // Lifted from CandidateResourceTable: the approve CTA + count hint render once
  // in the section's bottom CardActionBar (C-2), gated until a row is selected.
  it('renders the approval action bar with the count hint in the list phase', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    const cta = await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/건 선택됨/)).toBeTruthy();
  });
});
