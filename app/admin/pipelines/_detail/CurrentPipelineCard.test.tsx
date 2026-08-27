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
        gate={gateStage('CONFIRMING', 1029)}
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

  it('offers 작업 시작 as a DISABLED button while 확정 정보 is missing', () => {
    // 오너 2026-08-27 2차 — the gated card shows the control in its blocked
    // condition rather than hiding it, superseding the earlier removal.
    const onStart = vi.fn();
    render(
      <EmptyPipelineCard
        sectionTitle="현재 작업"
        onStart={onStart}
        gate={gateStage('CONFIRMING', 1029)}
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
        gate={gateStage('IDLE', 1029)}
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
    const meta = screen.getByText('시작 26.07.29 09:00:00 · 경과 5분', { selector: 'p' });
    // One clock, and it marks 시작 — the line opens with it.
    expect(meta.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(meta.querySelectorAll('svg')).toHaveLength(1);
    expect(document.body.textContent).not.toContain('전체 3단계 중');
  });

  it('counts a live run from its creation instant', () => {
    renderCard(makeDetail(['APPLY', 'APPLY'], { current_task_sequence: 1 }));

    expect(screen.getByText(/^시작 26\.07\.29 09:00:00 · 경과 /, { selector: 'p' })).toBeTruthy();
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
