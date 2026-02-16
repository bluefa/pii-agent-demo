import { describe, it, expect } from 'vitest';
import { evaluateAutoApproval, AutoApprovalContext } from '@/lib/policies';
import { Resource } from '@/lib/types';

const createResource = (id: string, hasExclusion: boolean = false): Resource => ({
  id,
  type: 'RDS',
  resourceId: `rds-${id}`,
  databaseType: 'MYSQL',
  connectionStatus: 'PENDING',
  isSelected: false,
  integrationCategory: 'TARGET',
  exclusion: hasExclusion
    ? {
        reason: '제외 사유',
        excludedAt: '2026-01-15T10:00:00Z',
        excludedBy: { id: 'admin-1', name: '관리자' },
      }
    : undefined,
});

describe('AutoApprovalPolicy', () => {
  describe('evaluateAutoApproval', () => {
    it('모든 리소스 선택 시 자동 승인', () => {
      const context: AutoApprovalContext = {
        resources: [
          createResource('res-1'),
          createResource('res-2'),
        ],
        selectedResourceIds: ['res-1', 'res-2'],
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(true);
      expect(result.reason).toBe('AUTO_APPROVED');
    });

    it('제외된 리소스를 선택해도 자동 승인 가능', () => {
      const context: AutoApprovalContext = {
        resources: [
          createResource('res-1'),
          createResource('res-2', true), // 제외된 리소스
        ],
        selectedResourceIds: ['res-1', 'res-2'], // 제외된 리소스도 선택
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(true);
      expect(result.reason).toBe('AUTO_APPROVED');
    });

    it('제외되지 않은 리소스 중 선택 안 된 것이 있으면 수동 승인 필요', () => {
      const context: AutoApprovalContext = {
        resources: [
          createResource('res-1'),
          createResource('res-2'),
          createResource('res-3', true), // 제외된 리소스
        ],
        selectedResourceIds: ['res-1'], // res-2가 선택 안 됨
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(false);
      expect(result.reason).toBe('NON_EXCLUDED_NOT_SELECTED');
    });

    it('제외된 리소스 외 모두 선택하면 자동 승인', () => {
      const context: AutoApprovalContext = {
        resources: [
          createResource('res-1'),
          createResource('res-2'),
          createResource('res-3', true), // 제외된 리소스
        ],
        selectedResourceIds: ['res-1', 'res-2'], // 제외된 것만 빼고 모두 선택
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(true);
      expect(result.reason).toBe('AUTO_APPROVED');
    });

    it('문서 예시 1: 신규 리소스 추가 시 자동 승인', () => {
      // [기존 상태]
      // - 리소스 A: 연동됨 (connected)
      // - 리소스 B: 연동 제외
      // - 리소스 C: 신규 발견
      const context: AutoApprovalContext = {
        resources: [
          { ...createResource('res-A'), isSelected: true },
          createResource('res-B', true), // 제외됨
          createResource('res-C'), // 신규
        ],
        selectedResourceIds: ['res-A', 'res-C'], // B 제외, A와 C 선택
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(true);
      expect(result.reason).toBe('AUTO_APPROVED');
    });

    it('문서 예시 2: 최초 연동 전체 선택 시 자동 승인', () => {
      // [기존 상태]
      // - 리소스 A: 신규 발견 (DISCOVERED)
      // - 리소스 B: 신규 발견 (DISCOVERED)
      const context: AutoApprovalContext = {
        resources: [
          createResource('res-A'),
          createResource('res-B'),
        ],
        selectedResourceIds: ['res-A', 'res-B'], // 모두 선택
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(true);
      expect(result.reason).toBe('AUTO_APPROVED');
    });

    it('여러 개의 제외 리소스가 있어도 정상 동작', () => {
      const context: AutoApprovalContext = {
        resources: [
          createResource('res-1'),
          createResource('res-2', true), // 제외됨
          createResource('res-3', true), // 제외됨
          createResource('res-4'),
        ],
        selectedResourceIds: ['res-1', 'res-4'], // 제외된 것들 빼고 모두 선택
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(true);
      expect(result.reason).toBe('AUTO_APPROVED');
    });

    it('미선택 리소스가 모두 제외 확정된 경우 자동 승인', () => {
      const context: AutoApprovalContext = {
        resources: [
          createResource('res-1'),
          createResource('res-2', true), // 제외됨
          createResource('res-3', true), // 제외됨
        ],
        selectedResourceIds: ['res-1'], // res-2, res-3은 이미 제외됨
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(true);
      expect(result.reason).toBe('AUTO_APPROVED');
    });

    it('미선택 리소스 중 하나라도 제외 확정 안 되면 수동 승인', () => {
      const context: AutoApprovalContext = {
        resources: [
          createResource('res-1'),
          createResource('res-2', true), // 제외됨
          createResource('res-3'), // 제외 안 됨
        ],
        selectedResourceIds: ['res-1'], // res-3이 제외 안 되었는데 미선택
      };

      const result = evaluateAutoApproval(context);

      expect(result.shouldAutoApprove).toBe(false);
      expect(result.reason).toBe('NON_EXCLUDED_NOT_SELECTED');
    });
  });
});
