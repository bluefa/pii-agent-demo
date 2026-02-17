import { getStore } from '@/lib/mock-store';
import { ProjectHistory, ProjectHistoryType, ProjectHistoryActor, ApprovalRequestInputSnapshot } from '@/lib/types';

// ===== Helper Functions =====

const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
};

// ===== History Query =====

export type HistoryFilterType = 'all' | 'approval';

const APPROVAL_TYPES: ProjectHistoryType[] = [
  'TARGET_CONFIRMED',
  'AUTO_APPROVED',
  'APPROVAL',
  'REJECTION',
  'APPROVAL_CANCELLED',
  'DECOMMISSION_REQUEST',
  'DECOMMISSION_APPROVED',
  'DECOMMISSION_REJECTED',
];

export interface GetProjectHistoryOptions {
  projectId: string;
  type?: HistoryFilterType;
  limit?: number;
  offset?: number;
}

export interface GetProjectHistoryResult {
  history: ProjectHistory[];
  total: number;
}

export const getProjectHistory = (options: GetProjectHistoryOptions): GetProjectHistoryResult => {
  const { projectId, type = 'all', limit = 50, offset = 0 } = options;
  const store = getStore();

  let filtered = store.projectHistory.filter((h) => h.projectId === projectId);

  // 타입 필터링 (현재는 all과 approval이 동일 - 모든 타입이 approval 관련)
  if (type === 'approval') {
    filtered = filtered.filter((h) => APPROVAL_TYPES.includes(h.type));
  }

  // 최신순 정렬
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = filtered.length;
  const history = filtered.slice(offset, offset + limit);

  return { history, total };
};

// ===== History Creation =====

export interface AddHistoryOptions {
  projectId: string;
  type: ProjectHistoryType;
  actor: ProjectHistoryActor;
  details?: {
    reason?: string;
    resourceCount?: number;
    excludedResourceCount?: number;
    inputData?: ApprovalRequestInputSnapshot;
  };
}

export const addProjectHistory = (options: AddHistoryOptions): ProjectHistory => {
  const { projectId, type, actor, details = {} } = options;
  const store = getStore();

  const history: ProjectHistory = {
    id: generateId('ph'),
    projectId,
    type,
    actor,
    timestamp: new Date().toISOString(),
    details,
  };

  store.projectHistory.push(history);
  return history;
};

// ===== Convenience Functions =====

/** 연동 대상 확정 */
export const addTargetConfirmedHistory = (
  projectId: string,
  actor: ProjectHistoryActor,
  resourceCount: number,
  excludedResourceCount: number,
  inputData?: ApprovalRequestInputSnapshot,
): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'TARGET_CONFIRMED',
    actor,
    details: { resourceCount, excludedResourceCount, inputData },
  });
};

/** 자동 승인 (시스템) */
export const addAutoApprovedHistory = (projectId: string): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'AUTO_APPROVED',
    actor: { id: 'system', name: '시스템' },
  });
};

/** 승인 (수동) */
export const addApprovalHistory = (projectId: string, actor: ProjectHistoryActor): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'APPROVAL',
    actor,
  });
};

/** 반려 */
export const addRejectionHistory = (
  projectId: string,
  actor: ProjectHistoryActor,
  reason: string
): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'REJECTION',
    actor,
    details: { reason },
  });
};

/** 승인 요청 취소 */
export const addApprovalCancelledHistory = (
  projectId: string,
  actor: ProjectHistoryActor
): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'APPROVAL_CANCELLED',
    actor,
  });
};

/** 폐기 요청 */
export const addDecommissionRequestHistory = (
  projectId: string,
  actor: ProjectHistoryActor,
  reason: string
): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'DECOMMISSION_REQUEST',
    actor,
    details: { reason },
  });
};

/** 폐기 승인 */
export const addDecommissionApprovedHistory = (
  projectId: string,
  actor: ProjectHistoryActor
): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'DECOMMISSION_APPROVED',
    actor,
  });
};

/** 폐기 반려 */
export const addDecommissionRejectedHistory = (
  projectId: string,
  actor: ProjectHistoryActor,
  reason: string
): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'DECOMMISSION_REJECTED',
    actor,
    details: { reason },
  });
};
