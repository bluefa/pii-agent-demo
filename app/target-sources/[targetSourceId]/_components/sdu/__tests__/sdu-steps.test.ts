import { describe, expect, it } from 'vitest';
import { ProcessStatus } from '@/lib/types';
import {
  SDU_STEP_TITLES,
  sduStepOf,
  type SduStep,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';

/**
 * SDU rides the shared 7-step lattice and folds the steps it has no screen for
 * (docs/api/sdu-assumed-contracts.md — "What SDU is, in one paragraph").
 *
 * The folds are the claim worth pinning: 2·3 → 4 says SDU has no approval, and 5 → 6
 * says the admin's four runs are one sentence to the owner. If either one drifts, the
 * owner lands on a screen built for a different provider's process.
 */

describe('sduStepOf', () => {
  it('7단계 격자를 네 화면으로 접는다', () => {
    const folded: Record<ProcessStatus, SduStep> = {
      [ProcessStatus.WAITING_TARGET_CONFIRMATION]: 1,
      [ProcessStatus.WAITING_APPROVAL]: 4,
      [ProcessStatus.APPLYING_APPROVED]: 4,
      [ProcessStatus.INSTALLING]: 4,
      [ProcessStatus.WAITING_CONNECTION_TEST]: 6,
      [ProcessStatus.CONNECTION_VERIFIED]: 6,
      [ProcessStatus.INSTALLATION_COMPLETE]: 7,
    };

    for (const [status, step] of Object.entries(folded)) {
      expect(sduStepOf(Number(status) as ProcessStatus)).toBe(step);
    }
  });

  it('승인 두 단계는 업로드 화면으로 접힌다 — SDU 에는 승인 절차가 없다', () => {
    expect(sduStepOf(ProcessStatus.WAITING_APPROVAL)).toBe(4);
    expect(sduStepOf(ProcessStatus.APPLYING_APPROVED)).toBe(4);
  });

  it('연결 테스트 단계는 연동중 화면으로 접힌다 — 담당자가 할 일이 없는 구간이다', () => {
    expect(sduStepOf(ProcessStatus.WAITING_CONNECTION_TEST)).toBe(6);
    expect(sduStepOf(ProcessStatus.CONNECTION_VERIFIED)).toBe(6);
  });

  it('격자의 일곱 상태가 모두 화면을 갖는다 — 빠진 상태는 화면 없는 대상이 된다', () => {
    const statuses = Object.values(ProcessStatus).filter(
      (value): value is ProcessStatus => typeof value === 'number',
    );

    expect(statuses).toHaveLength(7);
    for (const status of statuses) {
      expect(SDU_STEP_TITLES[sduStepOf(status)]).toBeTruthy();
    }
  });
});

describe('SDU_STEP_TITLES', () => {
  it('네 화면의 이름이 모두 있다', () => {
    expect(SDU_STEP_TITLES).toEqual({
      1: '연동 대상 정의',
      4: '데이터 업로드',
      6: 'SDU 연동중',
      7: '완료',
    });
  });
});
