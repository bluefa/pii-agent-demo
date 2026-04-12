import { statusColors, cn } from '@/lib/theme';
import type { GcpStepAggregateStatus } from '@/lib/constants/gcp';

interface GcpStepSummaryCardProps {
  label: string;
  activeCount: number;
  completedCount: number;
  status: GcpStepAggregateStatus;
}

const STATUS_COLOR_MAP: Record<GcpStepAggregateStatus, (typeof statusColors)[keyof typeof statusColors]> = {
  COMPLETED: statusColors.success,
  FAIL: statusColors.error,
  IN_PROGRESS: statusColors.warning,
  PENDING: statusColors.pending,
};

const StatusIcon = ({ status }: { status: GcpStepAggregateStatus }) => {
  if (status === 'COMPLETED') {
    return (
      <svg className={cn('w-4 h-4', statusColors.success.text)} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (status === 'FAIL') {
    return (
      <svg className={cn('w-4 h-4', statusColors.error.text)} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    );
  }
  if (status === 'IN_PROGRESS') {
    return <div className={cn('w-4 h-4 border-2 border-t-transparent rounded-full animate-spin', statusColors.warning.border)} />;
  }
  return <div className={cn('w-4 h-4 rounded-full', statusColors.pending.dot)} />;
};

export const GcpStepSummaryCard = ({
  label,
  activeCount,
  completedCount,
  status,
}: GcpStepSummaryCardProps) => {
  const color = STATUS_COLOR_MAP[status];

  return (
    <div className={cn('px-3 py-2.5 rounded-lg border', color.bg, color.border)}>
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className={cn('text-sm font-medium', color.textDark)}>{label}</span>
      </div>
      <div className="mt-1.5">
        <span className={cn('text-xs', color.textDark)}>
          {completedCount}/{activeCount} 완료
        </span>
      </div>
    </div>
  );
};
