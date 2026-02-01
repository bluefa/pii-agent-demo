import { getStore } from '@/lib/mock-store';
import { ProjectHistory, ProjectHistoryType, ProjectHistoryActor } from '@/lib/types';

// ===== Helper Functions =====

const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
};

// ===== History Query =====

export type HistoryFilterType = 'all' | 'approval' | 'resource';

const APPROVAL_TYPES: ProjectHistoryType[] = [
  'APPROVAL',
  'REJECTION',
  'DECOMMISSION_REQUEST',
  'DECOMMISSION_APPROVED',
  'DECOMMISSION_REJECTED',
];

const RESOURCE_TYPES: ProjectHistoryType[] = ['RESOURCE_ADD', 'RESOURCE_EXCLUDE'];

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

  // 타입 필터링
  if (type === 'approval') {
    filtered = filtered.filter((h) => APPROVAL_TYPES.includes(h.type));
  } else if (type === 'resource') {
    filtered = filtered.filter((h) => RESOURCE_TYPES.includes(h.type));
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
    resourceId?: string;
    resourceName?: string;
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

export const addApprovalHistory = (projectId: string, actor: ProjectHistoryActor): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'APPROVAL',
    actor,
  });
};

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

export const addResourceExcludeHistory = (
  projectId: string,
  actor: ProjectHistoryActor,
  resourceId: string,
  resourceName: string,
  reason: string
): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'RESOURCE_EXCLUDE',
    actor,
    details: { resourceId, resourceName, reason },
  });
};

export const addResourceAddHistory = (
  projectId: string,
  actor: ProjectHistoryActor,
  resourceId: string,
  resourceName: string
): ProjectHistory => {
  return addProjectHistory({
    projectId,
    type: 'RESOURCE_ADD',
    actor,
    details: { resourceId, resourceName },
  });
};

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
