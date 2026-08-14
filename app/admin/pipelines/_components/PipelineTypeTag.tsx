/**
 * PipelineTypeTag (R18 §1) — INSTALL / DELETE / CUSTOM as icon + enum text.
 * Background-less inline tag so it stays visually subordinate to the status word.
 *
 * The per-type tint is gone (오너 2026-08-14, "색상이 강하지 않게"): the glyph now
 * inherits the label's colour, the same monotone grammar `ProvTag` uses. Encoding
 * stays double (shape + word), which is what `color-not-only` asks for; DELETE's
 * red was the third copy AND collided with the failure red one column over.
 *
 * INSTALL and CUSTOM moved to box-shaped glyphs (오너 2026-08-14, 시안 A — see the
 * glyph spec in docs/ux/benchmark/). Their reasons are on the paths in `icons.tsx`.
 * DELETE stays on `trash` by the owner's call, so the plus/minus symmetry the spec
 * proposed is not in play — what the change buys here is the shared box vocabulary.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import type { PipelineType } from '@/lib/pipeline/types';

const TYPE_ICON: Record<PipelineType, IconName> = {
  INSTALL: 'package-plus',
  DELETE: 'trash',
  CUSTOM: 'blocks',
};

export interface PipelineTypeTagProps {
  type: PipelineType;
  className?: string;
}

export function PipelineTypeTag({ type, className }: PipelineTypeTagProps): ReactElement {
  const t = pipelineStyles.typeTag;
  return (
    <span className={cn(t.base, className)}>
      <Icon name={TYPE_ICON[type]} size="sm" />
      {type}
    </span>
  );
}
