/**
 * PipelineTypeTag (R18 §1) — INSTALL / DELETE / CUSTOM as a tinted glyph + a
 * Korean label. Background-less inline tag so it stays visually subordinate to
 * the status word.
 *
 * The label is 한글 (오너 2026-08-15), sourced from the one shared `typeKo`
 * vocabulary rather than the wire enum — the same rule the status word already
 * follows: 사람이 읽는 자리는 한글, enum 원문은 데이터 표기(`TypePill`)에만. The
 * filter menu formats through that same function; a row reading 설치 under a menu
 * reading INSTALL would be one value wearing two names.
 *
 * Colour is on the GLYPH only (오너 2026-08-15) — see `pipelineStyles.typeTag`
 * for why that survives DELETE red sitting beside failure red.
 *
 * INSTALL and CUSTOM moved to box-shaped glyphs (오너 2026-08-14, 시안 A — see the
 * glyph spec in docs/ux/benchmark/). Their reasons are on the paths in `icons.tsx`.
 * DELETE stays on `trash` by the owner's call, so the plus/minus symmetry the spec
 * proposed is not in play — what the change buys here is the shared box vocabulary.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { typeKo } from '@/lib/pipeline/format';
import type { PipelineType } from '@/lib/pipeline/types';

const TYPE_ICON: Record<PipelineType, IconName> = {
  INSTALL: 'package-plus',
  DELETE: 'trash',
  CUSTOM: 'blocks',
};

/** 20px (오너 2026-08-15, 14 에서 상향) — `Icon` 의 스케일에 없는 값이라 raw px. */
const GLYPH_PX = 20;

export interface PipelineTypeTagProps {
  type: PipelineType;
  className?: string;
}

export function PipelineTypeTag({ type, className }: PipelineTypeTagProps): ReactElement {
  const t = pipelineStyles.typeTag;
  return (
    <span className={cn(t.base, className)}>
      <Icon name={TYPE_ICON[type]} size={GLYPH_PX} className={t.glyphTone[type]} />
      {typeKo(type)}
    </span>
  );
}
