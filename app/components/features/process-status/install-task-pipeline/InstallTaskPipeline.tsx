'use client';

import { bgColors, borderColors, cn } from '@/lib/theme';
import {
  InstallTaskCard,
  type InstallTaskCardStatus,
} from '@/app/components/features/process-status/install-task-pipeline/InstallTaskCard';

export interface InstallTaskPipelineItem {
  key: string;
  title: string;
  sub?: string;
  status: InstallTaskCardStatus;
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
    <div className={cn('grid gap-0 relative', GRID_COLS[items.length] ?? 'grid-cols-3')}>
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
        />
      ))}
      {items.slice(0, lastIndex).map((item, idx) => (
        <ConnectorChevron
          key={`chevron-${item.key}`}
          leftPercent={((idx + 1) / items.length) * 100}
        />
      ))}
    </div>
  );
};

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

interface ConnectorChevronProps {
  leftPercent: number;
}

const ConnectorChevron = ({ leftPercent }: ConnectorChevronProps) => (
  <div
    aria-hidden="true"
    style={{ left: `${leftPercent}%` }}
    className={cn(
      'absolute top-1/2 w-3.5 h-3.5 rotate-45 pointer-events-none z-10',
      '-translate-x-1/2 -translate-y-1/2',
      'border-t border-r',
      bgColors.surface,
      borderColors.default,
    )}
  />
);
