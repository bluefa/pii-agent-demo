/**
 * PipelineTypeTag (R18 §1) — INSTALL / DELETE / CUSTOM with icon + color + enum
 * text (triple encoding; `color-not-only`). Background-less inline tag so it
 * stays visually subordinate to the filled status pills.
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
      <Icon name={TYPE_ICON[type]} size="sm" className={t.tone[type]} />
      {type}
    </span>
  );
}
