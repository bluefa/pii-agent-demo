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
  firewall: { rows: [], ackedRegions: [] },
  recipients: { users: [], updatedAt: null },
  commands: { rows: [], ackedRegions: [] },
  bdc: { status: 'NOT_STARTED', checkedAt: '2026-08-24T07:50:00Z', completedAt: null },
  invalidation: { addedRegions: [], removedRegions: [], uploadIpChanged: false },
};

describe('regionAckSummary', () => {
  it('lists the regions once every one of them is answered', () => {
    expect(regionAckSummary(['us', 'eu'], ['us', 'eu'])).toBe('확인함 · US · EU');
  });

  it('names what is missing, not just how much', () => {
    expect(regionAckSummary(['us', 'eu'], ['us'])).toBe('US 확인함 · EU 미확인 · 1곳 남음');
    expect(regionAckSummary(['us', 'eu'], [])).toBe('US · EU 미확인 · 2곳 남음');
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
      firewall: { ...base.firewall, ackedRegions: ['us', 'eu'] },
      recipients: { users: [{ id: 'u3', name: '박지원', email: 'a@bdc.com' }], updatedAt: null },
    };
    expect(currentGate(upload, gateDoneStates(upload))).toBe('commands');
  });

  it('does not make BDC current before BDC has started', () => {
    const upload: SduUpload = {
      ...base,
      firewall: { ...base.firewall, ackedRegions: ['us', 'eu'] },
      recipients: { users: [{ id: 'u3', name: '박지원', email: 'a@bdc.com' }], updatedAt: null },
      commands: { rows: [], ackedRegions: ['us', 'eu'] },
    };
    expect(currentGate(upload, gateDoneStates(upload))).toBeNull();
    expect(currentGate({ ...upload, bdc: { ...base.bdc, status: 'IN_PROGRESS' } }, gateDoneStates(upload))).toBe(
      'bdc',
    );
  });

  it('treats a definition with no region as unanswerable rather than done', () => {
    const upload: SduUpload = { ...base, regions: [], firewall: { ...base.firewall, ackedRegions: [] } };
    expect(gateDoneStates(upload).firewall).toBe(false);
  });
});

describe('invalidationLines', () => {
  it('says nothing while nothing has been invalidated', () => {
    expect(invalidationLines(base.invalidation)).toEqual([]);
  });
});
