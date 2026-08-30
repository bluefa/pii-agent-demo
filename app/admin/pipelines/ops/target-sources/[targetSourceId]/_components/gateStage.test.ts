/**
 * The gate must name the stage the target is ACTUALLY at, and it must survive a
 * status it has never seen. The default branch is the one worth pinning: an
 * unknown wire value has to land on 확정 정보 (correct for anything at or past
 * CONFIRMING), never on "someone is still choosing", which would tell an
 * operator to go wait on a step that already finished.
 */
import { describe, it, expect } from 'vitest';

import { gateStage } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';

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
