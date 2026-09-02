// @vitest-environment jsdom
/**
 * Behaviours the 인프라 작업 tab depends on:
 *
 *   1. The 현재 작업 card answers the 확정 정보 gate with a sentence and a live
 *      control, and NEVER with a disabled 작업 시작. The dead button that still
 *      looked like the answer is the failure mode worth pinning.
 *   2. The card states NO Terraform impact totals (owner) — the per-task
 *      JobKindTag in the flow is the only place PLAN/APPLY/DESTROY is said.
 *   3. The Task flow is the card's content in EVERY run state (owner). A failed,
 *      cancelled or finished run shows its tasks exactly as a live one does —
 *      the regression this file exists to catch is a terminal run rendering the
 *      card with no tasks in it, which is what the deleted LastRunFailedCard did.
 *   4. The card states progress · 시작 · 경과 instead of narrating where the run
 *      stopped in prose.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  CurrentPipelineCard,
  EmptyPipelineCard,
  type CurrentPipelineCardProps,
} from '@/app/admin/pipelines/_detail/CurrentPipelineCard';
import { gateStage } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { ServiceWorkNoticeData } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ServiceWorkNotice';
import type {
  PipelineDetail,
  PipelineStatus,
  TaskCatalogEntry,
  TaskStatus,
  TaskSummary,
  TerraformAction,
} from '@/lib/pipeline/types';

// The flow track scrolls its focus task into view on mount; jsdom has neither
// of the two browser APIs that effect uses.
vi.stubGlobal('matchMedia', () => ({
  matches: false,
  media: '',
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
}));
Element.prototype.scrollBy = () => undefined;

const PRE_WARNING = /작업을 시작하면 Terraform이 실행되어/;

const makeTask = (
  sequence: number,
  terraform_action: TerraformAction | null,
  status: TaskStatus = 'READY',
): TaskSummary => ({
  task_id: sequence,
  sequence,
  kind: terraform_action ? 'TERRAFORM_JOB' : 'CONDITION_CHECK',
  task_definition: `TASK_${sequence}`,
  operation: null,
  terraform_action,
  status,
  fail_count: 0,
  error_code: null,
  consumes_terraform_slot: terraform_action != null,
  started_at: null,
  finished_at: null,
  description: null,
});

const makeDetail = (
  actions: Array<TerraformAction | null>,
  overrides: Partial<PipelineDetail> = {},
): PipelineDetail =>
  ({
    pipeline_id: 900,
    type: 'INSTALL',
    target_source_id: '1583',
    service_code: 'svc',
    service_name: '재고서비스',
    cloud_provider: 'IDC',
    recipe_definition: 'IDC_INSTALL_V1',
    status: 'RUNNING',
    done_task_count: 0,
    total_task_count: actions.length,
    created_at: '2026-07-29T00:00:00.000Z',
    last_activity_at: '2026-07-29T00:00:00.000Z',
    current_task_sequence: 1,
    current_fail_count: null,
    current_max_fail_count: null,
    cancel_requested: false,
    tasks: actions.map((action, index) => makeTask(index + 1, action)),
    ...overrides,
  }) as unknown as PipelineDetail;

/** A run that ended, with its tasks carrying the statuses that ended it. */
const makeTerminalDetail = (
  status: PipelineStatus,
  taskStatuses: TaskStatus[],
  overrides: Partial<PipelineDetail> = {},
): PipelineDetail =>
  makeDetail(
    taskStatuses.map(() => 'APPLY' as TerraformAction),
    {
      status,
      done_task_count: taskStatuses.filter((s) => s === 'DONE').length,
      // 5 minutes after 생성 — 경과 is measured from created_at, so a terminal
      // run's meta line is deterministic.
      last_activity_at: '2026-07-29T00:05:00.000Z',
      tasks: taskStatuses.map((s, index) => makeTask(index + 1, 'APPLY', s)),
      ...overrides,
    },
  );

/** Catalog display names — what the task cards must print. */
const DEFS: ReadonlyMap<string, TaskCatalogEntry> = new Map(
  [1, 2, 3].map((seq) => [
    `TASK_${seq}`,
    { name: `TASK_${seq}`, display_name: `작업 정의 ${seq}` } as TaskCatalogEntry,
  ]),
);

const renderCard = (detail: PipelineDetail, props: Partial<CurrentPipelineCardProps> = {}) =>
  render(
    <CurrentPipelineCard
      detail={detail}
      sectionTitle="현재 작업"
      defs={DEFS}
      onOpenPipeline={vi.fn()}
      onCancel={vi.fn()}
      onRestart={vi.fn()}
      onStartNew={vi.fn()}
      {...props}
    />,
  );

const renderRun = (actions: Array<TerraformAction | null>) => renderCard(makeDetail(actions));

const startButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: /작업 시작/ }) as HTMLButtonElement;

describe('EmptyPipelineCard — 확정 정보 gate', () => {
  it('offers the start CTA and says what it does when nothing blocks', () => {
    render(<EmptyPipelineCard sectionTitle="현재 작업" onStart={vi.fn()} onSelectTab={vi.fn()} />);

    expect(startButton().disabled).toBe(false);
    expect(screen.getByText(PRE_WARNING)).toBeTruthy();
  });

  it('states the gate once and offers its move when blocked', () => {
    const onSelectTab = vi.fn();
    render(
      <EmptyPipelineCard
        sectionTitle="현재 작업"
        onStart={vi.fn()}
        gate={gateStage('CONFIRMING', 1029, false)}
        onSelectTab={onSelectTab}
      />,
    );

    expect(screen.getByText(/아직 확정된 연동 정보가 없습니다/)).toBeTruthy();
    // The reason is stated ONCE — the block above says it, and nothing repeats it
    // under the button (benchmark P1; that fix survives the button's return).
    expect(screen.queryByText(PRE_WARNING)).toBeNull();
    expect(screen.getAllByText(/아직 확정된 연동 정보가 없습니다/)).toHaveLength(1);

    // The gate's move is the one control that responds.
    const move = screen.getByRole('button', { name: /확정 정보 탭으로/ }) as HTMLButtonElement;
    expect(move.disabled).toBe(false);
    fireEvent.click(move);
    expect(onSelectTab).toHaveBeenCalledWith('확정 정보');
  });

  /**
   * SDU 의 확정 대기에는 내놓을 수가 없다 — 확정 정보 탭이 그 대상에서 읽기 전용이라
   * (계약에 쓰기 path 가 없다) 보내 봐야 누를 것이 없다. 카드는 문장만 세우고, 옆자리는
   * 비운다: 누를 것이 없는 곳으로 보내는 버튼은 버튼이 없는 것보다 나쁘다.
   */
  it('내놓을 수가 없는 게이트는 문장만 세우고 버튼을 만들지 않는다', () => {
    render(
      <EmptyPipelineCard
        sectionTitle="현재 작업"
        onStart={vi.fn()}
        gate={gateStage('CONFIRMING', 1029, true)}
        onSelectTab={vi.fn()}
      />,
    );

    // `GateSentence` 는 「작업 시작」을 굵게 하려고 문장을 쪼갠다 — 그래서 그 낱말을
    // 건너뛰는 매처는 노드 경계에 걸린다. 이어 붙인 텍스트로 잰다.
    expect(document.body.textContent).toContain('확정되면 여기서 작업 시작이 열립니다');
    expect(document.body.textContent).not.toContain('확정 정보 탭에서 확정하면');
    expect(screen.queryByRole('button', { name: /확정 정보 탭으로/ })).toBeNull();
    // 잠긴 작업 시작은 그대로 선다 — 사라지는 것은 게이트의 이동 버튼 하나다.
    expect(startButton().disabled).toBe(true);
  });

  it('offers 작업 시작 as a DISABLED button while 확정 정보 is missing', () => {
    // 오너 2026-08-27 2차 — the gated card shows the control in its blocked
    // condition rather than hiding it, superseding the earlier removal.
    const onStart = vi.fn();
    render(
      <EmptyPipelineCard
        sectionTitle="현재 작업"
        onStart={onStart}
        gate={gateStage('CONFIRMING', 1029, false)}
        onSelectTab={vi.fn()}
      />,
    );

    expect(startButton().disabled).toBe(true);
    // The dead button answers "why" on hover, without a second reason line.
    expect(startButton().getAttribute('title')).toMatch(/아직 확정된 연동 정보가 없습니다/);

    fireEvent.click(startButton());
    expect(onStart).not.toHaveBeenCalled();
  });

  it('sends the operator out to the service screen while the target is IDLE', () => {
    render(
      <EmptyPipelineCard
        sectionTitle="현재 작업"
        onStart={vi.fn()}
        gate={gateStage('IDLE', 1029, false)}
        onSelectTab={vi.fn()}
      />,
    );

    const link = screen.getByRole('link', { name: /서비스 담당자가 보는 화면/ });
    expect(link.getAttribute('href')).toBe('/target-sources/1029');
    // Every gate stage disables the same way — not just the 확정 정보 one.
    expect(startButton().disabled).toBe(true);
  });
});

const stopButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: /작업 중단/ }) as HTMLButtonElement;

describe('CurrentPipelineCard — 작업 중단', () => {
  it('offers the stop control on a live run', () => {
    const onCancel = vi.fn();
    renderCard(makeDetail(['DESTROY']), { onCancel });

    // Stopping a run in flight is never gated, whatever else the page blocks.
    expect(stopButton().disabled).toBe(false);
    fireEvent.click(stopButton());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the pending request once cancel is two-phase', () => {
    // A leased run stays RUNNING and only records the request; the card has to
    // say so, or the stop button reads as having done nothing.
    renderCard(makeDetail(['APPLY'], { cancel_requested: true }));

    expect(screen.getByText('중단 요청됨')).toBeTruthy();
    expect(stopButton().disabled).toBe(true);
  });
});

describe('CurrentPipelineCard — Terraform impact note', () => {
  it('states no impact totals, on the live run that used to carry them', () => {
    // Deleted at the owner's word. The counts said what every JobKindTag in the
    // flow below already says, and only the per-task tag names WHICH task
    // destroys — so a DESTROY run is the case worth pinning.
    renderRun(['PLAN', 'DESTROY', 'DESTROY']);

    expect(screen.queryByText(/실제 인프라를/)).toBeNull();
    expect(document.body.textContent).not.toContain('DESTROY 2건');
    expect(document.body.textContent).not.toContain('PLAN 1건');
  });
});

describe('CurrentPipelineCard — terminal runs', () => {
  const taskNames = (): string[] =>
    Array.from(document.querySelectorAll('.rtc-nm')).map((el) => el.textContent ?? '');

  it('shows every task of a FAILED run', () => {
    // The owner's headline ask. The card this replaced showed the failure
    // sentence and NO tasks at all, so a stopped run lost its flow entirely.
    renderCard(makeTerminalDetail('FAILED', ['DONE', 'FAILED', 'READY']), {
      sectionTitle: '최근 작업',
    });

    expect(taskNames()).toEqual(['작업 정의 1', '작업 정의 2', '작업 정의 3']);
    expect(screen.getByText('Task 실행 흐름')).toBeTruthy();
  });

  it('shows every task of a DONE run, and offers only 새 작업 시작', () => {
    renderCard(makeTerminalDetail('DONE', ['DONE', 'DONE']), { sectionTitle: '최근 작업' });

    expect(taskNames()).toEqual(['작업 정의 1', '작업 정의 2']);
    // Nothing to resume on a finished run — 재시작 would restart what succeeded.
    expect(screen.queryByRole('button', { name: '재시작' })).toBeNull();
    expect(screen.getByRole('button', { name: '새 작업 시작' })).toBeTruthy();
    // 작업 중단 belongs to the live branch only.
    expect(screen.queryByRole('button', { name: /작업 중단/ })).toBeNull();
  });

  it('offers 재시작 next to 새 작업 시작 on a stopped run', () => {
    const onRestart = vi.fn();
    renderCard(makeTerminalDetail('CANCELLED', ['DONE', 'CANCELLED']), {
      sectionTitle: '최근 작업',
      onRestart,
    });

    expect(screen.getByRole('button', { name: '새 작업 시작' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '재시작' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('disables both terminal CTAs and says why when the gate is closed', () => {
    renderCard(makeTerminalDetail('FAILED', ['FAILED']), {
      sectionTitle: '최근 작업',
      blockedReason: '확정된 연동 정보가 없어 시작할 수 없습니다.',
    });

    expect((screen.getByRole('button', { name: '재시작' }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: '새 작업 시작' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('확정된 연동 정보가 없어 시작할 수 없습니다.')).toBeTruthy();
  });

  it('drops the interruption prose the owner cut', () => {
    // 「작업이 중단되어 …」 and 「…에서 실패했습니다」 said in prose what the failed
    // task card already says by its own ring, and the pre-warning cannot be a
    // warning about a run that is over.
    renderCard(makeTerminalDetail('FAILED', ['DONE', 'FAILED']), { sectionTitle: '최근 작업' });

    expect(document.body.textContent).not.toContain('작업이 중단되어');
    expect(document.body.textContent).not.toContain('에서 실패했습니다');
    expect(document.body.textContent).not.toContain('에서 중단됐습니다');
  });
});

describe('CurrentPipelineCard — meta line', () => {
  it('states 시작 and 경과, in the short form with seconds', () => {
    renderCard(makeTerminalDetail('FAILED', ['DONE', 'FAILED', 'READY']), {
      sectionTitle: '최근 작업',
    });

    // Seconds survive: the run's start is an instant an operator matches against
    // a log line. The stage phrase is NOT here — it labels the flow now.
    const meta = screen.getByText(
      (_, node) => node?.tagName === 'P' && node.textContent === '시작 26.07.29 09:00:00 · 경과 5분',
    );
    // One clock, and it marks 시작 — the line opens with it.
    expect(meta.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(meta.querySelectorAll('svg')).toHaveLength(1);
    expect(document.body.textContent).not.toContain('전체 3단계 중');
  });

  it('counts a live run from its creation instant', () => {
    renderCard(makeDetail(['APPLY', 'APPLY'], { current_task_sequence: 1 }));

    expect(
      screen.getByText(
        (_, node) => node?.tagName === 'P' && /^시작 26\.07\.29 09:00:00 · 경과 /.test(node.textContent ?? ''),
      ),
    ).toBeTruthy();
  });
});

describe('CurrentPipelineCard — 수행 담당자', () => {
  it('names the account the BFF recorded as the requester', () => {
    renderCard(makeDetail(['APPLY'], { requested_by: '관리자' }));

    expect(document.body.textContent).toContain('수행 담당자 관리자');
  });

  it('prints 시스템 for a run the BFF started itself, never the raw sentinel', () => {
    renderCard(makeDetail(['APPLY'], { requested_by: 'SYSTEM' }));

    expect(document.body.textContent).toContain('수행 담당자 시스템');
    expect(document.body.textContent).not.toContain('SYSTEM');
  });

  it('says nothing about a requester the backend never recorded', () => {
    renderCard(makeDetail(['APPLY']));

    expect(document.body.textContent).not.toContain('수행 담당자');
  });
});

describe('CurrentPipelineCard — stage tag', () => {
  /** The Task 실행 흐름 line: label left, stage phrase right. */
  const flowRow = (): string =>
    screen.getByText('Task 실행 흐름').parentElement?.textContent ?? '';

  it('labels the flow with the stage phrase instead of the meta line', () => {
    renderCard(
      makeDetail(['APPLY', 'APPLY', 'APPLY'], {
        tasks: [
          makeTask(1, 'APPLY', 'DONE'),
          makeTask(2, 'APPLY', 'IN_PROGRESS'),
          makeTask(3, 'APPLY', 'READY'),
        ],
      }),
    );

    // 진행 중, not 실행 중 (owner) — and the phrase sits on the flow it counts.
    expect(flowRow()).toBe('Task 실행 흐름2/3단계 진행 중');
  });

  it('gives a stopped run its own word rather than 완료', () => {
    renderCard(makeTerminalDetail('CANCELLED', ['DONE', 'CANCELLED', 'CANCELLED']), {
      sectionTitle: '최근 작업',
    });

    expect(flowRow()).toBe('Task 실행 흐름1/3단계 중단');
  });
});

describe('CurrentPipelineCard — section head', () => {
  it('declares the card with the blue tag token and drops the caption', () => {
    renderCard(makeDetail(['APPLY']));

    // The token itself, not a copy of its classes: a hand-copied blue is what
    // stays behind on the day the token moves (#792).
    expect(screen.getByRole('heading', { name: '현재 작업' }).className).toBe(opsStyles.scopeTag);
    // The caption restated the tab's own info banner two rows above.
    expect(document.body.textContent).not.toContain('Terraform을 실행해 인프라를 생성하거나');
  });
});

describe('CurrentPipelineCard — task flow', () => {
  it('opens the clicked task, and stays a picture when no handler is given', () => {
    const onOpenTask = vi.fn();
    const detail = makeTerminalDetail('FAILED', ['DONE', 'FAILED']);
    const { unmount } = renderCard(detail, { sectionTitle: '최근 작업', onOpenTask });

    fireEvent.click(screen.getByRole('button', { name: '작업 정의 2 · FAILED · 상세 열기' }));
    expect(onOpenTask).toHaveBeenCalledWith(detail.tasks[1]);

    unmount();
    renderCard(detail, { sectionTitle: '최근 작업' });
    expect(screen.queryByRole('button', { name: /상세 열기/ })).toBeNull();
  });

  it('carries the run status on the card frame, not only in the pill', () => {
    const { container } = renderCard(makeTerminalDetail('FAILED', ['DONE', 'FAILED']), {
      sectionTitle: '최근 작업',
    });

    // The stroke IS the status here (pipeline 현황 flow grammar): a task that
    // ended must not wear the same neutral frame as one that never ran.
    const cards = Array.from(container.querySelectorAll('.rtc'));
    expect(cards.map((c) => c.className)).toEqual(['rtc done', 'rtc failed']);
  });
});

/**
 * 서비스 측 작업 경고의 **자리**. 판정 자체는 `installGate.test.ts` 가, 상자와 모달은
 * `ServiceWorkNotice.test.tsx` 가 잡는다 — 여기서 잡는 것은 그 상자가 시작 동작을 가진
 * 카드에만 서고, 그 동작을 잠그지 않는다는 것뿐이다.
 */
const NEEDED: ServiceWorkNoticeData = {
  result: {
    kind: 'needed',
    step: { id: 'service', title: '서비스 측 Terraform 적용' },
    done: 1,
    total: 3,
    rows: [
      { resourceId: 'rds-1', resourceName: 'rds-1', status: 'FAIL', guide: null },
      { resourceId: 'rds-2', resourceName: 'rds-2', status: 'IN_PROGRESS', guide: null },
      { resourceId: 'rds-3', resourceName: 'rds-3', status: 'COMPLETED', guide: null },
    ],
  },
  lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
};

const NOTICE = '설치 작업 전에 서비스 측 대응이 먼저 필요합니다';

describe('서비스 측 작업 경고 — 시작 동작을 가진 카드에만', () => {
  it('최근 작업 카드에는 서고, 실행 중인 카드에는 서지 않는다', () => {
    const { unmount } = renderCard(makeTerminalDetail('DONE', ['DONE']), {
      sectionTitle: '최근 작업',
      serviceWork: NEEDED,
    });
    expect(screen.getByText(NOTICE)).toBeTruthy();
    // 남은 건수는 분모가 아니라 안 끝난 수다.
    expect(screen.getByText('2건')).toBeTruthy();
    unmount();

    // 실행 중인 카드의 CTA 는 `작업 중단` 이다 — 시작에 대한 문장이 말을 걸 상대가 없다.
    renderCard(makeDetail(['APPLY']), { sectionTitle: '현재 작업', serviceWork: NEEDED });
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('빈 카드에서 새 작업 시작을 잠그지 않는다 — 게이트가 아니라 주의다', () => {
    render(
      <EmptyPipelineCard
        sectionTitle="현재 작업"
        onStart={vi.fn()}
        serviceWork={NEEDED}
        onSelectTab={vi.fn()}
      />,
    );

    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(startButton().disabled).toBe(false);
  });

  it('확정 정보 게이트와 함께 서면 게이트 문장이 제자리를 지킨다', () => {
    render(
      <EmptyPipelineCard
        sectionTitle="현재 작업"
        onStart={vi.fn()}
        gate={gateStage('CONFIRMING', 1029, false)}
        serviceWork={NEEDED}
        onSelectTab={vi.fn()}
      />,
    );

    // 둘 다 선다. 게이트가 여전히 버튼을 잠그고(그건 게이트의 일이다), 주의는 그 위에 쌓인다.
    expect(screen.getByText(/아직 확정된 연동 정보가 없습니다/)).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(startButton().disabled).toBe(true);
  });

  it('done·unknown·해당 없음은 아무 자리도 차지하지 않는다', () => {
    const detail = makeTerminalDetail('DONE', ['DONE']);
    const { unmount } = renderCard(detail, { sectionTitle: '최근 작업', serviceWork: null });
    expect(screen.queryByText(NOTICE)).toBeNull();
    unmount();

    renderCard(detail, {
      sectionTitle: '최근 작업',
      serviceWork: { ...NEEDED, result: { ...NEEDED.result, kind: 'unknown', rows: [] } },
    });
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});
