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

/** 행 콜백은 표가 아니라 이 섹션이 만든다 — 목 표는 그것을 테스트에 넘겨주기만 한다. */
let capturedRowActions: CandidateRowActions | undefined;

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable',
  () => ({
    CandidateResourceTable: ({
      candidates,
      emptyMessage,
      actions,
    }: { candidates: unknown[]; emptyMessage?: string; actions: CandidateRowActions }) => {
      capturedRowActions = actions;
      return candidates.length === 0
        ? <p>{emptyMessage}</p>
        : <div data-testid="table" data-count={candidates.length} />;
    },
  }),
);

/** 검색·조회는 모달 자신의 관심사다 — 여기서 보는 건 "담은 다음 표가 어떻게 되는가"뿐. */
let capturedEc2Add: ((instance: Ec2Instance, config: Ec2ConnectionConfig) => void) | undefined;

vi.mock('@/app/target-sources/[targetSourceId]/_components/aws/Ec2AddModal', () => ({
  Ec2AddModal: ({
    onAdd,
  }: { onAdd: (instance: Ec2Instance, config: Ec2ConnectionConfig) => void }) => {
    capturedEc2Add = onAdd;
    return <div data-testid="ec2-modal" />;
  },
}));

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ warning: () => {}, success: () => {}, error: () => {}, info: () => {} }),
}));

import { CandidateResourceSection } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceSection';
import type { CandidateRowActions } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceRow';
import type { Ec2ConnectionConfig } from '@/app/target-sources/[targetSourceId]/_components/candidate/manual-ec2';
import type { Ec2Instance } from '@/app/lib/api/ec2';

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
  it('renders the 1단계 tag and the detailed guidance sentence', async () => {
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );
    await screen.findByRole('heading', { level: 2, name: '연동 대상 DB 선택' });
    expect(screen.getByText('1단계')).toBeTruthy();
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

// 수동으로 담은 EC2 행은 표의 다른 행과 같은 CandidateResource 다 — 특별 취급이 없다는 것이
// 이 흐름의 전제이고, 아래는 그 전제가 실제로 무너졌던 자리들이다.
describe('CandidateResourceSection — 수동 EC2 행', () => {
  const INSTANCE: Ec2Instance = {
    instanceId: 'i-0a1b2c3d4e5f67890',
    privateIpAddress: '10.10.1.24',
    privateDnsName: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
  };
  const CONFIG: Ec2ConnectionConfig = { databaseType: 'mysql', port: 3306 };

  beforeEach(() => {
    getConfirmResources.mockReset();
    getConfirmResources.mockResolvedValue({ resources: [] });
    capturedRowActions = undefined;
    capturedEc2Add = undefined;
  });

  const renderSection = () =>
    render(
      <CandidateResourceSection
        targetSourceId={1}
        provider="AWS"
        readonly={false}
        refreshProject={async () => {}}
      />,
    );

  /** CardActionBar 힌트 — "총 N건 · M건 선택됨". */
  const hint = () => screen.getByText(/건 선택됨/).textContent ?? '';

  const openEc2Modal = () => {
    fireEvent.click(screen.getByRole('button', { name: 'EC2 추가' }));
    expect(capturedEc2Add).toBeTypeOf('function');
  };

  // 수동 행에는 region 이 없다 — 리전 필터가 켜져 있으면 담자마자 탈락하고, 검색어나
  // 2페이지도 같은 결과다. 그러면 담긴 행도, 틴트도, 배지도 화면에 없어 아무 일도
  // 일어나지 않은 것처럼 보인다. 재스캔과 같은 이유로 같은 초기화를 한다.
  it('담고 나면 담은 행이 보이도록 표의 검색·필터·페이지를 초기화한다', async () => {
    renderSection();
    await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    openEc2Modal();

    const search = screen.getByLabelText('리소스 검색') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'no-such-resource' } });
    expect(screen.queryByTestId('table')).toBeNull();

    act(() => capturedEc2Add?.(INSTANCE, CONFIG));

    expect(screen.getByTestId('table').getAttribute('data-count')).toBe('3');
    expect(search.value).toBe('');
  });

  // 내가 넣은 행의 체크를 푸는 건 "제외"가 아니라 되돌리기다. 사유 팝오버로 보내면
  // 닫는 순간 아무 일도 일어나지 않아 체크가 그대로 남는 막다른 길이 되고, 사유를
  // 고르면 내가 직접 넣은 리소스에 제외 사유가 붙어 전송된다.
  it('수동 행의 체크 해제는 사유를 묻지 않고 바로 선택을 푼다', async () => {
    renderSection();
    await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    openEc2Modal();
    act(() => capturedEc2Add?.(INSTANCE, CONFIG));
    expect(hint()).toContain('2건 선택됨');

    act(() =>
      capturedRowActions?.toggleSelected(INSTANCE.instanceId, false, document.createElement('button')),
    );
    expect(hint()).toContain('1건 선택됨');
  });

  // 대조군 — 스캔이 제안한 행은 사유가 필요하므로 체크 해제가 즉시 반영되면 안 된다.
  // 이게 같이 움직이면 위 테스트는 "그냥 다 바로 풀린다"를 확인한 것에 지나지 않는다.
  it('스캔이 제안한 행은 사유를 받기 전까지 선택이 그대로다', async () => {
    renderSection();
    await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    expect(hint()).toContain('1건 선택됨');

    act(() =>
      capturedRowActions?.toggleSelected('res-1', false, document.createElement('button')),
    );
    expect(hint()).toContain('1건 선택됨');
  });

  // 수정은 접속 정보를 고치는 일이지 다시 담는 일이 아니다.
  it('접속 정보 수정이 해제해 둔 행을 다시 선택하지 않는다', async () => {
    renderSection();
    await screen.findByRole('button', { name: '연동 대상 승인 요청' });
    openEc2Modal();
    act(() => capturedEc2Add?.(INSTANCE, CONFIG));
    act(() =>
      capturedRowActions?.toggleSelected(INSTANCE.instanceId, false, document.createElement('button')),
    );
    expect(hint()).toContain('1건 선택됨');

    act(() => capturedEc2Add?.(INSTANCE, { ...CONFIG, port: 3307 }));
    expect(screen.getByTestId('table').getAttribute('data-count')).toBe('3');
    expect(hint()).toContain('1건 선택됨');
  });
});
