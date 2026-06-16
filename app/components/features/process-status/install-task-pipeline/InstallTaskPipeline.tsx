'use client';

import type { InstallTaskStatus } from '@/lib/constants/gcp';
import { InstallTaskCard } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskCard';

export interface InstallTaskPipelineItem {
  key: string;
  title: string;
  sub?: string;
  status: InstallTaskStatus;
  completedCount?: number;
  activeCount?: number;
  onClick?: () => void;
}

interface InstallTaskPipelineProps {
  items: InstallTaskPipelineItem[];
  /** Grid column count. Default 3 (cloud providers). IDC passes 2 for its 2-task pipeline (v15 `cols-2`). */
  columns?: 2 | 3;
}

export const InstallTaskPipeline = ({ items, columns = 3 }: InstallTaskPipelineProps) => {
  if (items.length === 0) return null;

  const lastIndex = items.length - 1;
  const gridCls = columns === 2 ? 'grid grid-cols-2 gap-0' : 'grid grid-cols-3 gap-0';

  return (
    <div className={gridCls}>
      {items.map((item, idx) => (
        <InstallTaskCard
          key={item.key}
          num={idx + 1}
          title={item.title}
          sub={item.sub}
          status={item.status}
          completedCount={item.completedCount}
          activeCount={item.activeCount}
          onClick={item.onClick}
          position={idx === 0 ? 'first' : idx === lastIndex ? 'last' : 'middle'}
          showConnector={idx < lastIndex}
        />
      ))}
    </div>
  );
};
