/**
 * JobKindTag — the terraform action (PLAN / APPLY / DESTROY) as a small bordered
 * pill on a terraform job node. The value comes from the backend `terraform_action`
 * field (null for CONDITION_CHECK, where this renders nothing).
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import type { TerraformAction } from '@/lib/pipeline/types';

export interface JobKindTagProps {
  action: TerraformAction | null | undefined;
  className?: string;
}

export function JobKindTag({ action, className }: JobKindTagProps): ReactElement | null {
  if (!action) return null;
  const t = pipelineStyles.jobKindTag;
  return <span className={cn(t.base, t.tone[action], className)}>{action}</span>;
}
