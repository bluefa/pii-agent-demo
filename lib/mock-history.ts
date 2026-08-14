import { getStore } from '@/lib/mock-store';
import { ProjectHistory, ProjectHistoryType, ProjectHistoryActor } from '@/lib/types';

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

// ===== Seed =====

/**
 * Seeded approval trail for the ops demo target 1583. `projectHistory` starts empty and only a
 * live 확정→승인 flow writes to it, so the ops 승인 요청 내역 card had nothing to render on any
 * target — the card, its pager and its 상세 보기 modal were only reachable by first driving the
 * whole request flow by hand.
 *
 * Entries pair up: a TARGET_CONFIRMED opens a request row and the action that follows closes it
 * (mock confirm.getApprovalHistory), so these six read as three rows — 반려 · 취소 · 승인. The
 * two ids of a pair share their digits because that number is the request id the detail modal
 * looks the row up by.
 *
 * Timestamps sit inside the window the 상태 변경 이력 card shows next to this one (mock/ops
 * SEED_TIMES): the first request lands on the step-2 transition and the approval on the step-3
 * one. The two cards are read side by side, and an approval dated before the target reached
 * 승인 대기 is the first thing the eye catches.
 */
const OPS_DEMO_TARGET_SOURCE_ID = 1583;

const REQUESTER: ProjectHistoryActor = { id: 'user-1', name: '홍길동' };
const APPROVER: ProjectHistoryActor = { id: 'admin-1', name: '관리자' };

export const buildSeedProjectHistory = (): ProjectHistory[] => {
  const at = (
    id: string,
    type: ProjectHistoryType,
    actor: ProjectHistoryActor,
    timestamp: string,
    details: ProjectHistory['details'] = {},
  ): ProjectHistory => ({ id, targetSourceId: OPS_DEMO_TARGET_SOURCE_ID, type, actor, timestamp, details });

  return [
    at('ph-seed-15831-req', 'TARGET_CONFIRMED', REQUESTER, '2026-07-16T10:31:00+09:00', {
      resourceCount: 2,
      excludedResourceCount: 1,
    }),
    at('ph-seed-15831-res', 'REJECTION', APPROVER, '2026-07-16T15:40:00+09:00', {
      reason: '대상 3건 중 10.20.4.18(ORACLE)은 대외 구간이라 접근 허용 근거가 필요합니다. 근거 첨부 후 다시 요청해 주세요.',
    }),
    at('ph-seed-15832-req', 'TARGET_CONFIRMED', REQUESTER, '2026-07-17T09:12:00+09:00', {
      resourceCount: 3,
      excludedResourceCount: 0,
    }),
    at('ph-seed-15832-res', 'APPROVAL_CANCELLED', REQUESTER, '2026-07-17T09:58:00+09:00'),
    at('ph-seed-15833-req', 'TARGET_CONFIRMED', REQUESTER, '2026-07-17T14:20:00+09:00', {
      resourceCount: 3,
      excludedResourceCount: 0,
    }),
    at('ph-seed-15833-res', 'APPROVAL', APPROVER, '2026-07-17T18:56:00+09:00'),
  ];
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
): ProjectHistory => {
  return addProjectHistory({
    targetSourceId,
    type: 'TARGET_CONFIRMED',
    actor,
    details: { resourceCount, excludedResourceCount },
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
