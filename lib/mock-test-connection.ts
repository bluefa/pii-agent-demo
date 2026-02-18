import { getStore } from '@/lib/mock-store';
import type { Project, Resource, ConnectionErrorType } from '@/lib/types';

// ===== Types =====

export type TestConnectionStatus = 'PENDING' | 'SUCCESS' | 'FAIL';
export type TestConnectionErrorStatus = 'AUTH_FAIL' | 'CONNECTION_FAIL' | 'PERMISSION_DENIED';

export interface TestConnectionResourceResult {
  resource_id: string;
  resource_type: string;
  status: TestConnectionStatus;
  error_status: TestConnectionErrorStatus | null;
  guide: string | null;
  agent_id: string | null;
}

export interface TestConnectionJob {
  id: string;
  projectId: string;
  target_source_id: number;
  status: TestConnectionStatus;
  requested_at: string;
  completed_at: string | null;
  requested_by: string;
  estimated_end_at: string;
  resource_results: TestConnectionResourceResult[];
}

// ===== Constants =====

const TC_MIN_DURATION_MS = 5_000;  // 최소 5초
const TC_MAX_DURATION_MS = 15_000; // 최대 15초

const ERROR_GUIDES: Record<TestConnectionErrorStatus, string> = {
  AUTH_FAIL: 'Credential 정보를 확인해주세요. 비밀번호가 만료되었거나 잘못 입력되었을 수 있습니다.',
  CONNECTION_FAIL: '네트워크 설정을 확인해주세요. 방화벽 또는 보안 그룹에서 접근이 차단되었을 수 있습니다.',
  PERMISSION_DENIED: '해당 리소스에 대한 접근 권한이 부족합니다. IAM 정책 또는 DB 권한을 확인해주세요.',
};

// ===== Helper =====

const generateId = (): string =>
  `tc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

const mapErrorType = (legacy: ConnectionErrorType): TestConnectionErrorStatus => {
  switch (legacy) {
    case 'AUTH_FAILED': return 'AUTH_FAIL';
    case 'PERMISSION_DENIED': return 'PERMISSION_DENIED';
    default: return 'CONNECTION_FAIL';
  }
};

// ===== Job Management =====

export const createTestConnectionJob = (
  project: Project,
  targetSourceId: number,
  requestedBy: string,
): TestConnectionJob => {
  const now = new Date();
  const duration = TC_MIN_DURATION_MS + Math.random() * (TC_MAX_DURATION_MS - TC_MIN_DURATION_MS);
  const estimatedEnd = new Date(now.getTime() + duration);

  const job: TestConnectionJob = {
    id: generateId(),
    projectId: project.id,
    target_source_id: targetSourceId,
    status: 'PENDING',
    requested_at: now.toISOString(),
    completed_at: null,
    requested_by: requestedBy,
    estimated_end_at: estimatedEnd.toISOString(),
    resource_results: [],
  };

  const store = getStore();
  store.testConnectionJobs.push(job);

  return job;
};

export const getLatestJob = (projectId: string): TestConnectionJob | undefined => {
  const store = getStore();
  const jobs = store.testConnectionJobs
    .filter((j) => j.projectId === projectId)
    .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

  if (jobs.length === 0) return undefined;
  return calculateJobStatus(jobs[0]);
};

export const getLastSuccessJob = (projectId: string): TestConnectionJob | undefined => {
  const store = getStore();
  const jobs = store.testConnectionJobs
    .filter((j) => j.projectId === projectId)
    .map(calculateJobStatus)
    .filter((j) => j.status === 'SUCCESS')
    .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

  return jobs[0];
};

export const getJobHistory = (
  projectId: string,
  page: number,
  size: number,
): { content: TestConnectionJob[]; total: number } => {
  const store = getStore();
  const allJobs = store.testConnectionJobs
    .filter((j) => j.projectId === projectId)
    .map(calculateJobStatus)
    .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

  const offset = page * size;

  return {
    content: allJobs.slice(offset, offset + size),
    total: allJobs.length,
  };
};

export const hasPendingJob = (projectId: string): boolean => {
  const store = getStore();
  return store.testConnectionJobs.some((j) => {
    if (j.projectId !== projectId) return false;
    const updated = calculateJobStatus(j);
    return updated.status === 'PENDING';
  });
};

// ===== Time-based Status Calculation =====

const calculateJobStatus = (job: TestConnectionJob): TestConnectionJob => {
  if (job.status === 'SUCCESS' || job.status === 'FAIL') {
    return job;
  }

  const now = Date.now();
  const estimatedEnd = new Date(job.estimated_end_at).getTime();

  if (now >= estimatedEnd) {
    return completeJob(job);
  }

  return job;
};

const completeJob = (job: TestConnectionJob): TestConnectionJob => {
  const store = getStore();
  const project = store.projects.find((p) => p.id === job.projectId);

  if (!project) {
    const failed: TestConnectionJob = {
      ...job,
      status: 'FAIL',
      completed_at: new Date().toISOString(),
      resource_results: [],
    };
    updateJobInStore(failed);
    return failed;
  }

  const selectedResources = project.resources.filter((r) => r.isSelected);
  const resourceResults = selectedResources.map((r) => simulateResourceResult(r));

  const hasFailure = resourceResults.some((r) => r.status === 'FAIL');

  const completed: TestConnectionJob = {
    ...job,
    status: hasFailure ? 'FAIL' : 'SUCCESS',
    completed_at: new Date().toISOString(),
    resource_results: resourceResults,
  };

  updateJobInStore(completed);
  return completed;
};

const simulateResourceResult = (resource: Resource): TestConnectionResourceResult => {
  const rand = Math.random();

  // 80% 성공
  if (rand < 0.8) {
    return {
      resource_id: resource.resourceId,
      resource_type: resource.type,
      status: 'SUCCESS',
      error_status: null,
      guide: null,
      agent_id: null,
    };
  }

  // 20% 실패 — 에러 유형 분배
  const legacyError: ConnectionErrorType = rand < 0.9 ? 'AUTH_FAILED' : 'PERMISSION_DENIED';
  const errorStatus = mapErrorType(legacyError);

  return {
    resource_id: resource.resourceId,
    resource_type: resource.type,
    status: 'FAIL',
    error_status: errorStatus,
    guide: ERROR_GUIDES[errorStatus],
    agent_id: null,
  };
};

const updateJobInStore = (job: TestConnectionJob): void => {
  const store = getStore();
  const index = store.testConnectionJobs.findIndex((j) => j.id === job.id);
  if (index >= 0) {
    store.testConnectionJobs[index] = job;
  }
};

// ===== Public Response Helpers =====

export const toJobResponse = (job: TestConnectionJob) => ({
  id: job.id,
  target_source_id: job.target_source_id,
  status: job.status,
  requested_at: job.requested_at,
  completed_at: job.completed_at,
  requested_by: job.requested_by,
  resource_results: job.resource_results,
});
