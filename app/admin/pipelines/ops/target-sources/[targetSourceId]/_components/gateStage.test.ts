/**
 * The gate must name the stage the target is ACTUALLY at, and it must survive a
 * status it has never seen. The default branch is the one worth pinning: an
 * unknown wire value has to land on 확정 정보 (correct for anything at or past
 * CONFIRMING), never on "someone is still choosing", which would tell an
 * operator to go wait on a step that already finished.
 */
import { describe, it, expect } from 'vitest';

import { pipelineTypeGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';

describe('pipelineTypeGate', () => {
  const OTHERS: ReadonlyArray<ProcessStatus> = [
    'IDLE',
    'PENDING',
    'CONFIRMED',
    'INSTALLED',
    'CONNECTED',
    'COMPLETED',
  ];

  it('CONFIRMING + 확정 인프라 있음 — 설치가 이유를 달고 막힌다', () => {
    const gate = pipelineTypeGate('CONFIRMING', true);

    expect(gate.installBlocked).toBe('확정 정보를 다시 입력해야 합니다. 재확정을 먼저 실행하세요.');
  });

  it('CONFIRMED 에서는 설치가 그대로 열려 있다', () => {
    const gate = pipelineTypeGate('CONFIRMED', true);

    expect(gate.installBlocked).toBeNull();
  });

  it('CONFIRMING 이라도 확정 인프라가 없으면 설치를 막지 않는다 — 지울 확정이 없다', () => {
    const gate = pipelineTypeGate('CONFIRMING', false);

    expect(gate.installBlocked).toBeNull();
  });

  /**
   * null 은 「없다」가 아니라 「terraform-status 를 아직 못 읽었다」 — 못 읽은 것을 근거로
   * 설치를 막지 않는다(`startGate` 와 같은 규칙).
   */
  it('확정 인프라를 못 읽었으면 아무것도 바꾸지 않는다', () => {
    const gate = pipelineTypeGate('CONFIRMING', null);

    expect(gate.installBlocked).toBeNull();
  });

  it.each(OTHERS)('%s 에서는 확정 인프라가 있어도 설치가 막히지 않는다', (status) => {
    const gate = pipelineTypeGate(status, true);

    expect(gate.installBlocked).toBeNull();
  });

  it('상태를 못 읽은 대상(null)도 기본 갈래로 떨어진다', () => {
    const gate = pipelineTypeGate(null, true);

    expect(gate.installBlocked).toBeNull();
  });
});
