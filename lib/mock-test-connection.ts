import { getStore } from '@/lib/mock-store';
import { getCurrentStep } from '@/lib/process';
import { ProcessStatus } from '@/lib/types';
import type { Project, MockResource, ConnectionErrorType } from '@/lib/types';

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
  target_source_id: number;
  status: TestConnectionStatus;
  requested_at: string;
  completed_at: string | null;
  requested_by: string;
  resource_results: TestConnectionResourceResult[];
}

/** 내부용: Mock 시뮬레이션에서만 사용하는 확장 타입 */
interface InternalTestConnectionJob extends TestConnectionJob {
  estimated_end_at: string;
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

  const job: InternalTestConnectionJob = {
    id: generateId(),
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

export const getLatestJob = (targetSourceId: number): TestConnectionJob | undefined => {
  const store = getStore();
  const jobs = store.testConnectionJobs
    .filter((j) => j.target_source_id === targetSourceId)
    .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

  if (jobs.length === 0) return undefined;
  return calculateJobStatus(jobs[0]);
};

export const getJobHistory = (
  targetSourceId: number,
  page: number,
  size: number,
): { content: TestConnectionJob[]; total: number } => {
  const store = getStore();
  const allJobs = store.testConnectionJobs
    .filter((j) => j.target_source_id === targetSourceId)
    .map(calculateJobStatus)
    .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

  const offset = page * size;

  return {
    content: allJobs.slice(offset, offset + size),
    total: allJobs.length,
  };
};

export const hasPendingJob = (targetSourceId: number): boolean => {
  const store = getStore();
  return store.testConnectionJobs.some((j) => {
    if (j.target_source_id !== targetSourceId) return false;
    const updated = calculateJobStatus(j);
    return updated.status === 'PENDING';
  });
};

// ===== Time-based Status Calculation (순차 리소스 처리) =====

const calculateJobStatus = (job: TestConnectionJob): TestConnectionJob => {
  if (job.status === 'SUCCESS' || job.status === 'FAIL') {
    return job;
  }

  const internal = job as InternalTestConnectionJob;
  const now = Date.now();
  const store = getStore();
  const project = store.projects.find((p) => p.targetSourceId === job.target_source_id);

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

  for (const scheduleItem of internal.resource_schedule) {
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

    // 프로세스 상태 전환
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
    project.processStatus = getCurrentStep(project.status);

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

const simulateResourceResult = (resource: MockResource): TestConnectionResourceResult => {
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
export const clearJobHistory = (targetSourceId: number): void => {
  const store = getStore();
  store.testConnectionJobs = store.testConnectionJobs.filter((j) => j.target_source_id !== targetSourceId);
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

// ===== ADR-019 /install/v1 wire projections =====
//
// The simulation above keeps its internal job shape; these helpers project it
// to the swagger wire DTOs (snake) so the mock output == the contract. The
// per-job/per-agent enum gains RUNNING (PENDING/SUCCESS/FAIL → +RUNNING): a
// still-pending job is reported RUNNING while its agents settle.

type WireConnectionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAIL';

// Deterministic date-time placeholder for wire fields that have no real value
// yet (swagger types them format:date-time, so '' would be an invalid example).
// A fixed constant keeps the mock a valid schema example without Date.now()
// nondeterminism in tests.
const WIRE_DATE_PLACEHOLDER = '1970-01-01T00:00:00.000Z';

/** Monotonic run cursor for a target source (one job == one run). */
const versionForTarget = (targetSourceId: number): number =>
  getStore().testConnectionJobs.filter((j) => j.target_source_id === targetSourceId).length;

/** `TestConnectionVersionResult` wire shape (getLatestTestConnectionStatus). */
export const toVersionResultResponse = (job: TestConnectionJob) => {
  const topStatus: WireConnectionStatus = job.status === 'PENDING' ? 'RUNNING' : job.status;
  return {
    target_source_id: job.target_source_id,
    test_connection_version: versionForTarget(job.target_source_id),
    connection_status: topStatus,
    requested_at: job.requested_at,
    completed_at: job.completed_at ?? WIRE_DATE_PLACEHOLDER,
    test_connection_agent_results: job.resource_results.map((r) => ({
      agent_id: r.agent_id ?? `agent-${r.resource_id}`,
      gcp_region: '',
      resource_id: r.resource_id,
      connection_status: r.status,
      database_uri_list: r.status === 'SUCCESS' ? [`mysql://${r.resource_id}/db`] : [],
    })),
  };
};

/**
 * `TestConnectionLatestResultSummaryResponse[]` wire shape
 * (getLatestTestConnectionResultSummaries) — per-resource logical-DB counts for
 * the latest SUCCESS run. The real counts come from the logical-DB domain; the
 * mock derives deterministic placeholders keyed off the resource id so the table
 * renders. Empty array when the latest run is not a success.
 */
export const toLatestResultSummaries = (targetSourceId: number) => {
  const job = getLatestJob(targetSourceId);
  if (!job || job.status !== 'SUCCESS') return [];
  return job.resource_results
    .filter((r) => r.status === 'SUCCESS')
    .map((r) => {
      const seed = r.resource_id.length;
      const total = 8 + (seed % 8);
      const excluded = seed % 4;
      return {
        resource_id: r.resource_id,
        agent_id: r.agent_id ?? `agent-${r.resource_id}`,
        logical_database_count: total - excluded,
        excluded_logical_database_count: excluded,
      };
    });
};

// Steps that should already have a completed Test Connection result present.
const TESTED_STEPS: ReadonlySet<ProcessStatus> = new Set([
  ProcessStatus.WAITING_CONNECTION_TEST, // Step 5 — tested, awaiting 완료 승인
  ProcessStatus.CONNECTION_VERIFIED, // Step 6 — confirmed
  ProcessStatus.INSTALLATION_COMPLETE, // Step 7 — confirmed
]);

// Deterministic timestamps for seeded jobs (no Date.now()).
const SEED_REQUESTED_AT = '2026-06-01T00:00:00.000Z';
const SEED_COMPLETED_AT = '2026-06-01T00:00:20.000Z';

/**
 * Build the per-step seed: one completed-SUCCESS TestConnectionJob for every
 * project already at a Test-Connection step (5/6/7), derived from that project's
 * selected resources so resource_ids line up with confirmed-integration. This is
 * what makes latest_version / latest-results / completion-status coherent per
 * step. Deterministic (fixed timestamps). Does NOT touch connectionTest.passedAt
 * — that field drives getCurrentStep's step transition, so a seeded Step-5 result
 * must not flip the project to Step 6.
 *
 * Pure (takes projects, no getStore) so it can run inside the store initializer
 * without an import cycle.
 */
export const buildSeedTestConnectionJobs = (projects: Project[]): TestConnectionJob[] =>
  projects
    .filter((p) => p.targetSourceId !== undefined && TESTED_STEPS.has(p.processStatus))
    .map((project) => {
      const selected = project.resources.filter((r) => r.isSelected);
      return {
        id: `tc-seed-${project.targetSourceId}`,
        target_source_id: project.targetSourceId as number,
        status: 'SUCCESS',
        requested_at: SEED_REQUESTED_AT,
        completed_at: SEED_COMPLETED_AT,
        requested_by: 'seed@pii-agent.dev',
        resource_results: selected.map((r) => ({
          resource_id: r.resourceId,
          resource_type: r.type,
          status: 'SUCCESS',
          error_status: null,
          guide: null,
          agent_id: `agent-${r.resourceId}`,
        })),
      };
    });

const findProject = (targetSourceId: number): Project | undefined =>
  getStore().projects.find((p) => p.targetSourceId === targetSourceId);

/**
 * `TestConnectionCompletionStatusResponse` wire shape. Success is derived from
 * the latest test-connection JOB (a successful run does not auto-advance the
 * process — the 완료 승인 acknowledgment does), and confirmation from the
 * project's `operationConfirmed` flag (toggled by updateTestConnectionConfirmation):
 *   - SUCCESS job + confirmed              → CONFIRMED        (Step 6/7)
 *   - SUCCESS job + not confirmed          → LATEST_TEST_CONNECTION_SUCCESS (Step 5, CTA enabled)
 *   - no successful job                    → TEST_CONNECTION_REQUIRED       (pre-test)
 *
 * `LOGICAL_DATABASE_RECENTLY_UPDATED` is owned by the excluded-DB (logical-DB)
 * domain — there is no excluded-DB store here yet, so this mock never emits it.
 */
export const getCompletionStatus = (targetSourceId: number) => {
  const project = findProject(targetSourceId);
  const job = getLatestJob(targetSourceId);
  const succeeded = job?.status === 'SUCCESS';
  // Confirmed once the 완료 승인 acknowledgment ({confirmed:true}) ran. The
  // effective step (getCurrentStep — the system-authoritative status) is past
  // that gate at CONNECTION_VERIFIED / INSTALLATION_COMPLETE; operationConfirmed
  // also covers the in-session toggle (setConfirmation) before the step advances.
  const effectiveStep = project ? getCurrentStep(project.status) : undefined;
  const confirmed =
    project?.status.connectionTest.operationConfirmed === true ||
    effectiveStep === ProcessStatus.CONNECTION_VERIFIED ||
    effectiveStep === ProcessStatus.INSTALLATION_COMPLETE;

  const status: 'CONFIRMED' | 'LATEST_TEST_CONNECTION_SUCCESS' | 'TEST_CONNECTION_REQUIRED' =
    succeeded && confirmed
      ? 'CONFIRMED'
      : succeeded
        ? 'LATEST_TEST_CONNECTION_SUCCESS'
        : 'TEST_CONNECTION_REQUIRED';

  return {
    target_source_id: targetSourceId,
    latest_test_connection_requested_at: job?.requested_at ?? WIRE_DATE_PLACEHOLDER,
    logical_database_updated_at: WIRE_DATE_PLACEHOLDER,
    latest_test_connection_success: succeeded,
    test_connection_status: status,
    test_connection_confirmed: confirmed,
  };
};

/**
 * Toggle the completion-confirmation flag (PUT test-connection-acknowledgment).
 * `true` = 완료 승인 (Step 5 final approval); `false` = rollback (Step 6 re-run).
 * Returns the `TestConnectionConfirmationResponse` wire shape.
 */
export const setConfirmation = (targetSourceId: number, confirmed: boolean) => {
  const project = findProject(targetSourceId);
  if (project) {
    project.status.connectionTest = {
      ...project.status.connectionTest,
      operationConfirmed: confirmed,
    };
  }
  return {
    target_source_id: targetSourceId,
    confirmed,
    confirmed_at: new Date().toISOString(),
  };
};
