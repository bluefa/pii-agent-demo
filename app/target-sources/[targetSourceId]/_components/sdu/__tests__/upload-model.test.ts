import { describe, expect, it } from 'vitest';
import {
  currentGate,
  gateDoneStates,
  invalidationLines,
  recipientsSummary,
  regionAckSummary,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/model';
import type { SduUpload } from '@/lib/types/sdu';

const base: SduUpload = {
  submittedAt: '2026-08-24T05:41:00Z',
  regions: ['us', 'eu'],
  firewall: { rows: [], acked: false },
  accessKeyRecipients: { users: [], updatedAt: null },
  commands: { rows: [], acked: false },
  bdc: { status: 'NOT_STARTED', checkedAt: '2026-08-24T07:50:00Z', completedAt: null },
  invalidation: { addedRegions: [], uploadIpChanged: false },
};

describe('regionAckSummary', () => {
  it('names the regions the one answer was given for', () => {
    expect(regionAckSummary(['us', 'eu'], true)).toBe('확인함 · US · EU');
    expect(regionAckSummary(['us', 'eu'], false)).toBe('미확인 · US · EU');
  });

  it('says there is nothing to answer about rather than 미확인', () => {
    expect(regionAckSummary([], false)).toBe('연동 대상이 없어요');
  });
});

describe('recipientsSummary', () => {
  const user = (name: string, id: string) => ({ id, name, email: `${id}@bdc.com` });

  it('carries a name so "누구 앞으로 갔더라" is not asked again', () => {
    expect(recipientsSummary([user('박지원', 'u3'), user('최민수', 'u4'), user('이서연', 'u5')])).toBe(
      '3명 등록함 · 박지원 외 2명',
    );
    expect(recipientsSummary([user('박지원', 'u3')])).toBe('1명 등록함 · 박지원');
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
      commands: { rows: [], acked: true },
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
    expect(invalidationLines(base.invalidation)).toEqual([]);
  });
});
