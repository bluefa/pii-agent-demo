/**
 * InfraSideTag — marks whose infrastructure a task card operates on: 서비스측
 * (service-owned, e.g. *_SERVICE_* / IDC CX) vs BDC측 (*_BDC_* / IDC BDP).
 * Derive the side with `taskInfraSide(task_definition)`; renders nothing when
 * the side is unknown (no tag over a wrong tag).
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { INFRA_SIDE_LABELS, type InfraSide } from '@/lib/pipeline/format';

export interface InfraSideTagProps {
  side: InfraSide | null | undefined;
  className?: string;
}

export function InfraSideTag({ side, className }: InfraSideTagProps): ReactElement | null {
  if (!side) return null;
  const t = pipelineStyles.infraSideTag;
  return <span className={cn(t.base, t.tone[side], className)}>{INFRA_SIDE_LABELS[side]}</span>;
}
