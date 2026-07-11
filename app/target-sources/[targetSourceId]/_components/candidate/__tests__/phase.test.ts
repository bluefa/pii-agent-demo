import { describe, expect, it } from 'vitest';
import { selectPhase, type Phase, type SelectPhaseInput } from '../phase';

describe('selectPhase', () => {
  const cases: ReadonlyArray<[SelectPhaseInput, Phase]> = [
    [{ fetchStatus: 'loading', scanState: 'IN_PROGRESS', hasCandidates: true }, 'fetching'],
    [{ fetchStatus: 'error', scanState: 'IN_PROGRESS', hasCandidates: true }, 'fetchError'],
    [{ fetchStatus: 'ready', scanState: 'IN_PROGRESS', hasCandidates: true }, 'scanning'],
    [{ fetchStatus: 'ready', scanState: 'IN_PROGRESS', hasCandidates: false }, 'scanning'],
    [{ fetchStatus: 'ready', scanState: 'FAILED', hasCandidates: true }, 'scanFailed'],
    [{ fetchStatus: 'ready', scanState: 'EMPTY', hasCandidates: true }, 'list'],
    [{ fetchStatus: 'ready', scanState: 'SUCCESS', hasCandidates: true }, 'list'],
    [{ fetchStatus: 'ready', scanState: 'EMPTY', hasCandidates: false }, 'empty'],
  ];

  it.each(cases)('returns %j -> %s', (input, expected) => {
    expect(selectPhase(input)).toBe(expected);
  });
});
