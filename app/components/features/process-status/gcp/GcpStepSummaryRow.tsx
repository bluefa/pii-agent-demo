import { GcpStepSummaryCard } from './GcpStepSummaryCard';
import { GCP_STEP_KEYS, GCP_STEP_LABELS, getGcpStepAggregateStatus, getGcpActiveStepCount, getGcpCompletedStepCount } from '@/lib/constants/gcp';
import type { GcpResourceStatus } from '@/app/api/_lib/v1-types';

interface GcpStepSummaryRowProps {
  resources: GcpResourceStatus[];
}

export const GcpStepSummaryRow = ({ resources }: GcpStepSummaryRowProps) => (
  <div className="grid grid-cols-3 gap-3">
    {GCP_STEP_KEYS.map((stepKey) => (
      <GcpStepSummaryCard
        key={stepKey}
        stepKey={stepKey}
        label={GCP_STEP_LABELS[stepKey]}
        activeCount={getGcpActiveStepCount(resources, stepKey)}
        completedCount={getGcpCompletedStepCount(resources, stepKey)}
        status={getGcpStepAggregateStatus(resources, stepKey)}
      />
    ))}
  </div>
);
