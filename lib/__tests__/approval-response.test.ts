import { describe, expect, it } from 'vitest';
import { camelCaseKeys } from '@/lib/object-case';
import {
  normalizeApprovalRequestSummary,
  normalizeApprovalActionResponse,
  normalizeApprovalRequestLatest,
  normalizeApprovalHistoryPage,
  normalizeApprovalUnavailableResponse,
  normalizeApprovalUnavailableConfirmResponse,
} from '@/lib/approval-response';

// Inputs are the camelCased payloads (what the route passes after camelCaseKeys).
describe('approval-response normalizers', () => {
  describe('normalizeApprovalRequestSummary', () => {
    it('maps a full ApprovalRequestSummaryDto (camel) to the domain shape', () => {
      const wire = {
        id: 1024,
        target_source_id: 42,
        status: 'PENDING',
        requested_by: { user_id: 'alice@corp' },
        requested_at: '2026-06-23T04:10:00Z',
        resource_total_count: 5,
        resource_selected_count: 3,
      };
      expect(normalizeApprovalRequestSummary(camelCaseKeys(wire))).toEqual({
        id: 1024,
        targetSourceId: 42,
        status: 'PENDING',
        requestedBy: { userId: 'alice@corp' },
        requestedAt: '2026-06-23T04:10:00Z',
        resourceTotalCount: 5,
        resourceSelectedCount: 3,
      });
    });

    it('degrades unknown status to PENDING and missing actor to null', () => {
      const result = normalizeApprovalRequestSummary({ status: 'WAT', requestedBy: {} });
      expect(result.status).toBe('PENDING');
      expect(result.requestedBy).toBeNull();
      expect(result.id).toBe(0);
    });

    it('keeps UNAVAILABLE_ACKNOWLEDGED (swagger 7-value enum)', () => {
      expect(
        normalizeApprovalRequestSummary({ status: 'UNAVAILABLE_ACKNOWLEDGED' }).status,
      ).toBe('UNAVAILABLE_ACKNOWLEDGED');
    });
  });

  describe('normalizeApprovalActionResponse', () => {
    it('maps a rejected ApprovalActionResponseDto with reviewer + reason', () => {
      const wire = {
        request_id: 1024,
        status: 'REJECTED',
        processed_by: { user_id: 'admin@corp' },
        processed_at: '2026-06-23T05:01:00Z',
        reason: 'RDS_CLUSTER 미지원',
      };
      expect(normalizeApprovalActionResponse(camelCaseKeys(wire))).toEqual({
        requestId: 1024,
        status: 'REJECTED',
        processedBy: { userId: 'admin@corp' },
        processedAt: '2026-06-23T05:01:00Z',
        reason: 'RDS_CLUSTER 미지원',
      });
    });

    it('coerces null reason to empty string', () => {
      expect(normalizeApprovalActionResponse({ reason: null }).reason).toBe('');
    });
  });

  describe('normalizeApprovalRequestLatest', () => {
    it('maps request/resources/result and defaults resources to []', () => {
      const wire = {
        request: { id: 1, target_source_id: 42, status: 'REJECTED' },
        result: { request_id: 1, status: 'REJECTED', reason: 'nope' },
      };
      const result = normalizeApprovalRequestLatest(camelCaseKeys(wire));
      expect(result.request?.status).toBe('REJECTED');
      expect(result.result?.reason).toBe('nope');
      expect(result.resources).toEqual([]);
    });

    it('returns null request/result when absent', () => {
      const result = normalizeApprovalRequestLatest({});
      expect(result.request).toBeNull();
      expect(result.result).toBeNull();
      expect(result.resources).toEqual([]);
    });

    it('passes resources[] through opaquely', () => {
      const result = normalizeApprovalRequestLatest({ resources: [{ a: 1 }] });
      expect(result.resources).toEqual([{ a: 1 }]);
    });
  });

  describe('normalizeApprovalHistoryPage', () => {
    it('maps flat Page meta + content items', () => {
      const wire = {
        totalPages: 1,
        totalElements: 2,
        number: 0,
        size: 10,
        content: [
          {
            request: { id: 1024, target_source_id: 42, status: 'REJECTED' },
            result: { request_id: 1024, status: 'REJECTED', reason: 'x' },
          },
          { request: { id: 1025, target_source_id: 42, status: 'PENDING' } },
        ],
      };
      const page = normalizeApprovalHistoryPage(camelCaseKeys(wire));
      expect(page.totalElements).toBe(2);
      expect(page.content).toHaveLength(2);
      expect(page.content[0].result?.status).toBe('REJECTED');
      expect(page.content[1].result).toBeNull();
    });

    it('returns empty content for a non-object payload', () => {
      expect(normalizeApprovalHistoryPage(null).content).toEqual([]);
    });
  });

  describe('normalizeApprovalUnavailableResponse', () => {
    it('maps ApprovalUnavailableResponseDto with UNAVAILABLE status', () => {
      const wire = {
        request_id: 1024,
        status: 'UNAVAILABLE',
        processed_by: { user_id: 'admin@corp' },
        processed_at: '2026-06-23T07:00:00Z',
        reason: '방화벽 정책상 연동 불가',
      };
      expect(normalizeApprovalUnavailableResponse(camelCaseKeys(wire))).toEqual({
        requestId: 1024,
        status: 'UNAVAILABLE',
        processedBy: { userId: 'admin@corp' },
        processedAt: '2026-06-23T07:00:00Z',
        reason: '방화벽 정책상 연동 불가',
      });
    });
  });

  describe('normalizeApprovalUnavailableConfirmResponse', () => {
    it('maps ApprovalUnavailableConfirmResponseDto (confirm_status + bare confirmed_by string)', () => {
      const wire = {
        target_source_id: 42,
        confirm_status: 'IDLE',
        processed_at: '2026-06-23T07:10:00Z',
        confirmed_by: 'alice@corp',
      };
      expect(normalizeApprovalUnavailableConfirmResponse(camelCaseKeys(wire))).toEqual({
        targetSourceId: 42,
        confirmStatus: 'IDLE',
        processedAt: '2026-06-23T07:10:00Z',
        confirmedBy: 'alice@corp',
      });
    });

    it('degrades unknown confirm_status to IDLE', () => {
      expect(
        normalizeApprovalUnavailableConfirmResponse({ confirmStatus: 'WAT' }).confirmStatus,
      ).toBe('IDLE');
    });
  });
});
