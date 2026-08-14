/**
 * PipelineTypeTag (R18 §1) — INSTALL / DELETE / CUSTOM as icon + enum text.
 * Background-less inline tag so it stays visually subordinate to the status word.
 *
 * The per-type tint is gone (오너 2026-08-14, "색상이 강하지 않게"): the glyph now
 * inherits the label's colour, the same monotone grammar `ProvTag` uses. Encoding
 * stays double (shape + word), which is what `color-not-only` asks for; DELETE's
 * red was the third copy AND collided with the failure red one column over.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import type { PipelineType } from '@/lib/pipeline/types';

const TYPE_ICON: Record<PipelineType, IconName> = {
  INSTALL: 'install',
  DELETE: 'trash',
  CUSTOM: 'sliders',
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
