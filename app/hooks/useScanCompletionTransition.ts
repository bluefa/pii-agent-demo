'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 완료 확인 프레임의 단계.
 * - `settling`: 진행바가 100%에 닿는 걸 보여주는 구간. 폴링은 마지막으로 본
 *   값(예: 72%)에서 끝나므로, 이 구간이 없으면 100%를 아무도 보지 못한다.
 * - `confirming`: 완료 체크가 서 있는 구간. 건수는 말하지 않는다 — 이 시점에
 *   댈 수 있는 숫자는 다음 화면과 단위가 다르다(ScanRunningState 의 COPY 참고).
 */
export type ScanCompletionStage = 'idle' | 'settling' | 'confirming';

const SETTLE_MS = 400;
const CONFIRM_MS = 1200;

export interface UseScanCompletionTransitionReturn {
  stage: ScanCompletionStage;
  /** 새 스캔이 성공으로 끝난 순간 호출한다 (useScanPolling 의 onScanComplete). */
  begin: () => void;
}

/**
 * 스캔 완료를 화면의 한 단계로 승격시킨다. useScanPolling 이 SUCCESS 를 관찰한
 * 프레임에 진행 UI가 결과 UI로 교체되던 것을, 확인 → 전환의 두 박자로 늘린다.
 *
 * 완료 관찰 자체는 useScanPolling 의 onScanComplete 가 판정한다(잡 id 기반, 첫
 * 관찰에서 기존 완료 잡은 입양). 이 훅이 `completed` 같은 불리언의 상승 에지를
 * 직접 보지 않는 이유가 그것이다 — 마운트 직후 예전 SUCCESS 잡이 처음 도착하는
 * 것도 상승 에지라, 스캔하지도 않은 화면에서 완료 연출이 재생된다.
 *
 * 결과 조회를 기다리지는 않는다. 확인 프레임이 서 있는 1.6초 안에 조회가 끝나면
 * (평범한 경우) 로딩은 화면에 서지 않고, 그보다 오래 걸리면 그때는 사용자가 실제로
 * 기다리는 중이므로 스켈레톤이 제 역할을 하는 게 맞다. 조회 상태를 훅에 물리면
 * 프레임을 붙잡아 둘 수는 있지만, "언제 놓아줄지"가 조회 쪽 상태에 영구히 묶인다.
 */
export const useScanCompletionTransition = (): UseScanCompletionTransitionReturn => {
  const [stage, setStage] = useState<ScanCompletionStage>('idle');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  const begin = useCallback(() => {
    // 재스캔이 확인 프레임 중에 끝나는 경우 — 이전 타이머를 버리고 처음부터 다시 센다.
    clearTimers();
    setStage('settling');
    timersRef.current.push(
      setTimeout(() => setStage('confirming'), SETTLE_MS),
      setTimeout(() => setStage('idle'), SETTLE_MS + CONFIRM_MS),
    );
  }, []);

  return { stage, begin };
};

export default useScanCompletionTransition;
