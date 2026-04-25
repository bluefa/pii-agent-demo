import type { ScanUiState } from '@/app/components/features/scan/ScanPanel';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';

export type Phase = 'fetching' | 'fetchError' | 'scanning' | 'scanFailed' | 'list' | 'empty';

export interface SelectPhaseInput {
  fetchStatus: AsyncState<unknown>['status'];
  scanState: ScanUiState;
  hasCandidates: boolean;
}

export const selectPhase = ({
  fetchStatus,
  scanState,
  hasCandidates,
}: SelectPhaseInput): Phase => {
  if (fetchStatus === 'loading') return 'fetching';
  if (fetchStatus === 'error') return 'fetchError';
  if (scanState === 'IN_PROGRESS') return 'scanning';
  if (scanState === 'FAILED') return 'scanFailed';
  return hasCandidates ? 'list' : 'empty';
};
