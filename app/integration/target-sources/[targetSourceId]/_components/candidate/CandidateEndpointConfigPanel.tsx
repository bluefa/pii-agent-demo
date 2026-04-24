'use client';

import { VmDatabaseConfigPanel } from '@/app/components/features/resource-table';
import type { AzureVmNic } from '@/lib/types/azure';
import type { EndpointConfigDraft } from '@/lib/types/resources';

interface CandidateEndpointConfigPanelProps {
  resourceId: string;
  initial?: EndpointConfigDraft;
  networkInterfaces?: AzureVmNic[];
  onSave: (resourceId: string, draft: EndpointConfigDraft) => void;
  onCancel: () => void;
}

export const CandidateEndpointConfigPanel = ({
  resourceId,
  initial,
  networkInterfaces,
  onSave,
  onCancel,
}: CandidateEndpointConfigPanelProps) => (
  <VmDatabaseConfigPanel
    resourceId={resourceId}
    initialConfig={initial}
    nics={networkInterfaces}
    onSave={onSave}
    onCancel={onCancel}
  />
);
