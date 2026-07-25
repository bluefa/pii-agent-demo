'use client';

/**
 * R24 task-node grammar — target-detail redesign (Figma SzifNRYweRXhiIDI0uyK3R
 * node 9-2). One shared vocabulary for every surface that renders Task cards on
 * a grid canvas: the target page's current-pipeline strip, the start-modal's
 * recipe confirmation flow, and the custom builder.
 *
 *   canvas  — 16px line grid on the inner-surface wash (`--pl-bg-inner`),
 *             r10 border; `.r24-hscroll` = ONE row + horizontal scroll (thin
 *             pill scrollbar), the node clipped at the edge is the affordance.
 *   tnode   — 224px icon-left card: bare kind mark (Terraform logomark 26px /
 *             warn clock — no tile wrap), name 13/700 ×2 lines, description
 *             11.5 weak ×2 lines, optional status row. States: `cur` (primary
 *             ring), `pend` (dashed), `dim` (past), `ghost` (Task 추가 slot).
 *   chips   — `seq` black round order chip (top-left), `rm` ✕ remove chip
 *             (top-right).
 *
 * Pseudo-chips/scrollbar styling need rule CSS Tailwind can't express, so the
 * grammar is a scoped <style> string (FLOW_CSS precedent); every color is a
 * `--pl-*` token.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { TerraformLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { JobKindTag } from '@/app/admin/pipelines/_components/JobKindTag';
import type { PipelineStatus, PipelineType, TaskKind, TaskStatus, TerraformAction } from '@/lib/pipeline/types';

export const R24_CSS = `
.r24-canvas{background-color:var(--pl-bg-inner);background-image:linear-gradient(var(--pl-flow-grid) 1px,transparent 1px),linear-gradient(90deg,var(--pl-flow-grid) 1px,transparent 1px);background-size:16px 16px;border:1px solid var(--pl-border);border-radius:10px}
.r24-hscroll{overflow-x:auto;overscroll-behavior-x:contain;padding:22px;scrollbar-width:thin;scrollbar-color:var(--pl-gray-300) transparent}
.r24-hscroll::-webkit-scrollbar{height:6px}
.r24-hscroll::-webkit-scrollbar-thumb{border-radius:99px;background:var(--pl-gray-300)}
.r24-hscroll::-webkit-scrollbar-track{border-radius:99px;background:color-mix(in srgb,var(--pl-gray-900) 7%,transparent)}
.r24-line{display:flex;align-items:center;gap:10px;width:max-content}
.r24-tnode{position:relative;display:flex;align-items:flex-start;gap:12px;width:224px;background:var(--pl-bg-card);border:1px solid var(--pl-border);border-radius:10px;padding:13px 14px;flex:none;box-shadow:var(--pl-shadow-xs)}
.r24-tnode .r24-tx{min-width:0}
.r24-tnode .r24-nm{font-size:13px;font-weight:700;line-height:1.35;color:var(--pl-text-strong);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:keep-all}
.r24-tnode .r24-ds{margin-top:3px;font-size:11.5px;color:var(--pl-text-weak);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.r24-tnode .r24-st{margin-top:7px;display:flex;align-items:center;gap:6px}
.r24-tnode.cur{border-color:var(--pl-primary);box-shadow:0 0 0 3px var(--pl-primary-ring)}
.r24-tnode.pend{border-style:dashed;background:color-mix(in srgb,var(--pl-bg-card) 65%,transparent);box-shadow:none}
.r24-tnode.pend .r24-nm{color:var(--pl-text-weak)}
.r24-tnode.dim .r24-nm{color:var(--pl-text-medium)}
.r24-tnode.ghost{border:1.5px dashed var(--pl-border-strong);background:color-mix(in srgb,var(--pl-bg-card) 50%,transparent);box-shadow:none;align-items:center;justify-content:center;flex-direction:column;gap:6px;min-height:78px;color:var(--pl-text-faint)}
.r24-tnode.ghost .r24-gt{font-size:12px;font-weight:600}
.r24-ticon{flex:none;margin-top:1px}
.r24-ticon svg{width:26px;height:26px}
.r24-ticon.cond{color:var(--pl-warn)}
.r24-ticon.cond svg{width:24px;height:24px;margin:1px}
.r24-seq{position:absolute;top:-8px;left:-8px;width:20px;height:20px;border-radius:99px;background:var(--pl-gray-900);color:var(--pl-white);font-family:var(--pl-font-mono);font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:var(--pl-shadow-xs)}
.r24-rm{position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:99px;background:var(--pl-bg-card);border:1px solid var(--pl-border-strong);color:var(--pl-text-weak);display:flex;align-items:center;justify-content:center;box-shadow:var(--pl-shadow-xs);cursor:pointer;padding:0}
.r24-rm:hover{color:var(--pl-err-text);border-color:var(--pl-err-border)}
.r24-rm:focus-visible{outline:2px solid var(--pl-primary);outline-offset:1px}
.r24-arrow{color:var(--pl-gray-400);flex:none}
`;

/** Pipeline-type tone (icon-tile bg + icon color) — same color-mix recipe as
 *  detailStyles.typeTile.icoTone so the `--pl-type-*` tokens stay the source. */
const TYPE_TONE: Record<PipelineType, { tile: string; ink: string; icon: IconName }> = {
  INSTALL: {
    tile: 'bg-[color-mix(in_srgb,var(--pl-type-install)_10%,transparent)]',
    ink: 'text-[var(--pl-type-install)]',
    icon: 'install',
  },
  DELETE: {
    tile: 'bg-[color-mix(in_srgb,var(--pl-type-delete)_10%,transparent)]',
    ink: 'text-[var(--pl-type-delete)]',
    icon: 'trash',
  },
  CUSTOM: {
    tile: 'bg-[color-mix(in_srgb,var(--pl-type-custom)_10%,transparent)]',
    ink: 'text-[var(--pl-type-custom)]',
    icon: 'sliders',
  },
};

const TILE_SIZE = {
  md: 'w-11 h-11 rounded-[10px]',
  xs: 'w-7 h-7 rounded-[8px]',
} as const;

/** Tinted pipeline-type icon tile (run-card head, history rows, modal eyebrow). */
export function TypeTile({
  type,
  size = 'md',
  className,
}: {
  type: PipelineType;
  size?: keyof typeof TILE_SIZE;
  className?: string;
}): ReactElement {
  const tone = TYPE_TONE[type];
  return (
    <span
      className={cn('flex items-center justify-center flex-none', TILE_SIZE[size], tone.tile, tone.ink, className)}
      aria-hidden="true"
    >
      <Icon name={tone.icon} size={size === 'md' ? 'lg' : 'sm'} strokeWidth={2} />
    </span>
  );
}

/** Mono type pill — `INSTALL` 등 wire enum을 담는 흰 캡슐 태그. */
export function TypePill({ type, className }: { type: PipelineType; className?: string }): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-2.5 py-[2.5px] text-[11px] font-semibold text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
        className,
      )}
    >
      {type}
    </span>
  );
}

/** Bare kind mark — Terraform brand logomark / warn clock, NO tile wrap (R24). */
export function KindMark({ kind }: { kind: TaskKind }): ReactElement {
  if (kind === 'CONDITION_CHECK') {
    return (
      <span className="r24-ticon cond" title="조건 확인 — 폴링">
        <Icon name="clock" strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className="r24-ticon" title="Terraform">
      <TerraformLogo />
    </span>
  );
}

/** Inter-node flow arrow (→). */
export function FlowArrow(): ReactElement {
  return (
    <span className="r24-arrow" aria-hidden="true">
      <Icon name="arrow-right" size="md" strokeWidth={2.2} />
    </span>
  );
}

export interface R24TaskNodeProps {
  kind: TaskKind;
  name: string;
  /** Secondary 2-line description (catalog/definition sentence). */
  desc?: string | null;
  /** PLAN/APPLY/DESTROY tag above the name for terraform jobs; null hides it. */
  action?: TerraformAction | null;
  /** Black round order chip at the top-left corner. */
  seq?: number;
  state?: 'cur' | 'pend' | 'dim';
  /** Status row under the description (badge + retry counter 등). */
  footer?: ReactNode;
  className?: string;
}

/** 224px icon-left Task card on the grid canvas — the R24 node. */
export function R24TaskNode({ kind, name, desc, action, seq, state, footer, className }: R24TaskNodeProps): ReactElement {
  return (
    <div className={cn('r24-tnode', state, className)}>
      {seq != null && (
        <span className="r24-seq" aria-hidden="true">
          {seq}
        </span>
      )}
      <KindMark kind={kind} />
      <div className="r24-tx">
        {action ? (
          <div className="mb-1">
            <JobKindTag action={action} />
          </div>
        ) : null}
        <div className="r24-nm">{name}</div>
        {desc ? <div className="r24-ds">{desc}</div> : null}
        {footer ? <div className="r24-st">{footer}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Running-card flow variant (Figma node 9-2, 9:506 "Flow Track"). The live
 * pipeline's task cards carry status, so they use a richer treatment than the
 * bare modal node: a 44px kind-icon tile (violet Terraform / amber condition,
 * neutral when queued), a top-right status corner (check / spinner / ordinal),
 * and a status pill + retry counter. State drives the card frame — cur (primary
 * border), pend (dashed + dimmed), failed (err border).
 * -------------------------------------------------------------------------- */

export const R24_RUN_CSS = `
.rtc{position:relative;display:flex;align-items:center;gap:12px;width:248px;flex:none;background:var(--pl-bg-card);border:1px solid var(--pl-border);border-radius:12px;padding:12px 16px 12px 12px;box-shadow:var(--pl-shadow-xs)}
.rtc-tile{flex:none;width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--pl-gray-50)}
.rtc-tile svg{width:26px;height:26px}
.rtc-tile.tf{background:color-mix(in srgb,var(--pl-type-custom) 9%,var(--pl-bg-card));color:var(--pl-brand-tf)}
.rtc-tile.cond{background:color-mix(in srgb,var(--pl-warn) 13%,var(--pl-bg-card));color:var(--pl-warn)}
.rtc-tx{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
.rtc-nm{font-size:13px;font-weight:700;line-height:1.35;letter-spacing:-.2px;color:var(--pl-text-strong);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:keep-all}
.rtc-ds{font-size:10.5px;line-height:1.5;color:var(--pl-text-weak);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.rtc-st{display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap}
.rtc.cur{border-color:var(--pl-primary);border-width:2px;padding:11px 15px 11px 11px;box-shadow:0 2px 8px color-mix(in srgb,var(--pl-gray-900) 12%,transparent)}
.rtc.pend{border-style:dashed;background:color-mix(in srgb,var(--pl-bg-card) 60%,transparent);opacity:.72;box-shadow:none}
.rtc.pend .rtc-nm{color:var(--pl-text-weak)}
.rtc.pend .rtc-ds{color:var(--pl-text-faint)}
.rtc.pend .rtc-tile{background:var(--pl-gray-50);color:var(--pl-text-faint)}
.rtc.failed{border-color:var(--pl-err-border)}
.rtc-corner{position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;box-shadow:0 0 0 2px var(--pl-bg-inner);font-family:var(--pl-font-mono);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
.rtc-corner svg{width:12px;height:12px;stroke-width:3}
.rtc-corner.done{background:var(--pl-ok);color:var(--pl-white)}
.rtc-corner.failed{background:var(--pl-err);color:var(--pl-white)}
.rtc-corner.cancelled{background:var(--pl-gray-400);color:var(--pl-white)}
.rtc-corner.running{background:var(--pl-bg-card);border:1px solid var(--pl-info-border)}
.rtc-corner.pending{background:var(--pl-gray-200);color:var(--pl-text-weak)}
.rtc-spin{width:12px;height:12px;border-radius:50%;border:2px solid var(--pl-info-border);border-top-color:var(--pl-info);display:inline-block}
@keyframes r24-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:no-preference){.rtc-spin{animation:r24-spin .8s linear infinite}}
`;

type FlowKey = 'done' | 'running' | 'pending' | 'failed' | 'cancelled';

/** Wire status (pipeline OR task) → the flow's visual bucket + friendly label.
 *  READY keeps its own label (not 'PENDING'): a retry-waiting current task
 *  labelled PENDING read as "the pipeline never left PENDING" to operators —
 *  and the drawer's PipelineStatusBadge already says READY for the same task. */
const STATUS_VIEW: Record<PipelineStatus | TaskStatus, { key: FlowKey; label: string }> = {
  RUNNING: { key: 'running', label: 'RUNNING' },
  IN_PROGRESS: { key: 'running', label: 'RUNNING' },
  PENDING: { key: 'pending', label: 'PENDING' },
  READY: { key: 'pending', label: 'READY' },
  BLOCKED: { key: 'pending', label: 'PENDING' },
  DONE: { key: 'done', label: 'DONE' },
  FAILED: { key: 'failed', label: 'FAILED' },
  CANCELLED: { key: 'cancelled', label: 'CANCELLED' },
};

const PILL_TONE: Record<FlowKey, string> = {
  done: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  running: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
  pending: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
  failed: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  cancelled: 'bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',
};

/** Status capsule for the run flow — green DONE / blue RUNNING (ring dot) /
 *  gray PENDING / red FAILED. Friendly labels, not the raw wire enum. */
export function FlowStatusPill({
  status,
  className,
}: {
  status: PipelineStatus | TaskStatus;
  className?: string;
}): ReactElement {
  const view = STATUS_VIEW[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] rounded-full px-2 py-[3px] text-[10.5px] font-semibold whitespace-nowrap',
        PILL_TONE[view.key],
        className,
      )}
    >
      {view.key === 'running' && (
        <span className="h-2 w-2 flex-none rounded-full border-[1.4px] border-current" aria-hidden="true" />
      )}
      {view.label}
    </span>
  );
}

// Corner glyphs match the pipeline 현황 flow (TaskFlow nodeBadge): check / ✕ /
// ban, a ring spinner for running, and the ordinal for queued.
const CORNER_ICON: Partial<Record<FlowKey, IconName>> = {
  done: 'check',
  failed: 'x',
  cancelled: 'ban',
};

export interface RunTaskCardProps {
  kind: TaskKind;
  name: string;
  desc?: string | null;
  /** PLAN/APPLY/DESTROY tag for terraform jobs; null hides it. */
  action?: TerraformAction | null;
  status: TaskStatus;
  /** 1-based ordinal — shown in the corner while the task is queued. */
  seq: number;
  /** '시도 1 / 3' — the current task's retry budget (IN_PROGRESS, or READY
   *  while waiting between retry attempts). */
  retry?: string | null;
}

/** Live-pipeline task card — tile + status corner + status pill (R24 run flow). */
export function RunTaskCard({ kind, name, desc, action, status, seq, retry }: RunTaskCardProps): ReactElement {
  const view = STATUS_VIEW[status];
  const cardState =
    view.key === 'running'
      ? 'cur'
      : view.key === 'pending'
        ? 'pend'
        : view.key === 'failed'
          ? 'failed'
          : undefined;
  const cornerIcon = CORNER_ICON[view.key];
  return (
    <div className={cn('rtc', cardState)}>
      <span className={cn('rtc-corner', view.key)} aria-hidden="true">
        {view.key === 'running' ? (
          <span className="rtc-spin" />
        ) : cornerIcon ? (
          <Icon name={cornerIcon} size="sm" strokeWidth={3} />
        ) : (
          seq
        )}
      </span>
      <span className={cn('rtc-tile', kind === 'CONDITION_CHECK' ? 'cond' : 'tf')} aria-hidden="true">
        {kind === 'CONDITION_CHECK' ? <Icon name="clock" strokeWidth={2} /> : <TerraformLogo />}
      </span>
      <div className="rtc-tx">
        <div className="rtc-nm">{name}</div>
        {desc ? <div className="rtc-ds">{desc}</div> : null}
        <div className="rtc-st">
          <JobKindTag action={action} />
          <FlowStatusPill status={status} />
          {retry ? (
            <span className="text-[10px] tabular-nums text-[var(--pl-text-faint)]">{retry}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
