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
}

export const InstallTaskPipeline = ({ items }: InstallTaskPipelineProps) => {
  if (items.length === 0) return null;

  const lastIndex = items.length - 1;

  return (
    <div className="grid grid-cols-3 gap-0">
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
