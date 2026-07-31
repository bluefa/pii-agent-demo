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

// Mutable so individual tests can swap the scan snapshot (e.g. the NO_SCAN sentinel).
const scanRenderProps: ScanControllerRenderProps = {
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
};

vi.mock('@/app/components/features/scan/ScanPanel', () => ({
  ScanController: ({
    children,
  }: {
    targetSourceId: number;
    onScanComplete?: () => void;
    children: (props: ScanControllerRenderProps) => React.ReactNode;
  }) => children(scanRenderProps),
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
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    const h2 = await screen.findByRole('heading', { level: 2, name: '연동 대상 DB 선택' });
    expect(h2.className).toContain('text-[22px]');
    expect(h2.className).toContain('font-extrabold');
  });

  // Step 2·3 header grammar ported to step 1: step tag above the fixed title,
  // then the guidance sentence naming the whole flow (scan → select → approval).
  it('renders the 1번째 단계 tag and the detailed guidance sentence', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    await screen.findByRole('heading', { level: 2, name: '연동 대상 DB 선택' });
    expect(screen.getByText('1번째 단계')).toBeTruthy();
    expect(screen.getByText(/인프라 스캔으로 AWS 계정의 보유 DB를 조회한 뒤/)).toBeTruthy();
  });

  // Lifted from CandidateResourceTable: the approve CTA + count hint render once
  // in the section's bottom CardActionBar (C-2), gated until a row is selected.
  it('renders the approval action bar with the count hint in the list phase', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    const cta = await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/건 선택됨/)).toBeTruthy();
  });

  // A list with no finished scan job (mock seed / lost history) still needs a scan
  // entry point — the strip is the only one, so it renders the honest no-record
  // fallback instead of disappearing.
  it('renders the no-record fallback strip when the list exists without a scan job', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    await screen.findByRole('heading', { level: 2, name: '연동 대상 DB 선택' });
    expect(screen.getByText('아직 스캔한 적이 없어요')).toBeTruthy();
    expect(screen.getByRole('button', { name: '스캔 시작' })).toBeTruthy();
    expect(screen.queryByText(/마지막 스캔/)).toBeNull();
  });

  // The mock BFF synthesizes a NO_SCAN sentinel job when no scan ever ran — it is
  // not a finished scan, so it must not surface as "마지막 스캔 실패".
  it('treats the NO_SCAN sentinel job as never-scanned', async () => {
    scanRenderProps.latestJob = {
      id: 0,
      scan_status: 'NO_SCAN' as never,
      target_source_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      render(
        <CandidateResourceSection
          targetSourceId={1}
          provider="AWS"
          readonly={false}
          refreshProject={async () => {}}
        />,
      );
      await screen.findByRole('heading', { level: 2, name: '연동 대상 DB 선택' });
      expect(screen.queryByText(/마지막 스캔/)).toBeNull();
      expect(screen.getByText('아직 스캔한 적이 없어요')).toBeTruthy();
      expect(screen.getByRole('button', { name: '스캔 시작' })).toBeTruthy();
    } finally {
      scanRenderProps.latestJob = null;
    }
  });
});
