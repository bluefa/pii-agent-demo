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

interface ResourceScheduleItem {
  resource_id: string;
  complete_at: string;
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
  /** 내부용: 리소스별 완료 스케줄 (response에 미포함) */
  resource_schedule: ResourceScheduleItem[];
}

// ===== Constants =====

const RESOURCE_INTERVAL_MS = 5_000; // 리소스당 5초

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
  const selectedResources = project.resources.filter((r) => r.isSelected);

  // 리소스별 5초 간격 스케줄링
  const schedule: ResourceScheduleItem[] = selectedResources.map((r, index) => ({
    resource_id: r.resourceId,
    complete_at: new Date(now.getTime() + RESOURCE_INTERVAL_MS * (index + 1)).toISOString(),
  }));

  const totalDuration = RESOURCE_INTERVAL_MS * Math.max(selectedResources.length, 1);
  const estimatedEnd = new Date(now.getTime() + totalDuration);

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
    resource_schedule: schedule,
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

// ===== Time-based Status Calculation (순차 리소스 처리) =====

const calculateJobStatus = (job: TestConnectionJob): TestConnectionJob => {
  if (job.status === 'SUCCESS' || job.status === 'FAIL') {
    return job;
  }

  const now = Date.now();
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

  // 스케줄 기반으로 완료된 리소스만 결과에 포함
  const completedResults: TestConnectionResourceResult[] = [];
  let allDone = true;

  for (const scheduleItem of job.resource_schedule) {
    const completeAt = new Date(scheduleItem.complete_at).getTime();
    if (now >= completeAt) {
      // 이미 결과가 있으면 재사용, 없으면 생성
      const existing = job.resource_results.find((r) => r.resource_id === scheduleItem.resource_id);
      if (existing) {
        completedResults.push(existing);
      } else {
        const resource = project.resources.find((r) => r.resourceId === scheduleItem.resource_id);
        if (resource) {
          completedResults.push(simulateResourceResult(resource));
        }
      }
    } else {
      allDone = false;
    }
  }

  if (allDone) {
    // 모든 리소스 완료 → 전체 상태 결정
    const hasFailure = completedResults.some((r) => r.status === 'FAIL');
    const finalStatus = hasFailure ? 'FAIL' : 'SUCCESS';
    const completedAt = new Date().toISOString();
    const completed: TestConnectionJob = {
      ...job,
      status: finalStatus,
      completed_at: completedAt,
      resource_results: completedResults,
    };
    updateJobInStore(completed);

    // SUCCESS → 프로세스 상태 전환 (WAITING_CONNECTION_TEST → CONNECTION_VERIFIED)
    if (finalStatus === 'SUCCESS') {
      project.status.connectionTest = {
        status: 'PASSED',
        lastTestedAt: completedAt,
        passedAt: completedAt,
      };
    } else {
      project.status.connectionTest = {
        ...project.status.connectionTest,
        status: 'FAILED',
        lastTestedAt: completedAt,
      };
    }

    return completed;
  }

  // 아직 진행 중 — 부분 결과 업데이트
  const updated: TestConnectionJob = {
    ...job,
    resource_results: completedResults,
  };
  updateJobInStore(updated);
  return updated;
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

// ===== Job Cleanup =====

/** 프로세스 재시작 시 기존 연결 테스트 내역 전체 삭제 */
export const clearJobHistory = (projectId: string): void => {
  const store = getStore();
  store.testConnectionJobs = store.testConnectionJobs.filter((j) => j.projectId !== projectId);
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
