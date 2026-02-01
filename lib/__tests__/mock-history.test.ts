import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProjectHistory,
  addProjectHistory,
  addApprovalHistory,
  addRejectionHistory,
  addResourceExcludeHistory,
  addResourceAddHistory,
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
const testProjectId = 'project-1';

describe('mock-history', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addProjectHistory', () => {
    it('히스토리 항목을 생성하고 저장한다', () => {
      const history = addProjectHistory({
        projectId: testProjectId,
        type: 'APPROVAL',
        actor: testActor,
      });

      expect(history.id).toBeDefined();
      expect(history.projectId).toBe(testProjectId);
      expect(history.type).toBe('APPROVAL');
      expect(history.actor).toEqual(testActor);
      expect(history.timestamp).toBeDefined();

      const store = getStore();
      expect(store.projectHistory).toHaveLength(1);
    });

    it('details를 포함하여 저장한다', () => {
      const history = addProjectHistory({
        projectId: testProjectId,
        type: 'REJECTION',
        actor: testActor,
        details: { reason: '테스트 반려 사유' },
      });

      expect(history.details.reason).toBe('테스트 반려 사유');
    });
  });

  describe('convenience functions', () => {
    it('addApprovalHistory: 승인 이력을 생성한다', () => {
      const history = addApprovalHistory(testProjectId, testActor);

      expect(history.type).toBe('APPROVAL');
      expect(history.projectId).toBe(testProjectId);
    });

    it('addRejectionHistory: 반려 이력을 생성한다', () => {
      const reason = '승인 조건 미충족';
      const history = addRejectionHistory(testProjectId, testActor, reason);

      expect(history.type).toBe('REJECTION');
      expect(history.details.reason).toBe(reason);
    });

    it('addResourceExcludeHistory: 리소스 제외 이력을 생성한다', () => {
      const history = addResourceExcludeHistory(
        testProjectId,
        testActor,
        'res-1',
        'arn:aws:rds:ap-northeast-2:123:db:test',
        '테스트 환경 제외'
      );

      expect(history.type).toBe('RESOURCE_EXCLUDE');
      expect(history.details.resourceId).toBe('res-1');
      expect(history.details.resourceName).toBe('arn:aws:rds:ap-northeast-2:123:db:test');
      expect(history.details.reason).toBe('테스트 환경 제외');
    });

    it('addResourceAddHistory: 리소스 추가 이력을 생성한다', () => {
      const history = addResourceAddHistory(
        testProjectId,
        testActor,
        'res-1',
        'arn:aws:rds:ap-northeast-2:123:db:test'
      );

      expect(history.type).toBe('RESOURCE_ADD');
      expect(history.details.resourceId).toBe('res-1');
    });

    it('addDecommissionRequestHistory: 폐기 요청 이력을 생성한다', () => {
      const history = addDecommissionRequestHistory(testProjectId, testActor, '서비스 종료');

      expect(history.type).toBe('DECOMMISSION_REQUEST');
      expect(history.details.reason).toBe('서비스 종료');
    });

    it('addDecommissionApprovedHistory: 폐기 승인 이력을 생성한다', () => {
      const history = addDecommissionApprovedHistory(testProjectId, testActor);

      expect(history.type).toBe('DECOMMISSION_APPROVED');
    });

    it('addDecommissionRejectedHistory: 폐기 반려 이력을 생성한다', () => {
      const history = addDecommissionRejectedHistory(testProjectId, testActor, '아직 사용 중');

      expect(history.type).toBe('DECOMMISSION_REJECTED');
      expect(history.details.reason).toBe('아직 사용 중');
    });
  });

  describe('getProjectHistory', () => {
    beforeEach(() => {
      // 테스트 데이터 생성
      addApprovalHistory(testProjectId, testActor);
      addRejectionHistory(testProjectId, testActor, '사유1');
      addResourceExcludeHistory(testProjectId, testActor, 'res-1', 'resource-name', '제외 사유');
      addResourceAddHistory(testProjectId, testActor, 'res-2', 'resource-name-2');
      addDecommissionRequestHistory(testProjectId, testActor, '폐기 사유');

      // 다른 프로젝트 데이터
      addApprovalHistory('other-project', testActor);
    });

    it('프로젝트별로 히스토리를 조회한다', () => {
      const result = getProjectHistory({ projectId: testProjectId });

      expect(result.total).toBe(5);
      expect(result.history).toHaveLength(5);
    });

    it('다른 프로젝트의 히스토리는 포함하지 않는다', () => {
      const result = getProjectHistory({ projectId: 'other-project' });

      expect(result.total).toBe(1);
    });

    it('type=approval 필터: 승인/반려/폐기 관련만 조회한다', () => {
      const result = getProjectHistory({ projectId: testProjectId, type: 'approval' });

      expect(result.total).toBe(3); // APPROVAL, REJECTION, DECOMMISSION_REQUEST
      result.history.forEach((h) => {
        expect(['APPROVAL', 'REJECTION', 'DECOMMISSION_REQUEST', 'DECOMMISSION_APPROVED', 'DECOMMISSION_REJECTED']).toContain(h.type);
      });
    });

    it('type=resource 필터: 리소스 변경만 조회한다', () => {
      const result = getProjectHistory({ projectId: testProjectId, type: 'resource' });

      expect(result.total).toBe(2); // RESOURCE_EXCLUDE, RESOURCE_ADD
      result.history.forEach((h) => {
        expect(['RESOURCE_ADD', 'RESOURCE_EXCLUDE']).toContain(h.type);
      });
    });

    it('limit와 offset으로 페이지네이션한다', () => {
      const result = getProjectHistory({
        projectId: testProjectId,
        limit: 2,
        offset: 0,
      });

      expect(result.history).toHaveLength(2);
      expect(result.total).toBe(5); // 전체 개수는 유지
    });

    it('offset으로 페이지를 건너뛴다', () => {
      const page1 = getProjectHistory({
        projectId: testProjectId,
        limit: 2,
        offset: 0,
      });

      const page2 = getProjectHistory({
        projectId: testProjectId,
        limit: 2,
        offset: 2,
      });

      expect(page1.history[0].id).not.toBe(page2.history[0].id);
    });

    it('최신순으로 정렬된다', () => {
      const result = getProjectHistory({ projectId: testProjectId });

      for (let i = 0; i < result.history.length - 1; i++) {
        const current = new Date(result.history[i].timestamp).getTime();
        const next = new Date(result.history[i + 1].timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('존재하지 않는 프로젝트는 빈 배열 반환', () => {
      const result = getProjectHistory({ projectId: 'non-existent' });

      expect(result.history).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
