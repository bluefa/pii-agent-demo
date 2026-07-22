/**
 * 전체 History 확인 — the /approval-history wire is flat camelCase keyed by
 * historyRecordId (the ONLY unique id; targetSourceId/requestId repeat), with the
 * acting admin in actorId.
 */
import { describe, it, expect } from 'vitest';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';
import { toApprovalHistoryRow, type ApprovalHistoryItemWire } from '@/lib/types/task-queue';

describe('approval history wire — historyRecordId unique, actorId present', () => {
  it('rows key on unique historyRecordId while targetSourceId repeats', async () => {
    const res = await mockTaskQueue.getApprovalHistory({ page: 0, size: 100 });
    const body = await res.json();
    const rows = body.content as Array<{
      historyRecordId: number;
      targetSourceId: number;
      requestId: number;
      actorId: string | null;
      serviceName: string;
      cloudProvider: string;
    }>;

    const ids = rows.map((r) => r.historyRecordId);
    expect(new Set(ids).size).toBe(ids.length); // all unique

    // targetSourceId 1031 spans 3 records — repeats, so it can't be the key.
    const ts1031 = rows.filter((r) => r.targetSourceId === 1031);
    expect(ts1031.length).toBe(3);
    // cloudProvider is consistent per target source (one cloud per target).
    expect(new Set(ts1031.map((r) => r.cloudProvider))).toEqual(new Set(['IDC']));

    // camelCase flat fields carried through; actorId present on processed rows.
    for (const r of rows) {
      expect(typeof r.serviceName).toBe('string');
      expect(typeof r.requestId).toBe('number');
    }
    expect(rows.some((r) => r.actorId === '관리자')).toBe(true);
    expect(rows.some((r) => r.actorId === '시스템')).toBe(true); // AUTO_APPROVED
  });

  it('toStatuses filters', async () => {
    const res = await mockTaskQueue.getApprovalHistory({ page: 0, size: 100, toStatuses: ['REJECTED'] });
    const body = await res.json();
    expect((body.content as Array<{ status: string }>).every((r) => r.status === 'REJECTED')).toBe(true);
  });

  it('toApprovalHistoryRow maps the camel wire incl. historyRecordId + actorId', () => {
    const wire: ApprovalHistoryItemWire = {
      historyRecordId: 86,
      requestId: 34,
      targetSourceId: 19,
      status: 'APPROVED',
      createdAt: '2026-07-20T11:04:42Z',
      serviceName: '주문서비스',
      serviceCode: 'ORD',
      actorId: 'admin',
      cloudProvider: 'AWS',
    };
    expect(toApprovalHistoryRow(wire)).toEqual({
      historyRecordId: 86,
      requestId: 34,
      targetSourceId: 19,
      status: 'APPROVED',
      createdAt: '2026-07-20T11:04:42Z',
      serviceName: '주문서비스',
      serviceCode: 'ORD',
      actorId: 'admin',
      cloudProvider: 'AWS',
    });
  });
});
