'use client';

import { ConnectionTestPanel } from '@/app/components/features/process-status';
import { useConfirmedIntegration } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';

interface ConnectionTestSlotProps {
  targetSourceId: number;
  refreshProject: () => void;
}

export const ConnectionTestSlot = ({
  targetSourceId,
  refreshProject,
}: ConnectionTestSlotProps) => {
  const { state } = useConfirmedIntegration();

  if (state.status !== 'ready') return null;

  return (
    <div data-testid="connection-test">
      <ConnectionTestPanel
        targetSourceId={targetSourceId}
        confirmed={state.data}
        onResourceUpdate={refreshProject}
      />
    </div>
  );
};
