// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ScanControllerRenderProps } from '@/app/components/features/scan/ScanPanel';

vi.mock('@/app/lib/api', () => ({
  getConfirmResources: vi.fn().mockResolvedValue({ resources: [] }),
  createApprovalRequest: vi.fn().mockResolvedValue(undefined),
}));

// Two candidates → the EMPTY-scan fixture below lands in the 'list' phase, which
// mounts the lifted approval CardActionBar (C-2). c-1 seeds as selected; c-2 is an
// unselected TARGET without a reason, so the approval CTA rests disabled.
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
      selected: true,
      exclusionReason: null,
      metadata: { provider: 'AWS', resourceType: 'RDS', region: 'ap-northeast-2' },
    },
    {
      id: 'c-2',
      resourceId: 'res-2',
      resourceName: 'res-2',
      type: 'RDS',
      databaseType: 'MYSQL',
      integrationCategory: 'TARGET',
      behaviorKey: 'default',
      selected: false,
      exclusionReason: null,
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
  () => ({
    CandidateResourceTable: ({ candidates, emptyMessage }: { candidates: unknown[]; emptyMessage?: string }) =>
      candidates.length === 0 ? <p>{emptyMessage}</p> : <div data-testid="table" data-count={candidates.length} />,
  }),
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
  // in the section's bottom CardActionBar (C-2). It rests DISABLED here because
  // c-2 is an unselected TARGET without an exclusion reason.
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

  // The table group closes with the same pagination footer step 2 uses (the only
  // outlined segments are the toolbar and this bar); the scan band above stays
  // a separate bordered strip rather than the table's toolbar segment.
  it('renders the step-2 pagination footer under the table in the list phase', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    expect(screen.getByLabelText('페이지당 표시 건수')).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 페이지' })).toBeTruthy();
    expect(screen.getByText('1–2')).toBeTruthy();
  });

  // The step-2 toolbar (search + DB Type/Region filter) drives the same derivation
  // hook — searching narrows the rendered rows and a 0-hit query swaps the table
  // for the filter-empty state and drops the pagination bar.
  it('filters rows through the step-2 toolbar search', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    expect(screen.getByTestId('table').getAttribute('data-count')).toBe('2');

    const search = screen.getByLabelText('리소스 검색');
    fireEvent.change(search, { target: { value: 'res-1' } });
    expect(screen.getByTestId('table').getAttribute('data-count')).toBe('1');

    fireEvent.change(search, { target: { value: 'no-such-resource' } });
    expect(screen.queryByTestId('table')).toBeNull();
    expect(screen.getByText('조건에 맞는 결과가 없어요.')).toBeTruthy();
    expect(screen.queryByLabelText('페이지당 표시 건수')).toBeNull();

    // CTA counts stay full-list-based — filtering is a view concern.
    expect(screen.getByText(/건 선택됨/)).toBeTruthy();
  });

  // The disable reason is explained in place: hovering the blocked CTA names the
  // rule and the offending resources (the disabled button itself swallows pointer
  // events, so the Tooltip wrapper carries the hover).
  it('explains the disabled approval CTA on hover — missing exclusion reasons', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    const cta = await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    fireEvent.mouseEnter(cta.parentElement!);
    expect(await screen.findByText('제외 사유 미입력 1건')).toBeTruthy();
    expect(screen.getByText(/사유가 필요해요: res-2/)).toBeTruthy();
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
