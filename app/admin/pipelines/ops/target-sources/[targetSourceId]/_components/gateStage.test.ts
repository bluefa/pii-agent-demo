/**
 * The gate must name the stage the target is ACTUALLY at, and it must survive a
 * status it has never seen. The default branch is the one worth pinning: an
 * unknown wire value has to land on 확정 정보 (correct for anything at or past
 * CONFIRMING), never on "someone is still choosing", which would tell an
 * operator to go wait on a step that already finished.
 */
import { describe, it, expect } from 'vitest';

import {
  gateStage,
  pipelineTypeGate,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';

describe('gateStage', () => {
  it('IDLE sends the operator to the screen the service owner works in', () => {
    const gate = gateStage('IDLE', 1029, false);

    expect(gate.sentence).toBe(
      '담당자가 연동 대상을 고르는 중입니다. 확정되면 여기서 작업 시작이 열립니다.',
    );
    expect(gate.action).toEqual({
      kind: 'href',
      href: '/target-sources/1029',
      label: '서비스 담당자가 보는 화면',
    });
  });

  it('PENDING points at the approval tab, because approval is what is missing', () => {
    const gate = gateStage('PENDING', 1029, false);

    expect(gate.sentence).toBe('연동 요청이 승인을 기다립니다. 승인·확정 후 작업 시작이 열립니다.');
    expect(gate.action).toEqual({ kind: 'tab', tab: '관리자 승인', label: '관리자 승인 탭으로' });
  });

  it('every other status falls back to 확정 정보', () => {
    for (const status of ['CONFIRMING', 'CONFIRMED', 'INSTALLED', 'CONNECTED', 'COMPLETED'] as const) {
      const gate = gateStage(status, 1029, false);
      expect(gate.sentence).toBe(
        '아직 확정된 연동 정보가 없습니다. 확정 정보 탭에서 확정하면 작업 시작이 열립니다.',
      );
      expect(gate.action).toEqual({ kind: 'tab', tab: '확정 정보', label: '확정 정보 탭으로' });
    }
  });

  /**
   * SDU 의 마지막 갈래. 다른 대상에서 이 문장은 관리자가 확정 정보 탭에서 직접 확정하라는
   * **지시**인데, SDU 에는 그 쓰기 경로가 계약에 없어 그 탭이 읽기 전용이다 — 보내 봐야
   * 누를 것이 없다. 그래서 문장은 기다림만 말하고, 옆에 설 버튼도 없다.
   */
  it('SDU 의 확정 대기는 지시하지 않고, 갈 곳도 주지 않는다', () => {
    for (const status of ['CONFIRMED', 'INSTALLED', null] as const) {
      const gate = gateStage(status, 1029, true);
      expect(gate.sentence).toBe(
        '아직 확정된 연동 정보가 없습니다. 확정되면 여기서 작업 시작이 열립니다.',
      );
      // 누를 것이 없는 탭으로 보내는 버튼은 버튼이 없는 것보다 나쁘다.
      expect(gate.action).toBeUndefined();
      expect(gate.sentence).not.toContain('확정 정보 탭');
    }
  });

  it('SDU 라도 1단계는 그대로 담당자 화면을 가리킨다', () => {
    // 1단계는 SDU 에서도 담당자가 대상을 정하는 자리다(계약 §3) — 이 갈래는 참 그대로다.
    const gate = gateStage('IDLE', 1029, true);
    expect(gate.action).toEqual({
      kind: 'href',
      href: '/target-sources/1029',
      label: '서비스 담당자가 보는 화면',
    });
  });

  it('a null status takes the same safe default, not the IDLE sentence', () => {
    // null = the process-status lookup failed. Guessing "담당자가 고르는 중"
    // would invent a fact; 확정 정보 is the tab that answers the gate either way.
    const gate = gateStage(null, 1029, false);

    expect(gate.sentence).toMatch(/^아직 확정된 연동 정보가 없습니다/);
    expect(gate.action).toEqual({ kind: 'tab', tab: '확정 정보', label: '확정 정보 탭으로' });
  });
});

/**
 * 재확정 행은 **한 조합**에서만 산다: 3단계(CONFIRMING)에 확정된 인프라가 이미 있는 대상.
 * 그 자리에서는 설치를 다시 돌려도 지난 확정을 바꾸지 못하므로(ADR-023) 설치가 막히고
 * 재확정이 열린다. 그 밖에서는 행을 그리지 않는다 — 비활성 행은 「지금은 못 한다」로
 * 읽히지만 실제로는 이 대상에서 할 일이 아니다.
 */
describe('pipelineTypeGate', () => {
  const OTHERS: ReadonlyArray<ProcessStatus> = [
    'IDLE',
    'PENDING',
    'CONFIRMED',
    'INSTALLED',
    'CONNECTED',
    'COMPLETED',
  ];

  it('CONFIRMING + 확정 인프라 있음 — 재확정이 열리고 설치가 막힌다', () => {
    const gate = pipelineTypeGate('CONFIRMING', true);

    expect(gate.reconfirm).toBe(true);
    expect(gate.installBlocked).toBe('확정 정보를 다시 입력해야 합니다. 재확정을 먼저 실행하세요.');
  });

  it('CONFIRMED 에는 재확정 행이 아예 없고, 설치는 그대로 열려 있다', () => {
    const gate = pipelineTypeGate('CONFIRMED', true);

    expect(gate.reconfirm).toBe(false);
    expect(gate.installBlocked).toBeNull();
  });

  it('CONFIRMING 이라도 확정 인프라가 없으면 재확정은 없다 — 지울 확정이 없다', () => {
    const gate = pipelineTypeGate('CONFIRMING', false);

    expect(gate.reconfirm).toBe(false);
    expect(gate.installBlocked).toBeNull();
  });

  /**
   * null 은 「없다」가 아니라 「terraform-status 를 아직 못 읽었다」 — 못 읽은 것을 근거로
   * 행을 지우지도, 설치를 막지도 않는다(`startGate` 와 같은 규칙).
   */
  it('확정 인프라를 못 읽었으면 아무것도 바꾸지 않는다', () => {
    const gate = pipelineTypeGate('CONFIRMING', null);

    expect(gate.reconfirm).toBe(false);
    expect(gate.installBlocked).toBeNull();
  });

  it.each(OTHERS)('%s 에서는 확정 인프라가 있어도 재확정 행이 없다', (status) => {
    const gate = pipelineTypeGate(status, true);

    expect(gate.reconfirm).toBe(false);
    expect(gate.installBlocked).toBeNull();
  });

  it('상태를 못 읽은 대상(null)도 기본 갈래로 떨어진다', () => {
    const gate = pipelineTypeGate(null, true);

    expect(gate.reconfirm).toBe(false);
    expect(gate.installBlocked).toBeNull();
  });
});
