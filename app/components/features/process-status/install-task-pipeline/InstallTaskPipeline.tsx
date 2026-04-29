'use client';

import type { InstallTaskStatus } from '@/lib/constants/gcp';
import { cn } from '@/lib/theme';
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
}

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export const InstallTaskPipeline = ({ items }: InstallTaskPipelineProps) => {
  if (items.length === 0) return null;

  const lastIndex = items.length - 1;
  const gridClass = GRID_COLS[items.length] ?? 'grid-cols-3';

  return (
    <div className={cn('grid gap-0', gridClass)}>
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
