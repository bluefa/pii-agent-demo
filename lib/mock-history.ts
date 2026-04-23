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
  targetSourceId: number;
  type?: HistoryFilterType;
  limit?: number;
  offset?: number;
}

export interface GetProjectHistoryResult {
  history: ProjectHistory[];
  total: number;
}

export const getProjectHistory = (options: GetProjectHistoryOptions): GetProjectHistoryResult => {
  const { targetSourceId, type = 'all', limit = 50, offset = 0 } = options;
  const store = getStore();

  let filtered = store.projectHistory.filter((h) => h.targetSourceId === targetSourceId);

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
  targetSourceId: number;
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
  const { targetSourceId, type, actor, details = {} } = options;
  const store = getStore();

  const history: ProjectHistory = {
    id: generateId('ph'),
    targetSourceId,
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
  targetSourceId: number,
  actor: ProjectHistoryActor,
  resourceCount: number,
  excludedResourceCount: number,
  inputData?: ApprovalRequestInputSnapshot,
): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'TARGET_CONFIRMED',
    actor,
    details: { resourceCount, excludedResourceCount, inputData },
  });
};

/** 자동 승인 (시스템) */
export const addAutoApprovedHistory = (targetSourceId: number): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'AUTO_APPROVED',
    actor: { id: 'system', name: '시스템' },
  });
};

/** 승인 (수동) */
export const addApprovalHistory = (targetSourceId: number, actor: ProjectHistoryActor): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'APPROVAL',
    actor,
  });
};

/** 반려 */
export const addRejectionHistory = (
  targetSourceId: number,
  actor: ProjectHistoryActor,
  reason: string
): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'REJECTION',
    actor,
    details: { reason },
  });
};

/** 승인 요청 취소 */
export const addApprovalCancelledHistory = (
  targetSourceId: number,
  actor: ProjectHistoryActor
): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'APPROVAL_CANCELLED',
    actor,
  });
};

/** 폐기 요청 */
export const addDecommissionRequestHistory = (
  targetSourceId: number,
  actor: ProjectHistoryActor,
  reason: string
): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'DECOMMISSION_REQUEST',
    actor,
    details: { reason },
  });
};

/** 폐기 승인 */
export const addDecommissionApprovedHistory = (
  targetSourceId: number,
  actor: ProjectHistoryActor
): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'DECOMMISSION_APPROVED',
    actor,
  });
};

/** 폐기 반려 */
export const addDecommissionRejectedHistory = (
  targetSourceId: number,
  actor: ProjectHistoryActor,
  reason: string
): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'DECOMMISSION_REJECTED',
    actor,
    details: { reason },
  });
};
