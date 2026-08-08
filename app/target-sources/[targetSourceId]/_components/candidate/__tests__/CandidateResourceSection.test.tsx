// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { ScanControllerRenderProps } from '@/app/components/features/scan/ScanPanel';

// 조회를 테스트가 붙잡을 수 있어야 한다 — 즉시 resolve 하면 loading 구간이 아예
// 존재하지 않아, "확인 프레임이 스켈레톤을 이긴다"는 단언이 이길 상대가 없어진다.
const { getConfirmResources } = vi.hoisted(() => ({ getConfirmResources: vi.fn() }));

vi.mock('@/app/lib/api', () => ({
  getConfirmResources,
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
  finalizing: false,
  starting: false,
  loading: false,
  isInProgress: false,
  canStart: true,
  startScan: () => {},
  refresh: () => {},
};

/** 실 컨트롤러가 스캔 완료 시 부르는 콜백 — 완료 전환 테스트가 손으로 쏜다. */
let capturedOnScanComplete: (() => void) | undefined;

vi.mock('@/app/components/features/scan/ScanPanel', () => ({
  ScanController: ({
    onScanComplete,
    children,
  }: {
    targetSourceId: number;
    onScanComplete?: () => void;
    children: (props: ScanControllerRenderProps) => React.ReactNode;
  }) => {
    capturedOnScanComplete = onScanComplete;
    return children(scanRenderProps);
  },
}));

vi.mock('@/app/components/features/scan/ScanErrorState', () => ({
  ScanErrorState: () => null,
}));
// 히어로는 stage 만 드러낸다 — 세 프레임의 내용은 ScanRunningState 자신의 테스트가
// 보고, 여기서 보는 건 "어떤 프레임이 언제 서는가"뿐이다.
vi.mock('@/app/components/features/scan/ScanRunningState', () => ({
  ScanRunningState: ({ stage }: { stage: string }) => <div data-testid="hero" data-stage={stage} />,
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
  beforeEach(() => {
    getConfirmResources.mockReset();
    getConfirmResources.mockResolvedValue({ resources: [] });
  });

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
    expect(screen.getByText(/인프라 스캔으로 AWS 계정의 리소스를 조회하고/)).toBeTruthy();
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

  // 완료 전환의 배선 — 훅 자체의 타이밍은 useScanCompletionTransition.test.ts 가
  // 보고, 여기서는 이 화면이 그 단계를 실제로 소비하는지만 본다. 핵심은 스켈레톤
  // 단언이다: 완료 직후 refetch 가 loading 을 켜는데도 화면은 확인 프레임이 쥔다
  // (selectPhase 에서 completing 이 loading 을 이기는 것을 실제 렌더로 확인).
  it('스캔 완료 뒤 확인 프레임이 스켈레톤 대신 화면을 쥔다', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    expect(capturedOnScanComplete).toBeTypeOf('function');

    const hero = () => screen.queryByTestId('hero');
    const skeleton = () => document.querySelector('[aria-busy="true"]');

    // 재조회를 전환보다 오래 붙잡는다 — 프레임이 서 있는 내내 fetchStatus 가
    // loading 이어야 "completing 이 loading 을 이긴다"가 시험대에 오른다.
    let releaseFetch: ((value: { resources: [] }) => void) | undefined;
    getConfirmResources.mockReturnValueOnce(
      new Promise<{ resources: [] }>((resolve) => { releaseFetch = resolve; }),
    );

    vi.useFakeTimers();
    try {
      await act(async () => { capturedOnScanComplete?.(); });

      // settling — 바가 100%에 닿는 구간은 집계 구간과 같은 프레임을 쓴다.
      expect(hero()?.getAttribute('data-stage')).toBe('finalizing');
      expect(skeleton()).toBeNull();
      expect(screen.queryByTestId('table')).toBeNull();

      await act(async () => { vi.advanceTimersByTime(400); });
      expect(hero()?.getAttribute('data-stage')).toBe('complete');
      expect(skeleton()).toBeNull();

      // 프레임이 물러나도 조회가 아직이면 그때는 스켈레톤이 맞다 — 이 시점부터는
      // 사용자가 실제로 기다리는 중이고, 프레임은 조회를 기다려주지 않는다.
      await act(async () => { vi.advanceTimersByTime(1200); });
      expect(hero()).toBeNull();
      expect(skeleton()).not.toBeNull();

      await act(async () => { releaseFetch?.({ resources: [] }); });
      expect(skeleton()).toBeNull();
      expect(screen.getByTestId('table')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  // 라이브 리전이 프레임보다 오래 살아야 마지막 사건(목록 도착)을 알릴 수 있다 —
  // 각 프레임의 제목에 걸면 그 시점엔 노드가 이미 사라지고 없다.
  it('완료부터 목록 도착까지 같은 라이브 리전이 이어서 알린다', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    await screen.findByRole('button', { name: '연동 대상 승인 요청' });

    const live = document.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent).toBe('연동 대상 2건을 불러왔어요.');

    vi.useFakeTimers();
    try {
      await act(async () => { capturedOnScanComplete?.(); });
      await act(async () => { vi.advanceTimersByTime(400); });
      // 확인 프레임: 리전은 같은 노드 그대로, 문장만 바뀐다.
      expect(document.querySelector('[aria-live="polite"]')).toBe(live);
      expect(live?.textContent).toBe('인프라 스캔이 끝났어요.');

      await act(async () => { vi.advanceTimersByTime(1200); });
      expect(document.querySelector('[aria-live="polite"]')).toBe(live);
      expect(live?.textContent).toBe('연동 대상 2건을 불러왔어요.');
    } finally {
      vi.useRealTimers();
    }
  });
});
