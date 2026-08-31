import { describe, expect, it } from 'vitest';
import {
  answerOf,
  currentGate,
  gateDoneStates,
  invalidationLines,
  recipientsSummary,
  regionAckSummary,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/model';
import { SDU_COPY } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import { sduAckAnswer, type SduUpload } from '@/lib/types/sdu';

/** Korean, so every sentence asserted below is the one this step rendered before it had a second language. */
const t = SDU_COPY.ko.upload;

const base: SduUpload = {
  submittedAt: '2026-08-24T05:41:00Z',
  regions: ['us', 'eu'],
  firewall: { rows: [], acked: false, ackedAt: null, ackedBy: null },
  accessKeyRecipients: { users: [], updatedAt: null },
  commands: { rows: [], acked: false, ackedAt: null, ackedBy: null },
  bdc: { status: 'NOT_STARTED', checkedAt: '2026-08-24T07:50:00Z', completedAt: null, completedBy: null },
  invalidation: { addedRegions: [], uploadIpChanged: false },
};

describe('regionAckSummary', () => {
  it('names the regions the one answer was given for', () => {
    expect(regionAckSummary(t, ['us', 'eu'], true)).toBe('확인함 · US · EU');
    expect(regionAckSummary(t, ['us', 'eu'], false)).toBe('미확인 · US · EU');
  });

  it('says there is nothing to answer about rather than 미확인', () => {
    expect(regionAckSummary(t, [], false)).toBe('연동 대상이 없어요');
  });
});

describe('recipientsSummary', () => {
  const user = (name: string, id: string) => ({ id, name, email: `${id}@bdc.com` });

  it('carries a name so "누구 앞으로 갔더라" is not asked again', () => {
    expect(recipientsSummary(t, [user('박지원', 'u3'), user('최민수', 'u4'), user('이서연', 'u5')])).toBe(
      '3명 등록함 · 박지원 외 2명',
    );
    expect(recipientsSummary(t, [user('박지원', 'u3')])).toBe('1명 등록함 · 박지원');
  });
});

describe('currentGate', () => {
  it('walks the chain in causal order', () => {
    const upload: SduUpload = {
      ...base,
      firewall: { ...base.firewall, acked: true },
      accessKeyRecipients: { users: [{ id: 'u3', name: '박지원', email: 'a@bdc.com' }], updatedAt: null },
    };
    expect(currentGate(upload, gateDoneStates(upload))).toBe('commands');
  });

  it('does not make BDC current before BDC has started', () => {
    const upload: SduUpload = {
      ...base,
      firewall: { ...base.firewall, acked: true },
      accessKeyRecipients: { users: [{ id: 'u3', name: '박지원', email: 'a@bdc.com' }], updatedAt: null },
      commands: { rows: [], acked: true, ackedAt: '2026-08-25T10:40:00Z', ackedBy: null },
    };
    expect(currentGate(upload, gateDoneStates(upload))).toBeNull();
    expect(currentGate({ ...upload, bdc: { ...base.bdc, status: 'IN_PROGRESS' } }, gateDoneStates(upload))).toBe(
      'bdc',
    );
  });

  it('treats a definition with no region as unanswerable rather than done', () => {
    // 답이 하나뿐이라도 「예」가 무엇에 대한 예인지는 있어야 한다 — Region 이 없으면 없는
    // 것에 대해 답한 셈이라 게이트가 열려서는 안 된다.
    const upload: SduUpload = { ...base, regions: [], firewall: { ...base.firewall, acked: true } };
    expect(gateDoneStates(upload).firewall).toBe(false);
  });
});

describe('invalidationLines', () => {
  it('says nothing while nothing has been invalidated', () => {
    expect(invalidationLines(t, base.invalidation)).toEqual([]);
  });
});

describe('answerOf — 저장된 아니오는 미답이 아니다', () => {
  it('acked=false 라도 도장이 있으면 「아니오」다', () => {
    // 이 구별이 없으면 새로고침한 담당자는 자기가 답한 적 없다고 읽는다.
    expect(answerOf({ acked: false, ackedAt: '2026-08-25T10:40:00Z' })).toBe(false);
  });

  it('도장이 없으면 미답이다 — 무효화가 도장을 지운 뒤가 그 상태다', () => {
    expect(answerOf({ acked: false, ackedAt: null })).toBeNull();
  });

  it('acked=true 는 도장과 무관하게 「예」다', () => {
    expect(answerOf({ acked: true, ackedAt: null })).toBe(true);
  });

  /**
   * 규칙은 **한 벌**이다. 담당자 2단계 블록·운영 콘솔의 「담당자 입력 정보」·승인 조건 ①
   * 이 같은 §5 규칙을 읽는데, 손으로 옮겨 적으면 갈라지고 갈라지는 지점이 정확히 위 세
   * 케이스가 막으려는 버그다. 이 화면의 이름(`answerOf`)은 그 공유본을 가리키기만 한다.
   */
  it('이 화면의 answerOf 는 공유 판정 그 자체다 — 두 번째 사본이 아니다', () => {
    expect(answerOf).toBe(sduAckAnswer);
  });
});
