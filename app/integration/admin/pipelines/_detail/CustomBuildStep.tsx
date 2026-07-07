'use client';

/**
 * CustomBuildStep — LIN-22 §B2 builder body (PreviewModal step 'custom-build').
 * The composed order lives on the SAME line-grid canvas as the detail page's
 * TaskFlow (FLOW_CSS reuse — n8n-style nodes, owner ask): drag a node
 * horizontally to reorder (6px threshold, one slot per node+connector step),
 * ←/→ on a focused node reorders without a pointer, and every node carries a
 * ✕ delete control (Delete/Backspace works too). Node names render in full —
 * no clamp/truncation (owner ask). Tasks come from the provider-scoped
 * catalog (#12 — already-chosen entries are hidden, so dedup lives in the
 * UI); per-task descriptions are deliberately NOT collected (owner call —
 * the wire field stays optional and unsent). Pure list/drag math lives in
 * customBuilder.ts; the parent owns the chosen list and the [구성 확인]
 * gating via canSubmit().
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
  dragTargetIndex,
  moveTask,
  reorderTask,
} from '@/app/integration/admin/pipelines/_detail/customBuilder';
import type { CloudProvider, TaskCatalogEntry } from '@/lib/pipeline/types';

/** Pointer must travel this far before a press becomes a drag. */
const DRAG_THRESHOLD_PX = 6;

/**
 * Builder-canvas deltas over the shared FLOW_CSS grammar — sized for the
 * 720px modal: 200px nodes × 3 + 36px connectors × 2 = 672px (the body
 * width), and every node is the SAME size (owner ask) — the name renders in
 * full with a reserved 2-line box (200px fits the longest catalog name in 2
 * lines) and the meta reserves 2 lines too, so short/long tasks line up.
 */
const BUILD_CSS = `
.pl-flow.pl-build{min-height:236px}
.pl-flow.pl-build .pl-scroll{padding:24px 16px}
.pl-flow.pl-build .pl-tnode{width:200px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.pl-flow.pl-build .pl-tnode.dragging{cursor:grabbing;z-index:5;box-shadow:var(--pl-shadow-lg);border-color:var(--pl-primary)}
.pl-flow.pl-build .pl-connector{width:36px}
.pl-flow.pl-build .nd-badge.b-seq{background:var(--pl-primary-bg);color:var(--pl-primary)}
.pl-flow.pl-build .nd-name{display:block;overflow:visible;-webkit-line-clamp:none;word-break:keep-all;min-height:37px}
.pl-flow.pl-build .nd-meta{min-height:34px}
.pl-flow.pl-build .nd-del{margin-left:auto;width:22px;height:22px;border-radius:6px;display:grid;place-items:center;flex:none;border:none;background:transparent;color:var(--pl-text-weak);cursor:pointer}
.pl-flow.pl-build .nd-del:hover{background:var(--pl-gray-100);color:var(--pl-err-text)}
.pl-flow.pl-build .nd-del:focus-visible{outline:2px solid var(--pl-primary);outline-offset:1px}
.pl-flow.pl-build .pl-empty{align-self:center;text-align:center;font-size:12px;color:var(--pl-text-weak);border:1px dashed var(--pl-border-strong);border-radius:10px;padding:24px 32px;background:var(--pl-bg-card)}
`;

export interface CustomBuildStepProps {
  /** null = still loading (skeleton). */
  catalog: TaskCatalogEntry[] | null;
  catalogError: string | null;
  onRetry: () => void;
  chosen: TaskCatalogEntry[];
  onChange: (next: TaskCatalogEntry[]) => void;
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
  const [drag, setDrag] = useState<{ name: string; dx: number; active: boolean } | null>(null);
  const dragging = drag !== null;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Track the drag on window, not the node: reordering makes React move the
  // dragged element in the DOM, which releases pointer capture (spec — capture
  // drops when the element is removed), so a node-level pointerup can miss and
  // leave a stale drag session reordering on every later mouse move.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent): void => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active) {
        if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD_PX) return;
        d.active = true;
      }
      const order = orderRef.current;
      const index = order.findIndex((t) => t.name === d.name);
      if (index < 0) return;
      const target = dragTargetIndex(index, e.clientX - d.startX, d.step, order.length);
      if (target !== index) {
        const next = reorderTask(order, index, target);
        orderRef.current = next;
        onChangeRef.current(next);
        // The node now occupies the target slot — shift the origin so the
        // residual offset keeps tracking the pointer without a jump.
        d.startX += (target - index) * d.step;
      }
      setDrag({ name: d.name, dx: e.clientX - d.startX, active: true });
    };
    const end = (e: PointerEvent): void => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [dragging]);

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
    if (entry) onChange([...chosen, entry]);
  };
  const remove = (name: string): void => {
    onChange(chosen.filter((t) => t.name !== name));
  };

  const onNodeDown = (task: TaskCatalogEntry) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    const nodes = trackRef.current?.querySelectorAll<HTMLElement>('.pl-tnode');
    // Slot pitch measured from the DOM (node + connector) so CSS resizes can't desync the math.
    const step = nodes && nodes.length >= 2 ? nodes[1].offsetLeft - nodes[0].offsetLeft : 0;
    dragRef.current = {
      name: task.name,
      pointerId: e.pointerId,
      startX: e.clientX,
      step,
      active: false,
    };
    // Arms the window listeners; visuals wait for the threshold (drag.active).
    setDrag({ name: task.name, dx: 0, active: false });
  };
  const onNodeKey = (task: TaskCatalogEntry, index: number) => (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(moveTask(chosen, index, e.key === 'ArrowLeft' ? -1 : 1));
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(task.name);
    }
  };

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
                const isDragged = drag !== null && drag.active && drag.name === t.name;
                return (
                  <Fragment key={t.name}>
                    {i > 0 && (
                      <div className="pl-connector" aria-hidden="true">
                        <span className="cdot" />
                      </div>
                    )}
                    <div
                      className={cn('pl-tnode', isDragged && 'dragging')}
                      style={isDragged && drag ? { transform: `translateX(${drag.dx}px)` } : undefined}
                      role="button"
                      tabIndex={0}
                      aria-label={`${t.display_name} — ${i + 1}번째. 좌우 화살표로 순서 이동, Delete로 제거`}
                      onPointerDown={onNodeDown(t)}
                      onKeyDown={onNodeKey(t, i)}
                    >
                      <div className="nd-icons">
                        {t.kind === 'CONDITION_CHECK' ? (
                          <span className="nd-mark m-cond" title="조건 확인 — 폴링">
                            <Icon name="clock" size="sm" />
                          </span>
                        ) : (
                          <span className="nd-mark" title="Terraform">
                            <TerraformLogo />
                          </span>
                        )}
                        {provider ? <ProviderMark provider={provider} /> : null}
                        <button
                          type="button"
                          className="nd-del"
                          aria-label={`${t.display_name} 제거`}
                          title="제거"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => remove(t.name)}
                        >
                          <Icon name="x" size="sm" />
                        </button>
                      </div>
                      <span className="nd-badge b-seq" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="nd-name">{t.display_name}</span>
                      <div className="nd-meta">{t.description}</div>
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

      {chosen.length > 0 && <div className={b.hint}>노드를 드래그해 실행 순서를 바꿀 수 있어요</div>}
    </div>
  );
}
