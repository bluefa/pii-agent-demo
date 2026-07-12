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
import type { PipelineType, TaskKind } from '@/lib/pipeline/types';

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
  /** Black round order chip at the top-left corner. */
  seq?: number;
  state?: 'cur' | 'pend' | 'dim';
  /** Status row under the description (badge + retry counter 등). */
  footer?: ReactNode;
  className?: string;
}

/** 224px icon-left Task card on the grid canvas — the R24 node. */
export function R24TaskNode({ kind, name, desc, seq, state, footer, className }: R24TaskNodeProps): ReactElement {
  return (
    <div className={cn('r24-tnode', state, className)}>
      {seq != null && (
        <span className="r24-seq" aria-hidden="true">
          {seq}
        </span>
      )}
      <KindMark kind={kind} />
      <div className="r24-tx">
        <div className="r24-nm">{name}</div>
        {desc ? <div className="r24-ds">{desc}</div> : null}
        {footer ? <div className="r24-st">{footer}</div> : null}
      </div>
    </div>
  );
}
