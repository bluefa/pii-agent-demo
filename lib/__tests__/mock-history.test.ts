import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProjectHistory,
  addProjectHistory,
  addTargetConfirmedHistory,
  addAutoApprovedHistory,
  addApprovalHistory,
  addRejectionHistory,
  addDecommissionRequestHistory,
  addDecommissionApprovedHistory,
  addDecommissionRejectedHistory,
} from '@/lib/mock-history';
import { getStore } from '@/lib/mock-store';

// Store 초기화
const resetStore = () => {
  const store = getStore();
  store.projectHistory = [];
};

const testActor = { id: 'user-1', name: 'Test User' };
const testTargetSourceId = 1001;
const otherTargetSourceId = 2002;

describe('mock-history', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addProjectHistory', () => {
    it('히스토리 항목을 생성하고 저장한다', () => {
      const history = addProjectHistory({
        targetSourceId: testTargetSourceId,
        type: 'APPROVAL',
        actor: testActor,
      });

      expect(history.id).toBeDefined();
      expect(history.targetSourceId).toBe(testTargetSourceId);
      expect(history.type).toBe('APPROVAL');
      expect(history.actor).toEqual(testActor);
      expect(history.timestamp).toBeDefined();

      const store = getStore();
      expect(store.projectHistory).toHaveLength(1);
    });

    it('details를 포함하여 저장한다', () => {
      const history = addProjectHistory({
        targetSourceId: testTargetSourceId,
        type: 'REJECTION',
        actor: testActor,
        details: { reason: '테스트 반려 사유' },
      });

      expect(history.details.reason).toBe('테스트 반려 사유');
    });
  });

  describe('convenience functions', () => {
    it('addTargetConfirmedHistory: 연동 확정 이력을 생성한다', () => {
      const history = addTargetConfirmedHistory(testTargetSourceId, testActor, 5, 2);

      expect(history.type).toBe('TARGET_CONFIRMED');
      expect(history.targetSourceId).toBe(testTargetSourceId);
      expect(history.details.resourceCount).toBe(5);
      expect(history.details.excludedResourceCount).toBe(2);
    });

    it('addAutoApprovedHistory: 자동 승인 이력을 생성한다', () => {
      const history = addAutoApprovedHistory(testTargetSourceId);

      expect(history.type).toBe('AUTO_APPROVED');
      expect(history.actor.id).toBe('system');
      expect(history.actor.name).toBe('시스템');
    });

    it('addApprovalHistory: 승인 이력을 생성한다', () => {
      const history = addApprovalHistory(testTargetSourceId, testActor);

      expect(history.type).toBe('APPROVAL');
      expect(history.targetSourceId).toBe(testTargetSourceId);
    });

    it('addRejectionHistory: 반려 이력을 생성한다', () => {
      const reason = '승인 조건 미충족';
      const history = addRejectionHistory(testTargetSourceId, testActor, reason);

      expect(history.type).toBe('REJECTION');
      expect(history.details.reason).toBe(reason);
    });

    it('addDecommissionRequestHistory: 폐기 요청 이력을 생성한다', () => {
      const history = addDecommissionRequestHistory(testTargetSourceId, testActor, '서비스 종료');

      expect(history.type).toBe('DECOMMISSION_REQUEST');
      expect(history.details.reason).toBe('서비스 종료');
    });

    it('addDecommissionApprovedHistory: 폐기 승인 이력을 생성한다', () => {
      const history = addDecommissionApprovedHistory(testTargetSourceId, testActor);

      expect(history.type).toBe('DECOMMISSION_APPROVED');
    });

    it('addDecommissionRejectedHistory: 폐기 반려 이력을 생성한다', () => {
      const history = addDecommissionRejectedHistory(testTargetSourceId, testActor, '아직 사용 중');

      expect(history.type).toBe('DECOMMISSION_REJECTED');
      expect(history.details.reason).toBe('아직 사용 중');
    });
  });

  describe('getProjectHistory', () => {
    beforeEach(() => {
      // 테스트 데이터 생성
      addTargetConfirmedHistory(testTargetSourceId, testActor, 5, 1);
      addAutoApprovedHistory(testTargetSourceId);
      addApprovalHistory(testTargetSourceId, testActor);
      addRejectionHistory(testTargetSourceId, testActor, '사유1');
      addDecommissionRequestHistory(testTargetSourceId, testActor, '폐기 사유');

      // 다른 프로젝트 데이터
      addApprovalHistory(otherTargetSourceId, testActor);
    });

    it('프로젝트별로 히스토리를 조회한다', () => {
      const result = getProjectHistory({ targetSourceId: testTargetSourceId });

      expect(result.total).toBe(5);
      expect(result.history).toHaveLength(5);
    });

    it('다른 프로젝트의 히스토리는 포함하지 않는다', () => {
      const result = getProjectHistory({ targetSourceId: otherTargetSourceId });

      expect(result.total).toBe(1);
    });

    it('type=approval 필터: 승인/반려 관련만 조회한다', () => {
      const result = getProjectHistory({ targetSourceId: testTargetSourceId, type: 'approval' });

      // 모든 타입이 approval 관련이므로 전체 조회
      expect(result.total).toBe(5);
      result.history.forEach((h) => {
        expect([
          'TARGET_CONFIRMED',
          'AUTO_APPROVED',
          'APPROVAL',
          'REJECTION',
          'DECOMMISSION_REQUEST',
          'DECOMMISSION_APPROVED',
          'DECOMMISSION_REJECTED',
        ]).toContain(h.type);
      });
    });

    it('limit와 offset으로 페이지네이션한다', () => {
      const result = getProjectHistory({
        targetSourceId: testTargetSourceId,
        limit: 2,
        offset: 0,
      });

      expect(result.history).toHaveLength(2);
      expect(result.total).toBe(5); // 전체 개수는 유지
    });

    it('offset으로 페이지를 건너뛴다', () => {
      const page1 = getProjectHistory({
        targetSourceId: testTargetSourceId,
        limit: 2,
        offset: 0,
      });

      const page2 = getProjectHistory({
        targetSourceId: testTargetSourceId,
        limit: 2,
        offset: 2,
      });

      expect(page1.history[0].id).not.toBe(page2.history[0].id);
    });

    it('최신순으로 정렬된다', () => {
      const result = getProjectHistory({ targetSourceId: testTargetSourceId });

      for (let i = 0; i < result.history.length - 1; i++) {
        const current = new Date(result.history[i].timestamp).getTime();
        const next = new Date(result.history[i + 1].timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('존재하지 않는 프로젝트는 빈 배열 반환', () => {
      const result = getProjectHistory({ targetSourceId: 9999 });

      expect(result.history).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
