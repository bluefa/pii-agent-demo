import { statusColors, textColors, borderColors, cn } from '@/lib/theme';
import { GCP_STEP_KEYS, GCP_STEP_LABELS, GCP_STEP_STATUS_LABELS } from '@/lib/constants/gcp';
import type { GcpResourceStatus, GcpStepStatus } from '@/app/api/_lib/v1-types';

interface GcpResourceStatusTableProps {
  resources: GcpResourceStatus[];
}

const StepStatusCell = ({ step }: { step: GcpStepStatus }) => {
  const { status, guide } = step;

  if (status === 'COMPLETED') {
    return (
      <div className="flex items-center gap-1.5">
        <svg className={cn('w-4 h-4', statusColors.success.text)} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span className={cn('text-sm', statusColors.success.textDark)}>{GCP_STEP_STATUS_LABELS.COMPLETED}</span>
      </div>
    );
  }

  if (status === 'IN_PROGRESS') {
    return (
      <div className="flex items-center gap-1.5">
        <div className={cn('w-4 h-4 border-2 border-t-transparent rounded-full animate-spin', statusColors.warning.border)} />
        <span className={cn('text-sm', statusColors.warning.textDark)}>{GCP_STEP_STATUS_LABELS.IN_PROGRESS}</span>
      </div>
    );
  }

  if (status === 'FAIL') {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <svg className={cn('w-4 h-4', statusColors.error.text)} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <span className={cn('text-sm', statusColors.error.textDark)}>{GCP_STEP_STATUS_LABELS.FAIL}</span>
        </div>
        {guide && <p className={cn('mt-0.5 text-xs', textColors.tertiary)}>{guide}</p>}
      </div>
    );
  }

  return (
    <span className={cn('text-sm', statusColors.pending.textDark)}>
      ─ {GCP_STEP_STATUS_LABELS.SKIP}
    </span>
  );
};

export const GcpResourceStatusTable = ({ resources }: GcpResourceStatusTableProps) => {
  if (resources.length === 0) {
    return (
      <div className={cn('px-4 py-3 rounded-lg border text-sm', statusColors.pending.bg, statusColors.pending.border, statusColors.pending.textDark)}>
        설치 대상 리소스가 없습니다.
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border', borderColors.default)}>
      <table className="w-full text-sm">
        <thead>
          <tr className={cn('border-b', borderColors.default)}>
            <th className={cn('px-4 py-2.5 text-left font-medium', textColors.secondary)}>리소스</th>
            {GCP_STEP_KEYS.map((key) => (
              <th key={key} className={cn('px-4 py-2.5 text-left font-medium', textColors.secondary)}>
                {GCP_STEP_LABELS[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const name = resource.resourceName || resource.resourceId;
            const typeLabel = resource.resourceType === 'CLOUD_SQL' ? 'Cloud SQL' : 'BigQuery';
            const subTypeLabel = resource.resourceSubType
              ? ` / ${resource.resourceSubType.replace(/_/g, ' ')}`
              : '';

            return (
              <tr key={resource.resourceId} className={cn('border-b last:border-b-0', borderColors.default)}>
                <td className="px-4 py-3">
                  <div className={cn('font-medium', textColors.primary)}>{name}</div>
                  <div className={cn('text-xs', textColors.tertiary)}>{typeLabel}{subTypeLabel}</div>
                </td>
                {GCP_STEP_KEYS.map((key) => (
                  <td key={key} className="px-4 py-3">
                    <StepStatusCell step={resource[key]} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
