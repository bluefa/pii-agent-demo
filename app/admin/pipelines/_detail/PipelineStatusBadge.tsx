/**
 * PipelineStatusBadge — text-only status pill (Figma "pipeline-detail-improved"
 * badge palette). No icon; colors reuse the semantic pill tokens. Used for the
 * header status, the drawer header task status, and (size="mini") the attempts
 * table rows.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { improvedStyles } from '@/app/admin/pipelines/_detail/detailImprovedStyles';
import type { PipelineStatus, TaskStatus } from '@/lib/pipeline/types';

export function PipelineStatusBadge({
  status,
  size = 'md',
  className,
}: {
  status: PipelineStatus | TaskStatus;
  size?: 'md' | 'mini';
  className?: string;
}): ReactElement {
  const { badge, drawer } = improvedStyles;
  return (
    <span className={cn(size === 'mini' ? drawer.miniBadge : badge.base, badge.tone[status], className)}>
      {status}
    </span>
  );
}
