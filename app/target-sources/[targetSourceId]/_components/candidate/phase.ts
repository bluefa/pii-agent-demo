import type { ScanUiState } from '@/app/components/features/scan/ScanPanel';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';

export type Phase =
  | 'fetching'
  | 'fetchError'
  | 'scanning'
  | 'scanFailed'
  | 'completing'
  | 'scanStale'
  | 'list'
  | 'empty';

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
  /**
   * 마지막 스캔이 정책 기한을 넘겼다(`old_scan`). 그 결과는 승인 요청의 입력이 될 수
   * 없으므로 목록보다도, 스캔 상태 프레임보다도 먼저 판정된다 — `scan_status` 와
   * 무관하게 기한이 지난 결과는 기한이 지난 것이다. 후보가 0건이어도 마찬가지다:
   * 기한이 지난 결과는 비어 있어도 여전히 기한이 지난 것이다.
   */
  scanStale: boolean;
}

export const selectPhase = ({
  fetchStatus,
  scanState,
  hasCandidates,
  completing,
  scanStale,
}: SelectPhaseInput): Phase => {
  if (completing) return 'completing';
  if (fetchStatus === 'loading') return 'fetching';
  if (fetchStatus === 'error') return 'fetchError';
  if (scanStale) return 'scanStale';
  if (scanState === 'IN_PROGRESS') return 'scanning';
  if (scanState === 'FAILED') return 'scanFailed';
  return hasCandidates ? 'list' : 'empty';
};
