'use client';

/**
 * CustomBuildStep — LIN-22 §B2 builder body (PreviewModal step 'custom-build').
 * The composed order lives on the SAME line-grid canvas as the detail page's
 * TaskFlow (FLOW_CSS reuse — n8n-style nodes, owner ask): drag a node
 * horizontally to reorder (6px threshold, one slot per node+connector step),
 * click it (or Enter) to open the editor row below, ←/→ on a focused node
 * reorders without a pointer. Tasks come from the provider-scoped catalog
 * (#12 — already-chosen entries are hidden, so dedup lives in the UI); each
 * task takes an optional ≤100-char operator note with a live counter in the
 * editor row. Over-limit tasks flag the node border AND spell it out in the
 * node meta (color-not-only). Pure list/drag math lives in customBuilder.ts;
 * the parent owns the chosen list and the [구성 확인] gating via canSubmit().
 */
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { PlSelect } from '@/app/integration/admin/pipelines/_components/PlSelect';
import { TerraformLogo } from '@/app/integration/admin/pipelines/_components/brandMarks';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import { FLOW_CSS, ProviderMark } from '@/app/integration/admin/pipelines/_detail/TaskFlow';
import {
  availableEntries,
  descriptionTooLong,
  dragTargetIndex,
  moveTask,
  reorderTask,
  MAX_DESCRIPTION_LENGTH,
  type BuilderTask,
} from '@/app/integration/admin/pipelines/_detail/customBuilder';
import type { CloudProvider, TaskCatalogEntry } from '@/lib/pipeline/types';

/** Pointer must travel this far before a press becomes a drag (below = click/select). */
const DRAG_THRESHOLD_PX = 6;

/** Builder-canvas deltas over the shared FLOW_CSS grammar — sized for the 720px modal. */
const BUILD_CSS = `
.pl-flow.pl-build{min-height:236px}
.pl-flow.pl-build .pl-scroll{padding:24px 16px}
.pl-flow.pl-build .pl-tnode{width:150px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.pl-flow.pl-build .pl-tnode.dragging{cursor:grabbing;z-index:5;box-shadow:var(--pl-shadow-lg);border-color:var(--pl-primary)}
.pl-flow.pl-build .pl-connector{width:36px}
.pl-flow.pl-build .nd-badge.b-seq{background:var(--pl-primary-bg);color:var(--pl-primary)}
.pl-flow.pl-build .pl-tnode.b-over{border-color:var(--pl-err-border)}
.pl-flow.pl-build .pl-tnode.b-over .nd-meta{color:var(--pl-err-text);font-weight:600}
.pl-flow.pl-build .pl-empty{align-self:center;text-align:center;font-size:12px;color:var(--pl-text-weak);border:1px dashed var(--pl-border-strong);border-radius:10px;padding:24px 32px;background:var(--pl-bg-card)}
`;

export interface BuilderEditorRowProps {
  task: BuilderTask;
  /** Current slot in the chosen list (0-based; shown as the 1-based seq badge). */
  index: number;
  onDescription: (value: string) => void;
  onRemove: () => void;
}

/** Editor row for the selected node — operator note + counter + remove. */
export function BuilderEditorRow({
  task,
  index,
  onDescription,
  onRemove,
}: BuilderEditorRowProps): ReactElement {
  const b = detailStyles.builder;
  const pv = detailStyles.preview;
  const over = descriptionTooLong(task);
  return (
    <div className={cn(over ? b.rowErr : b.row, 'mt-2')}>
      <span className={b.seq}>{index + 1}</span>
      {task.entry.kind === 'CONDITION_CHECK' ? (
        <span className={pv.markCond} title="조건 확인 — 폴링">
          <Icon name="clock" size="sm" />
        </span>
      ) : (
        <span className={pv.mark} title="Terraform">
          <TerraformLogo />
        </span>
      )}
      <span className={b.name} title={task.entry.description}>
        {task.entry.display_name}
      </span>
      <input
        className={b.input}
        value={task.description}
        placeholder="설명 (선택 · 100자 이내)"
        aria-label={`${task.entry.display_name} 설명`}
        autoFocus
        onChange={(e) => onDescription(e.target.value)}
      />
      <span
        className={over ? b.counterOver : b.counter}
        title={over ? '설명은 100자 이내여야 합니다' : undefined}
      >
        {task.description.length}/{MAX_DESCRIPTION_LENGTH}
      </span>
      <PlButton
        variant="ghost"
        round
        aria-label={`${task.entry.display_name} 제거`}
        onClick={onRemove}
      >
        <Icon name="x" size="sm" />
      </PlButton>
    </div>
  );
}

export interface CustomBuildStepProps {
  /** null = still loading (skeleton). */
  catalog: TaskCatalogEntry[] | null;
  catalogError: string | null;
  onRetry: () => void;
  chosen: BuilderTask[];
  onChange: (next: BuilderTask[]) => void;
  /** Wire provider for the node logomarks (null never reaches this step in practice). */
  provider: CloudProvider | null;
}

export function CustomBuildStep({
  catalog,
  catalogError,
  onRetry,
  chosen,
  onChange,
  provider,
}: CustomBuildStepProps): ReactElement {
  const b = detailStyles.builder;
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Authoritative order for pointermove handlers — a drag can cross several
  // slots between renders, so closures over `chosen` would go stale. The drag
  // handler updates it eagerly when it reorders; the effect covers add/remove.
  const orderRef = useRef(chosen);
  useEffect(() => {
    orderRef.current = chosen;
  }, [chosen]);
  const dragRef = useRef<{
    name: string;
    pointerId: number;
    startX: number;
    step: number;
    active: boolean;
  } | null>(null);
  const [drag, setDrag] = useState<{ name: string; dx: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  if (catalogError) {
    return (
      <div>
        <div className={detailStyles.taskModal.degraded}>
          Task 카탈로그를 불러오지 못했습니다 — {catalogError}
        </div>
        <PlButton variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          재시도
        </PlButton>
      </div>
    );
  }

  if (!catalog) {
    return <div className={cn(detailStyles.skeleton, 'h-32')} aria-hidden="true" />;
  }

  const available = availableEntries(catalog, chosen);

  const add = (name: string): void => {
    const entry = catalog.find((e) => e.name === name);
    if (!entry) return;
    onChange([...chosen, { entry, description: '' }]);
    setSelected(entry.name); // straight into the note editor
  };
  const remove = (name: string): void => {
    onChange(chosen.filter((t) => t.entry.name !== name));
    if (selected === name) setSelected(null);
  };
  const setDescription = (name: string, description: string): void => {
    onChange(chosen.map((t) => (t.entry.name === name ? { ...t, description } : t)));
  };

  const onNodeDown = (task: BuilderTask) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    const nodes = trackRef.current?.querySelectorAll<HTMLElement>('.pl-tnode');
    // Slot pitch measured from the DOM (node + connector) so CSS resizes can't desync the math.
    const step = nodes && nodes.length >= 2 ? nodes[1].offsetLeft - nodes[0].offsetLeft : 0;
    dragRef.current = {
      name: task.entry.name,
      pointerId: e.pointerId,
      startX: e.clientX,
      step,
      active: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onNodeMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD_PX) return;
      d.active = true;
    }
    const order = orderRef.current;
    const index = order.findIndex((t) => t.entry.name === d.name);
    if (index < 0) return;
    const target = dragTargetIndex(index, e.clientX - d.startX, d.step, order.length);
    if (target !== index) {
      const next = reorderTask(order, index, target);
      orderRef.current = next;
      onChange(next);
      // The node now occupies the target slot — shift the origin so the
      // residual offset keeps tracking the pointer without a jump.
      d.startX += (target - index) * d.step;
    }
    setDrag({ name: d.name, dx: e.clientX - d.startX });
  };
  const onNodeUp = (task: BuilderTask) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!d.active) setSelected(task.entry.name); // plain click = select
  };
  const onNodeCancel = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDrag(null);
  };
  const onNodeKey = (task: BuilderTask, index: number) => (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(task.entry.name);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(moveTask(chosen, index, e.key === 'ArrowLeft' ? -1 : 1));
    }
  };

  const selectedTask = selected ? (chosen.find((t) => t.entry.name === selected) ?? null) : null;

  return (
    <div>
      <div className={b.addRow}>
        <PlSelect
          value=""
          aria-label="Task 추가"
          disabled={!available.length}
          onChange={(e) => {
            if (e.target.value) add(e.target.value);
          }}
        >
          <option value="">{available.length ? 'Task 추가…' : '추가할 Task 없음'}</option>
          {available.map((e) => (
            <option key={e.name} value={e.name}>
              {e.display_name}
            </option>
          ))}
        </PlSelect>
        <span className={b.count}>Task {chosen.length}개</span>
      </div>

      <div className={cn('pl-flow', 'pl-build', 'mt-3')}>
        <style>{FLOW_CSS + BUILD_CSS}</style>
        <div className="pl-scroll">
          {chosen.length ? (
            <div className="pl-track" ref={trackRef}>
              {chosen.map((t, i) => {
                const over = descriptionTooLong(t);
                const note = t.description.trim();
                const dragging = drag !== null && drag.name === t.entry.name;
                return (
                  <Fragment key={t.entry.name}>
                    {i > 0 && (
                      <div className="pl-connector" aria-hidden="true">
                        <span className="cdot" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'pl-tnode',
                        over && 'b-over',
                        selected === t.entry.name && 's-selected',
                        dragging && 'dragging',
                      )}
                      style={dragging && drag ? { transform: `translateX(${drag.dx}px)` } : undefined}
                      role="button"
                      tabIndex={0}
                      aria-label={`${t.entry.display_name} — ${i + 1}번째. Enter로 선택, 좌우 화살표로 순서 이동`}
                      aria-pressed={selected === t.entry.name}
                      onPointerDown={onNodeDown(t)}
                      onPointerMove={onNodeMove}
                      onPointerUp={onNodeUp(t)}
                      onPointerCancel={onNodeCancel}
                      onKeyDown={onNodeKey(t, i)}
                    >
                      <div className="nd-icons">
                        {t.entry.kind === 'CONDITION_CHECK' ? (
                          <span className="nd-mark m-cond" title="조건 확인 — 폴링">
                            <Icon name="clock" size="sm" />
                          </span>
                        ) : (
                          <span className="nd-mark" title="Terraform">
                            <TerraformLogo />
                          </span>
                        )}
                        {provider ? <ProviderMark provider={provider} /> : null}
                      </div>
                      <span className="nd-badge b-seq" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="nd-name">{t.entry.display_name}</span>
                      <div className="nd-meta">
                        {over
                          ? `${t.description.length}/${MAX_DESCRIPTION_LENGTH} — 설명이 너무 깁니다`
                          : note || t.entry.description}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <div className="pl-empty">카탈로그에서 Task를 추가해 실행 순서를 구성하세요</div>
          )}
        </div>
      </div>

      {chosen.length > 0 && (
        <div className={b.hint}>노드를 드래그해 순서를 바꾸고, 클릭해 설명을 입력하세요</div>
      )}

      {selectedTask && (
        <BuilderEditorRow
          key={selectedTask.entry.name}
          task={selectedTask}
          index={chosen.indexOf(selectedTask)}
          onDescription={(v) => setDescription(selectedTask.entry.name, v)}
          onRemove={() => remove(selectedTask.entry.name)}
        />
      )}
    </div>
  );
}
