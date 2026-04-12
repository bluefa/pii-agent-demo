import { statusColors, cn } from '@/lib/theme';
import { GCP_STEP_KEYS, GCP_STEP_LABELS, GCP_STEP_STATUS_LABELS } from '@/lib/constants/gcp';
import type { GcpResourceStatus, GcpStepStatus, GcpStepStatusValue } from '@/app/api/_lib/v1-types';
import type { GcpStepKey } from '@/lib/constants/gcp';

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
        {guide && <p className="mt-0.5 text-xs text-gray-500">{guide}</p>}
      </div>
    );
  }

  return (
    <span className={cn('text-sm', statusColors.pending.textDark)}>
      ─ {GCP_STEP_STATUS_LABELS.SKIP}
    </span>
  );
};

const getResourceDisplayInfo = (resource: GcpResourceStatus) => {
  const name = resource.resourceName || resource.resourceId;
  const typeLabel = resource.resourceType === 'CLOUD_SQL' ? 'Cloud SQL' : 'BigQuery';
  const subTypeLabel = resource.resourceSubType
    ? ` / ${resource.resourceSubType.replace(/_/g, ' ')}`
    : '';
  return { name, detail: `${typeLabel}${subTypeLabel}` };
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
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-2.5 text-left font-medium text-gray-700">리소스</th>
            {GCP_STEP_KEYS.map((key) => (
              <th key={key} className="px-4 py-2.5 text-left font-medium text-gray-700">
                {GCP_STEP_LABELS[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const { name, detail } = getResourceDisplayInfo(resource);
            return (
              <tr key={resource.resourceId} className="border-b border-gray-100 last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{name}</div>
                  <div className="text-xs text-gray-500">{detail}</div>
                </td>
                {GCP_STEP_KEYS.map((key: GcpStepKey) => (
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
