import { describe, expect, it } from 'vitest';
import {
  selectPhase,
  type Phase,
  type SelectPhaseInput,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/phase';

describe('selectPhase', () => {
  const cases: ReadonlyArray<[SelectPhaseInput, Phase]> = [
    [{ fetchStatus: 'loading', scanState: 'IN_PROGRESS', hasCandidates: true, completing: false, scanStale: false }, 'fetching'],
    [{ fetchStatus: 'error', scanState: 'IN_PROGRESS', hasCandidates: true, completing: false, scanStale: false }, 'fetchError'],
    [{ fetchStatus: 'ready', scanState: 'IN_PROGRESS', hasCandidates: true, completing: false, scanStale: false }, 'scanning'],
    [{ fetchStatus: 'ready', scanState: 'IN_PROGRESS', hasCandidates: false, completing: false, scanStale: false }, 'scanning'],
    [{ fetchStatus: 'ready', scanState: 'FAILED', hasCandidates: true, completing: false, scanStale: false }, 'scanFailed'],
    [{ fetchStatus: 'ready', scanState: 'EMPTY', hasCandidates: true, completing: false, scanStale: false }, 'list'],
    [{ fetchStatus: 'ready', scanState: 'SUCCESS', hasCandidates: true, completing: false, scanStale: false }, 'list'],
    [{ fetchStatus: 'ready', scanState: 'EMPTY', hasCandidates: false, completing: false, scanStale: false }, 'empty'],
    // 확인 프레임은 조회 상태를 이긴다 — 완료 직후의 refetch 가 loading 이어도
    // 스켈레톤이 아니라 프레임이 화면을 소유한다. 조회가 프레임보다 오래 걸리면
    // 프레임이 끝난 뒤에야 스켈레톤이 서고, 그때는 실제로 기다리는 중이 맞다.
    [{ fetchStatus: 'loading', scanState: 'SUCCESS', hasCandidates: false, completing: true, scanStale: false }, 'completing'],
    [{ fetchStatus: 'ready', scanState: 'SUCCESS', hasCandidates: true, completing: true, scanStale: false }, 'completing'],
    // 조회 실패도 프레임이 끝난 뒤에 알린다 — 완료 연출 중간에 에러가 끼어들지 않는다.
    [{ fetchStatus: 'error', scanState: 'SUCCESS', hasCandidates: false, completing: true, scanStale: false }, 'completing'],
    [{ fetchStatus: 'error', scanState: 'SUCCESS', hasCandidates: false, completing: false, scanStale: false }, 'fetchError'],
    // 확인 프레임 중에 새 스캔이 시작된 경우 — 프레임이 이긴다. 남은 dwell(최대
    // 1.6초)만큼 늦게 러닝 화면으로 넘어가지만, 프레임을 중간에 끊는 편이 더 튄다.
    [{ fetchStatus: 'ready', scanState: 'IN_PROGRESS', hasCandidates: false, completing: true, scanStale: false }, 'completing'],
    // 기한이 지난 결과는 목록을 이긴다 — 후보가 있어도 그 목록은 승인 요청의 입력이
    // 될 수 없으므로 본문에서 치운다.
    [{ fetchStatus: 'ready', scanState: 'SUCCESS', hasCandidates: true, completing: false, scanStale: true }, 'scanStale'],
    // 0건도 이긴다: 비어 있다는 사실보다 기한이 지났다는 사실이 지금 할 일을 말한다.
    [{ fetchStatus: 'ready', scanState: 'EMPTY', hasCandidates: false, completing: false, scanStale: true }, 'scanStale'],
    // 새 스캔이 도는 중이면 러닝 화면이 이긴다 — 낡은 결과는 곧 대체된다.
    [{ fetchStatus: 'ready', scanState: 'IN_PROGRESS', hasCandidates: true, completing: false, scanStale: true }, 'scanning'],
    // 실패도 먼저다: 방금 시도가 깨졌다는 것이 낡았다는 것보다 최신 사실이다.
    [{ fetchStatus: 'ready', scanState: 'FAILED', hasCandidates: true, completing: false, scanStale: true }, 'scanFailed'],
  ];

  it.each(cases)('returns %j -> %s', (input, expected) => {
    expect(selectPhase(input)).toBe(expected);
  });
});
