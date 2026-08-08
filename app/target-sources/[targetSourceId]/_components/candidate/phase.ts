import type { ScanUiState } from '@/app/components/features/scan/ScanPanel';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';

export type Phase = 'fetching' | 'fetchError' | 'scanning' | 'scanFailed' | 'completing' | 'list' | 'empty';

export interface SelectPhaseInput {
  fetchStatus: AsyncState<unknown>['status'];
  scanState: ScanUiState;
  hasCandidates: boolean;
  /**
   * 완료 확인 프레임이 서 있는 동안 — 결과 조회가 그 뒤에서 도는 중이라
   * fetchStatus 는 loading 이지만, 화면은 스켈레톤이 아니라 확인 프레임이
   * 소유한다. 그래서 loading 보다 먼저 판정된다.
   */
  completing: boolean;
}

export const selectPhase = ({
  fetchStatus,
  scanState,
  hasCandidates,
  completing,
}: SelectPhaseInput): Phase => {
  if (completing) return 'completing';
  if (fetchStatus === 'loading') return 'fetching';
  if (fetchStatus === 'error') return 'fetchError';
  if (scanState === 'IN_PROGRESS') return 'scanning';
  if (scanState === 'FAILED') return 'scanFailed';
  return hasCandidates ? 'list' : 'empty';
};
