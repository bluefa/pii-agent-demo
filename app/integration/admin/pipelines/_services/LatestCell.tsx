/**
 * The "파이프라인" cell of the services target table (design §2.2). Latest run is
 * RUNNING|PENDING → StatusPill + mono `#{pipeline_id}`; 204 / terminal / still
 * loading → muted em-dash. Pure presentational — drives off `latestCellState`.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { StatusPill } from '@/app/integration/admin/pipelines/_components/StatusPill';
import { latestCellState } from '@/app/integration/admin/pipelines/_services/logic';
import type { PipelineSummary } from '@/lib/pipeline/types';

export interface LatestCellProps {
  /** undefined = fetch in flight; null = 204/no active run; object = latest run. */
  entry: PipelineSummary | null | undefined;
}

export function LatestCell({ entry }: LatestCellProps): ReactElement {
  const state = latestCellState(entry);
  if (state.kind === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <StatusPill status={state.status} />
        <span className={cn(pipelineStyles.text.meta, '[font-family:var(--pl-font-mono)]')}>
          #{state.pipelineId}
        </span>
      </span>
    );
  }
  // loading + idle both render the muted placeholder (keeps the row height stable).
  return <span className={pipelineStyles.text.muted}>—</span>;
}
