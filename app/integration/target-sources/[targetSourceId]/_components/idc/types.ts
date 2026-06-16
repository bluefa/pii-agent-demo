import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

/**
 * Props every IDC step component receives from `IdcTargetSourceLayout`.
 * Mirrors the shared cloud step contract (project + identity + chrome + update).
 */
export interface IdcStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}
