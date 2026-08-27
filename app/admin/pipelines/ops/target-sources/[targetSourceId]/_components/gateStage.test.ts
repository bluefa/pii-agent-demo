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
    const gate = gateStage('IDLE', 1029);

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
    const gate = gateStage('PENDING', 1029);

    expect(gate.sentence).toBe('연동 요청이 승인을 기다립니다. 승인·확정 후 작업 시작이 열립니다.');
    expect(gate.action).toEqual({ kind: 'tab', tab: '관리자 승인', label: '관리자 승인 탭으로' });
  });

  it('every other status falls back to 확정 정보', () => {
    for (const status of ['CONFIRMING', 'CONFIRMED', 'INSTALLED', 'CONNECTED', 'COMPLETED'] as const) {
      const gate = gateStage(status, 1029);
      expect(gate.sentence).toBe(
        '아직 확정된 연동 정보가 없습니다. 확정 정보 탭에서 확정하면 작업 시작이 열립니다.',
      );
      expect(gate.action).toEqual({ kind: 'tab', tab: '확정 정보', label: '확정 정보 탭으로' });
    }
  });

  it('a null status takes the same safe default, not the IDLE sentence', () => {
    // null = the process-status lookup failed. Guessing "담당자가 고르는 중"
    // would invent a fact; 확정 정보 is the tab that answers the gate either way.
    const gate = gateStage(null, 1029);

    expect(gate.sentence).toMatch(/^아직 확정된 연동 정보가 없습니다/);
    expect(gate.action).toEqual({ kind: 'tab', tab: '확정 정보', label: '확정 정보 탭으로' });
  });
});
