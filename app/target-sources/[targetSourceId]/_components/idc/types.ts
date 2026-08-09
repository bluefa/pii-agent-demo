import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';

/**
 * Props every IDC step component receives from `IdcTargetSourceLayout`.
 * Mirrors the shared cloud step contract (project + identity + chrome + update).
 */
export interface IdcStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  /** Optional page-header action slot (none by default — destructive actions live in the guide band). */
  action?: ReactNode;
  /** Guide band (가이드/진행 내역 + 모니터링·협업채널·인프라 삭제), slotted under the header by the layout. */
  guideSlot?: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}
