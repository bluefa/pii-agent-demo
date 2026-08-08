'use client';

import { useEffect, useState } from 'react';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { isInProgress } from '@/app/hooks/useTestConnectionPolling';

/**
 * 연결 테스트의 정착(SUCCESS/FAIL) 순간을 화면의 한 박자로 승격시킨다 — 스캔의
 * useScanCompletionTransition 과 같은 문법. 폴링은 마지막으로 본 값(예: 4/6 보고)에서
 * 끝나므로, 이 박자가 없으면 카드 색·문장·바가 한 프레임에 전부 뒤집히고 바가 끝까지
 * 차는 걸 아무도 보지 못한다.
 *
 * - `holding`(400ms): 최종 버킷을 든 채 running 프레임을 유지한다 — 바는 이 구간에
 *   최종 분할까지 굴러간다(세그먼트 transition 250ms 가 이 안에 끝나야 한다).
 * - `settledLive`: 이 화면에서 실행이 정착하는 걸 실제로 지켜봤다는 표시. 성공 체크
 *   드로우는 이때만 건다 — 마운트 시 발견한 예전 SUCCESS 잡(입양)에는 연출이 없다,
 *   스캔의 입양 규칙과 동일하다.
 */

const HOLD_MS = 400;

type Stage = 'idle' | 'holding' | 'revealed';

/** 관찰의 정체성 — 버전과 진행 여부만이 전이를 가른다. */
interface Seen {
  version: number | null;
  inProgress: boolean;
}

export interface UseTcSettleHoldReturn {
  /** 정착 직후 400ms — 표시 국면만 running 으로 붙잡는다(게이트는 실 상태를 쓴다). */
  holding: boolean;
  /** 라이브로 정착을 지켜본 뒤 — 체크 드로우의 유일한 트리거. */
  settledLive: boolean;
}

export const useTcSettleHold = (
  job: TestConnectionVersionResult | null,
): UseTcSettleHoldReturn => {
  const [stage, setStage] = useState<Stage>('idle');
  // undefined = 아직 아무것도 관찰하지 않음(첫 관찰은 무엇이든 입양).
  const [seen, setSeen] = useState<Seen | null | undefined>(undefined);

  const current: Seen | null = job
    ? {
        version: job.test_connection_version ?? null,
        inProgress: isInProgress(job.connection_status),
      }
    : null;

  // "previous props" 렌더 중 조정 패턴(ConnectionTestCard 의 seedCreds 와 동일) —
  // 에지 판정을 이펙트에 두면 동기 setState 가 되고, 콜백에 두면 폴링 훅 시그니처를
  // 바꿔야 한다. 렌더에서 직전 관찰과 비교하는 것이 가장 좁다.
  const changed =
    seen === undefined ||
    (current === null) !== (seen === null) ||
    (current !== null &&
      seen !== null &&
      (current.version !== seen.version || current.inProgress !== seen.inProgress));
  if (changed) {
    setSeen(current);
    if (seen === undefined) {
      // 첫 관찰은 입양 — 보기 전에 끝나 있던 실행에 연출을 재생하지 않는다.
    } else if (current && !current.inProgress && seen?.inProgress) {
      // 라이브 정착 에지: 지켜보던 실행(또는 그 후속 버전)이 방금 끝났다.
      setStage('holding');
    } else if (!current || current.inProgress) {
      // 새 실행 시작(또는 대상 전환으로 잡이 사라짐) — 연출 상태를 처음으로 되돌린다.
      setStage('idle');
    }
  }

  useEffect(() => {
    if (stage !== 'holding') return;
    const timer = setTimeout(() => setStage('revealed'), HOLD_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  return { holding: stage === 'holding', settledLive: stage === 'revealed' };
};

export default useTcSettleHold;
