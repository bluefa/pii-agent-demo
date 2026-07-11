/**
 * KindChip — task `kind` label (design-inventory §3 `.kindchip`). Mono 12/600,
 * neutral fill, NO base border; CONDITION_CHECK adds the dashed-border variant.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import type { TaskKind } from '@/lib/pipeline/types';

export interface KindChipProps {
  kind: TaskKind;
  className?: string;
}

export function KindChip({ kind, className }: KindChipProps): ReactElement {
  const { kindChip } = pipelineStyles;
  const cond = kind === 'CONDITION_CHECK';
  return (
    <span className={cn(kindChip.base, cond ? kindChip.cond : kindChip.plain, className)}>{kind}</span>
  );
}
