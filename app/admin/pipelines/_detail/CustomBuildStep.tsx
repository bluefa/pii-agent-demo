'use client';

/**
 * CustomBuildStep — LIN-22 §B2 builder body (PreviewModal step 'custom-build'),
 * R24 re-skin (Figma SzifNRYweRXhiIDI0uyK3R node 9-2 cell E). The composed
 * order lives on the shared R24 grid canvas as 224px icon-left task cards:
 * black seq chip top-left, ✕ remove chip top-right, bare Terraform/clock kind
 * marks, flow arrows between cards, and a dashed GHOST card ("Task 추가") at
 * the end of the chain that opens the RIGHT-DOCKED catalog panel (288px,
 * compact rows: kind mark + name + kind pill + ⊕). The row is ONE line with
 * horizontal scroll — the clipped card is the affordance.
 *
 * Interaction is unchanged from LIN-22: drag a card horizontally to reorder
 * (6px threshold, one slot per card+arrow step), ←/→ on a focused card
 * reorders without a pointer, Delete/Backspace removes, the panel stays open
 * for multi-add and hides already-chosen entries (UI dedup). Per-task
 * descriptions are deliberately NOT collected (owner call — the wire field
 * stays optional and unsent). Pure list/drag math lives in customBuilder.ts;
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
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { FlowArrow, KindMark, R24_CSS } from '@/app/admin/pipelines/_detail/r24Task';
import {
  availableEntries,
  dragTargetIndex,
  moveTask,
  reorderTask,
} from '@/app/admin/pipelines/_detail/customBuilder';
import type { CloudProvider, TaskCatalogEntry } from '@/lib/pipeline/types';

/** Pointer must travel this far before a press becomes a drag. */
const DRAG_THRESHOLD_PX = 6;
/** While dragging within this many px of a scroll-port edge, auto-scroll. */
const AUTOSCROLL_EDGE_PX = 56;
/** Max horizontal auto-scroll per animation frame. */
const AUTOSCROLL_MAX_PX = 16;

/**
 * Builder deltas over the shared R24 grammar — the canvas is a flex pair of
 * the scrolling order track (left) and the docked catalog panel (right).
 */
const BUILD_CSS = `
.r24-build{display:flex;align-items:stretch;min-height:340px;overflow:hidden}
.r24-build .r24-bscroll{flex:1;min-width:0;overflow-x:auto;overscroll-behavior-x:contain;padding:24px 22px 16px;display:flex;flex-direction:column;justify-content:center;scrollbar-width:thin;scrollbar-color:var(--pl-gray-300) transparent}
.r24-build .r24-bscroll::-webkit-scrollbar{height:6px}
.r24-build .r24-bscroll::-webkit-scrollbar-thumb{border-radius:99px;background:var(--pl-gray-300)}
.r24-build .r24-bscroll::-webkit-scrollbar-track{border-radius:99px;background:color-mix(in srgb,var(--pl-gray-900) 7%,transparent)}
.r24-build .r24-bcap{font-size:11px;font-weight:600;color:var(--pl-text-faint);letter-spacing:.02em;margin-bottom:18px;flex:none}
.r24-build .r24-line{align-items:center;margin-top:2px}
.r24-build .r24-tnode{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.r24-build .r24-tnode:focus-visible{outline:2px solid var(--pl-primary);outline-offset:2px}
.r24-build .r24-tnode.dragging{cursor:grabbing;z-index:5;box-shadow:var(--pl-shadow-lg);border-color:var(--pl-primary)}
.r24-build .r24-tnode.ghost{width:224px;cursor:pointer;transition:border-color .15s,color .15s}
.r24-build .r24-tnode.ghost:hover:not(:disabled){border-color:var(--pl-primary);color:var(--pl-primary)}
.r24-build .r24-tnode.ghost:focus-visible{outline:2px solid var(--pl-primary);outline-offset:2px}
.r24-build .r24-tnode.ghost:disabled{opacity:.45;cursor:default}
.r24-cat{width:288px;flex:none;min-width:0;display:flex;flex-direction:column;border-left:1px solid var(--pl-border);background:var(--pl-bg-card)}
.r24-cat-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
@media (prefers-reduced-motion:no-preference){.r24-cat{animation:r24-catIn .15s ease-out}}
@keyframes r24-catIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
`;

export interface AddTaskMenuProps {
  entries: TaskCatalogEntry[];
  onPick: (name: string) => void;
}

/** Compact catalog rows — kind mark + name + kind pill + ⊕ (R24 cell E). */
export function AddTaskMenu({ entries, onPick }: AddTaskMenuProps): ReactElement {
  return (
    <div role="menu" aria-label="Task 추가">
      {entries.map((e, i) => (
        <button
          key={e.name}
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 border-b border-[var(--pl-gray-100)] bg-[var(--pl-bg-card)] px-4 py-[11px] text-left cursor-pointer hover:bg-[var(--pl-gray-50)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pl-primary)]"
          autoFocus={i === 0}
          title={e.description}
          onClick={() => onPick(e.name)}
        >
          <span className="[&_.r24-ticon_svg]:!h-4 [&_.r24-ticon_svg]:!w-4 [&_.r24-ticon.cond_svg]:!m-0">
            <KindMark kind={e.kind} />
          </span>
          <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-[1.35] text-[var(--pl-text-strong)]">
            {e.display_name}
          </span>
          <span className="flex-none rounded-full bg-[var(--pl-gray-100)] px-[7px] py-0.5 text-[9.5px] font-semibold text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]">
            {e.kind === 'CONDITION_CHECK' ? 'COND' : 'TF'}
          </span>
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[var(--pl-text-weak)]">
            <Icon name="plus" size="sm" strokeWidth={2.2} />
          </span>
        </button>
      ))}
    </div>
  );
}

export interface CustomBuildStepProps {
  /** null = still loading (skeleton). */
  catalog: TaskCatalogEntry[] | null;
  catalogError: string | null;
  onRetry: () => void;
  chosen: TaskCatalogEntry[];
  onChange: (next: TaskCatalogEntry[]) => void;
  /** Wire provider for the catalog scope line (null never reaches this step in practice). */
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
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Catalog panel — right-docked at the canvas edge (R24), opened by the
  // ghost card. Stays open across picks for rapid multi-add; the picked row
  // just disappears.
  const [panelOpen, setPanelOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  // Detaches the window listeners of the active drag session (if any).
  const detachRef = useRef<(() => void) | null>(null);
  useEffect(() => () => detachRef.current?.(), []);

  // A new task lands at the right end of the chain — move focus (and the scroll)
  // to the just-added card so attention lands on the pipeline being built, not
  // the catalog panel (owner: 초점을 생성된 파이프라인으로 이동).
  const prevLenRef = useRef(chosen.length);
  useEffect(() => {
    const grew = chosen.length > prevLenRef.current;
    prevLenRef.current = chosen.length;
    if (!grew) return;
    const nodes = trackRef.current?.querySelectorAll<HTMLElement>('.r24-tnode:not(.ghost)');
    const last = nodes?.[nodes.length - 1] ?? null;
    (last ?? addBtnRef.current)?.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    // preventScroll so focus doesn't override the smooth scroll with a jump.
    last?.focus({ preventScroll: true });
  }, [chosen.length]);

  // Escape closes the panel only — captured so the ModalShell's
  // document-level Escape handler doesn't also close the whole modal.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setPanelOpen(false);
      addBtnRef.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [panelOpen]);

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
  const closePanel = (): void => {
    setPanelOpen(false);
    addBtnRef.current?.focus();
  };

  // The whole drag session tracks on window listeners attached SYNCHRONOUSLY
  // here — two reasons: (1) reordering makes React move the dragged element in
  // the DOM, which releases pointer capture (spec — capture drops on removal),
  // so node-level tracking can lose the tail of the drag; (2) arming via
  // setState + effect would race a pointermove/up arriving before React
  // commits (synthetic input delivers them within the same frame).
  const onNodeDown = (task: TaskCatalogEntry) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    const scroller = trackRef.current?.parentElement ?? null; // .r24-bscroll
    const nodes = trackRef.current?.querySelectorAll<HTMLElement>('.r24-tnode:not(.ghost)');
    // Slot pitch measured from the DOM (card + arrow) so CSS resizes can't desync the math.
    const step = nodes && nodes.length >= 2 ? nodes[1].offsetLeft - nodes[0].offsetLeft : 0;
    dragRef.current = {
      name: task.name,
      pointerId: e.pointerId,
      startX: e.clientX,
      step,
      active: false,
    };
    let pointerX = e.clientX;
    let raf = 0;

    // Reorder to the slot the pointer currently maps to; shift the origin so
    // the residual offset keeps tracking the pointer without a jump. Callable
    // from both a pointermove and an auto-scroll tick.
    const applyReorder = (): void => {
      const d = dragRef.current;
      if (!d) return;
      const order = orderRef.current;
      const index = order.findIndex((t) => t.name === d.name);
      if (index < 0) return;
      const target = dragTargetIndex(index, pointerX - d.startX, d.step, order.length);
      if (target !== index) {
        const next = reorderTask(order, index, target);
        orderRef.current = next;
        onChangeRef.current(next);
        d.startX += (target - index) * d.step;
      }
      setDrag({ name: d.name, dx: pointerX - d.startX, active: true });
    };

    // While the pointer sits in an edge zone, scroll the track and shift the
    // drag origin by the same delta so reorder targets advance into the slots
    // scrolled into view (the dragged card stays under the pointer).
    const tick = (): void => {
      raf = 0;
      const d = dragRef.current;
      if (!d || !d.active || !scroller) return;
      const r = scroller.getBoundingClientRect();
      let dir = 0;
      if (pointerX < r.left + AUTOSCROLL_EDGE_PX) dir = -(r.left + AUTOSCROLL_EDGE_PX - pointerX) / AUTOSCROLL_EDGE_PX;
      else if (pointerX > r.right - AUTOSCROLL_EDGE_PX) dir = (pointerX - (r.right - AUTOSCROLL_EDGE_PX)) / AUTOSCROLL_EDGE_PX;
      if (dir === 0) return;
      const before = scroller.scrollLeft;
      scroller.scrollLeft = before + Math.sign(dir) * Math.ceil(Math.min(1, Math.abs(dir)) * AUTOSCROLL_MAX_PX);
      const ds = scroller.scrollLeft - before;
      if (ds !== 0) {
        d.startX -= ds;
        applyReorder();
      }
      raf = requestAnimationFrame(tick);
    };
    const ensureTick = (): void => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const move = (ev: PointerEvent): void => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      if (!d.active) {
        if (Math.abs(ev.clientX - d.startX) < DRAG_THRESHOLD_PX) return;
        d.active = true;
      }
      pointerX = ev.clientX;
      applyReorder();
      ensureTick();
    };
    const end = (ev: PointerEvent): void => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      detachRef.current?.();
      detachRef.current = null;
    };
    detachRef.current?.(); // stale session (should not happen, but never stack)
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    detachRef.current = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
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

  const ghostCard = (
    <button
      ref={addBtnRef}
      type="button"
      className="r24-tnode ghost"
      aria-label="Task 추가"
      aria-expanded={panelOpen}
      aria-haspopup="menu"
      disabled={!available.length}
      title={available.length ? 'Task 추가' : '추가할 Task 없음'}
      onClick={() => (panelOpen ? closePanel() : setPanelOpen(true))}
    >
      <Icon name="plus" size="md" strokeWidth={2} />
      <span className="r24-gt">Task 추가</span>
    </button>
  );

  return (
    <div>
      <div className="r24-canvas r24-build">
        <style>{R24_CSS + BUILD_CSS}</style>
        <div className="r24-bscroll">
          <div className="r24-bcap">실행 순서 — {chosen.length}개 Task</div>
          <div className="r24-line" ref={trackRef}>
            {chosen.map((t, i) => {
              const isDragged = drag !== null && drag.active && drag.name === t.name;
              return (
                <Fragment key={t.name}>
                  {i > 0 && <FlowArrow />}
                  <div
                    className={cn('r24-tnode', isDragged && 'dragging')}
                    style={isDragged && drag ? { transform: `translateX(${drag.dx}px)` } : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.display_name} — ${i + 1}번째. 좌우 화살표로 순서 이동, Delete로 제거`}
                    onPointerDown={onNodeDown(t)}
                    onKeyDown={onNodeKey(t, i)}
                  >
                    <span className="r24-seq" aria-hidden="true">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      className="r24-rm"
                      aria-label={`${t.display_name} 제거`}
                      title="제거"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => remove(t.name)}
                    >
                      <Icon name="x" size="sm" className="!h-2.5 !w-2.5" />
                    </button>
                    <KindMark kind={t.kind} />
                    <div className="r24-tx">
                      <div className="r24-nm">{t.display_name}</div>
                      <div className="r24-ds">{t.description}</div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {chosen.length > 0 && <FlowArrow />}
            {ghostCard}
          </div>
        </div>
        {panelOpen && available.length > 0 && (
          <div className="r24-cat">
            <div className="flex items-start justify-between border-b border-[var(--pl-border)] p-4 pb-3.5">
              <div>
                <div className="text-[14px] font-bold text-[var(--pl-text-strong)]">Task 카탈로그</div>
                <div className="mt-[3px] text-[11.5px] text-[var(--pl-text-faint)]">
                  {provider ?? ''}에서 실행 가능한 Task {catalog.length}종
                </div>
              </div>
              <button
                type="button"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-[6px] text-[var(--pl-text-weak)] hover:bg-[var(--pl-gray-100)]"
                aria-label="카탈로그 닫기"
                onClick={closePanel}
              >
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div className="r24-cat-body">
              <AddTaskMenu
                entries={available}
                onPick={(name) => {
                  add(name);
                  // Last catalog entry picked — nothing left to add, retire the panel.
                  if (available.length <= 1) closePanel();
                }}
              />
            </div>
          </div>
        )}
      </div>

      {chosen.length > 0 && (
        <div className={detailStyles.builder.hint}>
          Task {chosen.length}개 · 노드를 드래그해 실행 순서를 바꿀 수 있어요
        </div>
      )}
    </div>
  );
}
