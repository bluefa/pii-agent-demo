import { GcpStepSummaryCard } from './GcpStepSummaryCard';
import { GCP_STEP_KEYS, GCP_STEP_LABELS, getGcpStepSummary } from '@/lib/constants/gcp';
import type { GcpResourceStatus } from '@/app/api/_lib/v1-types';

interface GcpStepSummaryRowProps {
  resources: GcpResourceStatus[];
}

export const GcpStepSummaryRow = ({ resources }: GcpStepSummaryRowProps) => (
  <div className="grid grid-cols-3 gap-3">
    {GCP_STEP_KEYS.map((stepKey) => {
      const { status, activeCount, completedCount } = getGcpStepSummary(resources, stepKey);
      return (
        <GcpStepSummaryCard
          key={stepKey}
          label={GCP_STEP_LABELS[stepKey]}
          activeCount={activeCount}
          completedCount={completedCount}
          status={status}
        />
      );
    })}
  </div>
);
