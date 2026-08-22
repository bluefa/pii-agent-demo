import { getStore } from '@/lib/mock-store';
import { getCurrentStep } from '@/lib/process';
import { resultUnitId } from '@/lib/resource-grouping';
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
  /** DRAFT CONTRACT — 실패 사유 enum 원문. 시딩되지 않은 FAIL 은 error_status 에서 유도. */
  fail_reason?: string | null;
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
  /** DRAFT CONTRACT — 실행(TargetSource) 단위 실패 사유. FAIL 로 닫힌 실행에만 실린다. */
  fail_reason?: string | null;
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
  const selectedResources = testConnectionUnits(project);

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
        // Matched against the units, not the raw resources — a folded Athena region id
        // belongs to no single resource row.
        const resource = testConnectionUnits(project).find(
          (r) => r.resourceId === scheduleItem.resource_id,
        );
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

    // 프로세스 상태 전환. 테스트 성공은 결과만 기록한다 — Step5→6 전환은 완료 승인 요청
    // (test-connection-acknowledgment PUT, confirmed:true → setConfirmation)이 게이트라
    // 여기서 passedAt 을 세팅하지 않는다(성공해도 승인 전엔 Step5 유지).
    if (finalStatus === 'SUCCESS') {
      project.status.connectionTest = {
        ...project.status.connectionTest,
        status: 'PASSED',
        lastTestedAt: completedAt,
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

/**
 * What one run reports on, one entry per id the BFF keys a result by.
 *
 * Athena is tested per REGION, not per database: the result carries
 * `athena_region_resource_id` (`athena:<acct>:<region>/<catalog>`), so a region's databases
 * collapse into a single entry wearing that id. Emitting one result per database would hand the
 * UI four verdicts for one test and none of them under a key it looks up.
 */
export const testConnectionUnits = (project: Project): MockResource[] => {
  const seen = new Set<string>();
  const units: MockResource[] = [];
  for (const resource of project.resources) {
    if (!resource.isSelected) continue;
    const unitId = resultUnitId(resource);
    if (seen.has(unitId)) continue;
    seen.add(unitId);
    units.push(unitId === resource.resourceId ? resource : { ...resource, resourceId: unitId });
  }
  return units;
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

/** agent 결과 한 행의 wire 꼴 — settled/unsettled 두 빌더가 같은 타입을 쓴다. */
interface WireAgentRow {
  agent_id: string;
  gcp_region: string;
  resource_id: string;
  connection_status: WireConnectionStatus;
  /** DRAFT CONTRACT — 디스패치 전(PENDING)과 pod 없는 실패(POD_CREATION_FAILED)만 비운다. */
  pod_id?: string;
  /** DRAFT CONTRACT — FAIL 행에만 실린다. */
  fail_reason?: string;
  database_uri_list: string[];
}

// Deterministic date-time placeholder for wire fields that have no real value
// yet (swagger types them format:date-time, so '' would be an invalid example).
// A fixed constant keeps the mock a valid schema example without Date.now()
// nondeterminism in tests.
const WIRE_DATE_PLACEHOLDER = '1970-01-01T00:00:00.000Z';

/**
 * Fallback agent id for a result the simulation left `agent_id: null` on. Was
 * `agent-${resource_id}`, which just restated the resource id — an ARM id twice on
 * one row. A real collector agent has a short identity of its own, so the mock uses
 * a positional one; deterministic, and short enough to read next to the resource.
 */
const fallbackAgentId = (index: number): string =>
  `tc-agent-${String(index + 1).padStart(2, '0')}`;

/** Monotonic run cursor for a target source (one job == one run). */
const versionForTarget = (targetSourceId: number): number =>
  getStore().testConnectionJobs.filter((j) => j.target_source_id === targetSourceId).length;

/**
 * 접수 후 실제 디스패치까지의 창 — 이 동안 top-level 은 PENDING(시작 대기)으로 나간다.
 * 예전엔 살아있는 job 을 무조건 RUNNING 으로 투사해 계약의 top-level PENDING 이 목에서
 * 한 번도 나오지 않았다. 첫 리소스 정착(RESOURCE_INTERVAL_MS 5s)보다 짧아야 한다.
 */
const DISPATCH_MS = 4_000;

/** top-level PENDING(시작 대기) 판정 — 결과 0건 + 디스패치 전(또는 고정 fixture 2107). */
const isQueued = (job: TestConnectionJob): boolean =>
  job.status === 'PENDING' &&
  job.resource_results.length === 0 &&
  (job.target_source_id === TC_CARD_FIXTURE.queued ||
    Date.now() < Date.parse(job.requested_at) + DISPATCH_MS);

/**
 * Contract-facing top-level status. The store keeps one PENDING for the whole
 * in-flight window; the contract splits it into PENDING(시작 대기) and RUNNING.
 * Every projection of a job's status must go through this one rule — a sibling
 * that maps PENDING straight to RUNNING makes the history modal call a queued
 * run "진행 중" while the card says 대기.
 */
export const toWireTopStatus = (job: TestConnectionJob): WireConnectionStatus =>
  job.status === 'PENDING' ? (isQueued(job) ? 'PENDING' : 'RUNNING') : job.status;

/**
 * DRAFT CONTRACT — 시딩 없이 시뮬레이터가 만든 FAIL 행의 fail_reason. 레거시
 * error_status 를 새 enum 어휘로 접는다: 인증·권한 거절은 DB 가 실제로 거절한 것
 * (CLUSTER_TEST_FAILED), 연결 실패는 응답 없이 시간이 초과한 모양이 전형이다.
 */
const reasonFromError = (error: TestConnectionErrorStatus | null): string =>
  error === 'CONNECTION_FAIL' ? 'FUNCTION_INVOCATION_TIMEOUT' : 'CLUSTER_TEST_FAILED';

const resourceFailReason = (r: TestConnectionResourceResult): string | null =>
  r.status === 'FAIL' ? (r.fail_reason ?? reasonFromError(r.error_status)) : null;

/**
 * DRAFT CONTRACT — 리소스별 `pod_id` 는 다음 install-v1 swagger 개정에 실리는 필드.
 * k8s Job pod 꼴(잡 접두사 + 난수 조각)을 결정적으로 흉내 낸다 — 같은 실행의 같은
 * 리소스는 항상 같은 이름이어야 폴링 프레임마다 pod 열이 흔들리지 않는다.
 */
const podIdFor = (targetSourceId: number, version: number, resourceId: string): string => {
  let hash = 0;
  for (let i = 0; i < resourceId.length; i += 1) hash = (hash * 31 + resourceId.charCodeAt(i)) >>> 0;
  return `tc-${targetSourceId}-${version}-${hash.toString(36).padStart(5, '0').slice(-5)}`;
};

/** `TestConnectionVersionResult` wire shape (getLatestTestConnectionStatus). */
export const toVersionResultResponse = (job: TestConnectionJob) => {
  const queued = isQueued(job);
  const topStatus = toWireTopStatus(job);
  const version = versionForTarget(job.target_source_id);
  const settled = job.resource_results.map((r, index) => {
    const failReason = resourceFailReason(r);
    const wireRow: WireAgentRow = {
      agent_id: r.agent_id ?? fallbackAgentId(index),
      gcp_region: '',
      resource_id: r.resource_id,
      connection_status: r.status as WireConnectionStatus,
      database_uri_list: r.status === 'SUCCESS' ? [`mysql://${r.resource_id}/db`] : [],
    };
    // 판정이 난 행은 pod 가 반드시 있었다 — 단 하나의 예외가 POD_CREATION_FAILED:
    // pod 자체가 못 떠서 pod_id 도 로그도 없다.
    if (failReason !== 'POD_CREATION_FAILED') {
      wireRow.pod_id = podIdFor(job.target_source_id, version, r.resource_id);
    }
    if (failReason) wireRow.fail_reason = failReason;
    return wireRow;
  });
  return {
    target_source_id: job.target_source_id,
    test_connection_version: version,
    connection_status: topStatus,
    requested_at: job.requested_at,
    // 미완료 실행은 null — 계약(loose codegen)이 nullable 이고, epoch 플레이스홀더를
    // 보내면 헤더 태그가 진행 중인 실행을 "20673일 전"으로 읽는다.
    completed_at: job.completed_at,
    // DRAFT CONTRACT — 실행 단위 fail_reason. 시딩이 없으면 첫 실패 리소스의 사유로
    // 유도한다(부분 실패의 run 사유 의미는 계약 랜딩 시 확정 — 값이 없으면 UI 는 줄
    // 자체를 그리지 않으므로 어느 쪽으로 랜딩해도 안전하다).
    ...(topStatus === 'FAIL'
      ? {
          fail_reason:
            job.fail_reason
            ?? job.resource_results.map(resourceFailReason).find(Boolean)
            ?? null,
        }
      : {}),
    test_connection_agent_results: [
      ...settled,
      ...unsettledAgentResults(job, settled.length, queued, version),
    ],
  };
};

/**
 * 아직 결과가 없는 agent 들. 예전에는 이 응답이 끝난 agent 만 실어서, 진행 중인 실행에서
 * 30건 중 10건만 존재하는 것처럼 보였다 — 계약의 PENDING/RUNNING 이 한 번도 나오지 않아
 * 화면이 "대기"와 "정보 없음"을 구분할 수 없었다.
 *
 * 시뮬레이션이 리소스를 한 건씩 차례로 처리하므로, 다음 차례 하나가 RUNNING 이고 그
 * 뒤는 전부 PENDING 이다. 시작 대기(queued) 창에는 아직 아무것도 돌지 않으므로 전부
 * PENDING 이다.
 */
const unsettledAgentResults = (
  job: TestConnectionJob,
  settledCount: number,
  queued: boolean,
  version: number,
) => {
  const schedule = (job as InternalTestConnectionJob).resource_schedule ?? [];
  const done = new Set(job.resource_results.map((r) => r.resource_id));
  return schedule
    .filter((item) => !done.has(item.resource_id))
    .map((item, offset): WireAgentRow => {
      const running = !queued && offset === 0;
      return {
        agent_id: fallbackAgentId(settledCount + offset),
        gcp_region: '',
        resource_id: item.resource_id,
        connection_status: running ? 'RUNNING' : 'PENDING',
        // pod 는 디스패치 시점에 생긴다 — PENDING 행에는 아직 없다.
        ...(running ? { pod_id: podIdFor(job.target_source_id, version, item.resource_id) } : {}),
        database_uri_list: [],
      };
    });
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

  // Athena 리전 하나가 덮는 데이터베이스 수. Athena 는 데이터베이스가 곧 논리 DB 라
  // (그 안에 다시 나눌 하위 단위가 없다) 연동 대상 수 = 데이터베이스 수, 제외는 0 이다.
  // 자리표 공식(`8 + seed % 8`)을 그대로 두면 데이터베이스 3개짜리 리전이 8개라고 보고해,
  // 같은 행이 왼쪽에서는 3, 오른쪽에서는 8 이라고 말한다.
  const athenaDatabases = new Map<string, number>();
  for (const resource of findProject(targetSourceId)?.resources ?? []) {
    if (!resource.isSelected) continue;
    const unitId = resultUnitId(resource);
    // 접히는 타입은 Athena 뿐 — 나머지는 unitId 가 곧 제 resourceId 다.
    if (unitId === resource.resourceId) continue;
    athenaDatabases.set(unitId, (athenaDatabases.get(unitId) ?? 0) + 1);
  }

  return job.resource_results
    .filter((r) => r.status === 'SUCCESS')
    .map((r, index) => {
      const agent_id = r.agent_id ?? fallbackAgentId(index);
      const databases = athenaDatabases.get(r.resource_id);
      if (databases != null) {
        return {
          resource_id: r.resource_id,
          agent_id,
          logical_database_count: databases,
          excluded_logical_database_count: 0,
        };
      }
      const seed = r.resource_id.length;
      const total = 8 + (seed % 8);
      const excluded = seed % 4;
      return {
        resource_id: r.resource_id,
        agent_id,
        logical_database_count: total - excluded,
        excluded_logical_database_count: excluded,
      };
    });
};

// ===== Pod 로그 (DRAFT CONTRACT — StackDriver 캡처본 조회) =====

/** severity + content 한 줄 — StackDriver LogSeverity 어휘를 원문 그대로 쓴다. */
export interface TestConnectionPodLogEntry {
  severity: string;
  content: string;
  /** StackDriver `LogEntry.timestamp` — 이 줄이 찍힌 시각. 캡처 시점에 붙는다. */
  timestamp?: string;
}

/**
 * 정착한 리소스 한 건의 pod 로그 본문. 결정적(랜덤·시각 없음) — 같은 pod 를 두 번
 * 열어도 같은 캡처본이어야 하고, 실패 행의 로그는 그 행의 fail_reason 이 말하는
 * 서사를 담아야 화면 문구와 로그가 서로를 반증하지 않는다.
 */
const podLogLines = (
  targetSourceId: number,
  r: TestConnectionResourceResult,
): TestConnectionPodLogEntry[] => {
  const rid = r.resource_id;
  const secretRef = `secret/db-cred-${targetSourceId}`;
  const head: TestConnectionPodLogEntry[] = [
    { severity: 'INFO', content: `Starting connection test · target ${rid} (${r.resource_type})` },
    { severity: 'INFO', content: `Resolving credential ref ${secretRef} from Secret Manager` },
  ];
  if (r.status === 'SUCCESS') {
    return [
      ...head,
      { severity: 'INFO', content: `Credential resolved · connecting to ${rid}` },
      { severity: 'NOTICE', content: 'TCP handshake established · TLS negotiated' },
      { severity: 'INFO', content: 'Validated logical databases · marking resource result SUCCESS' },
      { severity: 'DEBUG', content: 'Pod terminating · exit code 0 · duration 4.2s' },
    ];
  }
  const reason = resourceFailReason(r) ?? 'UNKNOWN';
  const tail: TestConnectionPodLogEntry[] = [
    { severity: 'INFO', content: `Marking resource result FAILED · fail_reason=${reason}` },
    { severity: 'DEBUG', content: 'Pod terminating · exit code 1 · duration 8.4s' },
  ];
  if (reason === 'SECRET_NOT_FOUND') {
    return [
      ...head,
      { severity: 'ERROR', content: `Secret not found: ${secretRef} (project pass-prod)` },
      { severity: 'WARNING', content: 'Retry 1/3 in 2000ms — credential resolution failed' },
      { severity: 'WARNING', content: 'Retry 2/3 in 4000ms — credential resolution failed' },
      { severity: 'ERROR', content: 'Giving up after 3 attempts: SECRET_NOT_FOUND' },
      ...tail,
    ];
  }
  if (reason === 'CLUSTER_TEST_FAILED') {
    return [
      ...head,
      { severity: 'INFO', content: `Credential resolved · connecting to ${rid}` },
      { severity: 'NOTICE', content: 'TCP handshake established · authenticating' },
      { severity: 'ERROR', content: "Access denied for user 'pii_agent'@'10.32.0.14' (using password: YES)" },
      { severity: 'ERROR', content: 'Giving up after 3 attempts: CLUSTER_TEST_FAILED' },
      ...tail,
    ];
  }
  if (reason === 'FUNCTION_INVOCATION_TIMEOUT') {
    return [
      ...head,
      { severity: 'INFO', content: `Credential resolved · connecting to ${rid}` },
      { severity: 'WARNING', content: 'No response after 30s — retrying with backoff' },
      { severity: 'ERROR', content: 'Connection attempt timed out after 120s' },
      ...tail,
    ];
  }
  return [
    ...head,
    { severity: 'ERROR', content: `Connection test failed: ${reason}` },
    ...tail,
  ];
};

/**
 * 줄 시각 — 캡처본은 pod 가 끝난 순간까지의 tail 이라 마지막 줄이 곧 캡처 시각이고,
 * 그 앞은 일정 간격으로 거슬러 올라간다. 결정적이어야 한다(랜덤·현재 시각 금지):
 * 같은 pod 를 두 번 열면 같은 시각이 나와야 화면이 캡처본이라고 말할 수 있다.
 */
const LOG_LINE_GAP_MS = 800;

const stampLines = (
  capturedAt: string | null,
  lines: readonly TestConnectionPodLogEntry[],
): TestConnectionPodLogEntry[] => {
  const end = capturedAt ? new Date(capturedAt).getTime() : Number.NaN;
  if (Number.isNaN(end)) return [...lines];
  return lines.map((line, index) => ({
    ...line,
    timestamp: new Date(end - (lines.length - 1 - index) * LOG_LINE_GAP_MS).toISOString(),
  }));
};

/**
 * DRAFT CONTRACT — pod_id 로 캡처본을 조회한다. 최신 실행의 정착한 리소스만 캡처가
 * 존재한다: 미정착(RUNNING) pod 는 완료 시점 캡처 전이고(UI 도 "수집 중"으로 막는다),
 * POD_CREATION_FAILED 는 pod 가 없어 wire 에 pod_id 자체가 실리지 않는다.
 */
export const getPodLog = (
  targetSourceId: number,
  podId: string,
): { pod_id: string; captured_at: string | null; entries: TestConnectionPodLogEntry[] } | null => {
  const job = getLatestJob(targetSourceId);
  if (!job) return null;
  const version = versionForTarget(targetSourceId);
  const settled = job.resource_results.find(
    (r) =>
      resourceFailReason(r) !== 'POD_CREATION_FAILED' &&
      podIdFor(targetSourceId, version, r.resource_id) === podId,
  );
  if (!settled) return null;
  const capturedAt = job.completed_at ?? job.requested_at;
  return {
    pod_id: podId,
    captured_at: capturedAt,
    entries: stampLines(capturedAt, podLogLines(targetSourceId, settled)),
  };
};

// Steps that should already have a completed Test Connection result present.
const TESTED_STEPS: ReadonlySet<ProcessStatus> = new Set([
  ProcessStatus.WAITING_CONNECTION_TEST, // Step 5 — tested, awaiting 완료 승인
  ProcessStatus.CONNECTION_VERIFIED, // Step 6 — confirmed
  ProcessStatus.INSTALLATION_COMPLETE, // Step 7 — confirmed
]);

// Deterministic timestamps for seeded jobs (no Date.now()).
const SEED_REQUESTED_AT = '2026-06-01T00:00:00.000Z';
const SEED_COMPLETED_AT = '2026-06-01T00:04:20.000Z';

// ===== Step 5 TC-card state fixtures (targets 2101~2108, lib/mock-data.ts) =====
//
// One target per folded card state (시안 A slot) so every slot variant renders
// without racing the simulator. The generic per-step seed below gives every
// step-5/6/7 target a settled-SUCCESS latest run; these ids override that.
// success (2104) and confirmed (2106) keep the default seed — confirmed's
// verdict comes from the project's `passedAt`, set in mock-data. 2107(시작
// 대기)·2108(무보고 실패)은 top-level PENDING 계열 프레임을 고정한다.
export const TC_CARD_FIXTURE = {
  idle: 2101,
  running: 2102,
  fail: 2103,
  success: 2104,
  policyChanged: 2105,
  confirmed: 2106,
  /** top-level PENDING 고정 — 접수됐지만 디스패치 전(시작 대기) 프레임. */
  queued: 2107,
  /** PENDING→FAIL — 한 건도 보고되기 전에 실패로 정착한 프레임(일반 실패 문구로 접힘). */
  noReportFail: 2108,
} as const;

/**
 * 2105: when the logical-DB policy "changed" — after SEED_COMPLETED_AT, so the
 * seeded run reads LOGICAL_DATABASE_RECENTLY_UPDATED. A re-run completes with a
 * fresh completed_at that postdates this, so the verdict falls back to success —
 * the same rule the real domain applies.
 */
const TC_FIXTURE_POLICY_UPDATED_AT = '2026-06-05T14:22:00.000Z';

/** 2102: schedule tail far enough out that the seeded run never settles. */
const TC_FIXTURE_RUNNING_TAIL_AT = '2099-01-01T00:00:00.000Z';

/** 2108: 무보고 실패의 정착 시각 — 디스패치 실패는 리소스 간격을 다 돌지 않고 끝난다. */
const TC_FIXTURE_NO_REPORT_FAILED_AT = '2026-06-01T00:00:30.000Z';

/**
 * Runs that precede the latest seeded one, oldest last. They exist so the 수행 기록
 * (execution-history) table has a trail to show instead of a single row; every one
 * is strictly older than SEED_REQUESTED_AT so `getLatestJob` — and everything
 * derived from it (latest-results, completion-status) — is untouched.
 */
const SEED_PRIOR_RUNS: ReadonlyArray<{
  suffix: string;
  status: TestConnectionStatus;
  requestedAt: string;
  completedAt: string;
  /** Which selected resources failed — index-based so it is provider-agnostic. */
  failedIndexes: readonly number[];
}> = [
  {
    suffix: 'prev-1',
    status: 'FAIL',
    requestedAt: '2026-05-28T09:12:00.000Z',
    completedAt: '2026-05-28T09:14:35.000Z',
    failedIndexes: [0],
  },
  {
    suffix: 'prev-2',
    status: 'SUCCESS',
    requestedAt: '2026-05-21T14:03:00.000Z',
    completedAt: '2026-05-21T14:08:24.000Z',
    failedIndexes: [],
  },
];

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
    .flatMap((project) => {
      const targetSourceId = project.targetSourceId as number;
      // Card-state fixture: idle means latest_version 404 — no runs at all.
      if (targetSourceId === TC_CARD_FIXTURE.idle) return [];

      const selected = testConnectionUnits(project);
      const results = (
        failedIndexes: readonly number[],
        failReasons: Readonly<Record<number, string>> = {},
      ): TestConnectionResourceResult[] =>
        selected.map((r, index) => {
          const failed = failedIndexes.includes(index);
          return {
            resource_id: r.resourceId,
            resource_type: r.type,
            status: failed ? 'FAIL' : 'SUCCESS',
            error_status: failed ? 'AUTH_FAIL' : null,
            guide: failed ? ERROR_GUIDES.AUTH_FAIL : null,
            agent_id: fallbackAgentId(index),
            ...(failed && failReasons[index] ? { fail_reason: failReasons[index] } : {}),
          };
        });

      const priorRuns = SEED_PRIOR_RUNS.map((run) => ({
        id: `tc-seed-${targetSourceId}-${run.suffix}`,
        target_source_id: targetSourceId,
        status: run.status,
        requested_at: run.requestedAt,
        completed_at: run.completedAt,
        requested_by: 'seed@pii-agent.dev',
        resource_results: results(run.failedIndexes),
      }));

      // Card-state fixture: accepted but never dispatched — zero results and every
      // schedule item in 2099. The wire projection reads it queued via the fixture id
      // (its requested_at is long past the live DISPATCH_MS window), so top-level
      // PENDING and all-PENDING agents hold forever.
      if (targetSourceId === TC_CARD_FIXTURE.queued) {
        const queuedJob: InternalTestConnectionJob = {
          id: `tc-seed-${targetSourceId}-queued`,
          target_source_id: targetSourceId,
          status: 'PENDING',
          requested_at: SEED_REQUESTED_AT,
          completed_at: null,
          requested_by: 'seed@pii-agent.dev',
          estimated_end_at: TC_FIXTURE_RUNNING_TAIL_AT,
          resource_results: [],
          resource_schedule: selected.map((r) => ({
            resource_id: r.resourceId,
            complete_at: TC_FIXTURE_RUNNING_TAIL_AT,
          })),
        };
        return [queuedJob, ...priorRuns];
      }

      // Card-state fixture: PENDING→FAIL — the run settled FAIL before any unit
      // reported. No schedule and no results, so the wire carries an empty agent
      // list: reported 0 — the card folds this into the generic fail copy (no
      // special no-report state, owner's call).
      if (targetSourceId === TC_CARD_FIXTURE.noReportFail) {
        return [
          {
            id: `tc-seed-${targetSourceId}-noreport`,
            target_source_id: targetSourceId,
            status: 'FAIL' as TestConnectionStatus,
            requested_at: SEED_REQUESTED_AT,
            completed_at: TC_FIXTURE_NO_REPORT_FAILED_AT,
            requested_by: 'seed@pii-agent.dev',
            resource_results: [],
            // 전면 실패 — 리소스에 닿기 전에 닫힌 실행은 run 사유만이 유일한 설명이다.
            fail_reason: 'TERRAFORM_NOT_APPLIED',
          },
          ...priorRuns,
        ];
      }

      // Card-state fixture: a run pinned mid-flight. The first units settled in the
      // past (results pre-filled so calculateJobStatus reuses them instead of rolling
      // Math.random), the tail settles in 2099 — the job stays PENDING forever.
      if (targetSourceId === TC_CARD_FIXTURE.running) {
        const settledCount = Math.min(2, selected.length);
        const running: InternalTestConnectionJob = {
          id: `tc-seed-${targetSourceId}-running`,
          target_source_id: targetSourceId,
          status: 'PENDING',
          requested_at: SEED_REQUESTED_AT,
          completed_at: null,
          requested_by: 'seed@pii-agent.dev',
          estimated_end_at: TC_FIXTURE_RUNNING_TAIL_AT,
          resource_results: results([]).slice(0, settledCount),
          resource_schedule: selected.map((r, index) => ({
            resource_id: r.resourceId,
            complete_at: index < settledCount ? SEED_REQUESTED_AT : TC_FIXTURE_RUNNING_TAIL_AT,
          })),
        };
        return [running, ...priorRuns];
      }

      // Card-state fixture 2103 flips the latest run to FAIL; everyone else seeds
      // the settled SUCCESS the per-step comment above describes.
      const failFixture = targetSourceId === TC_CARD_FIXTURE.fail;
      return [
        {
          id: `tc-seed-${targetSourceId}`,
          target_source_id: targetSourceId,
          status: (failFixture ? 'FAIL' : 'SUCCESS') as TestConnectionStatus,
          requested_at: SEED_REQUESTED_AT,
          completed_at: SEED_COMPLETED_AT,
          requested_by: 'seed@pii-agent.dev',
          // 실패 픽스처는 사유 접기 맵의 두 갈래를 함께 시딩한다 — 로그가 있는 실패
          // (SECRET_NOT_FOUND)와 유일한 무로그 실패(POD_CREATION_FAILED).
          resource_results: results(
            failFixture ? [0, 1] : [],
            failFixture ? { 0: 'SECRET_NOT_FOUND', 1: 'POD_CREATION_FAILED' } : {},
          ),
          ...(failFixture ? { fail_reason: 'CLUSTER_TEST_FAILED' } : {}),
        },
        ...priorRuns,
      ];
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
 * domain — there is no excluded-DB store here, so only the card-state fixture
 * (TC_CARD_FIXTURE.policyChanged) stands in for it: its policy "changed" at a
 * fixed timestamp, and any run completed before that reads the verdict.
 */
export const getCompletionStatus = (targetSourceId: number) => {
  const project = findProject(targetSourceId);
  const job = getLatestJob(targetSourceId);
  // 되돌리기보다 앞선 실행은 근거가 되지 못한다 — "연결 테스트부터 다시 진행"이라고 말한
  // 뒤이므로, 그 뒤에 실제로 끝난 실행만 성공으로 센다. completed_at 이 없는(아직 도는)
  // 실행은 어차피 SUCCESS 가 아니라 여기서 갈릴 일이 없다.
  // 시각은 파싱해서 비교한다. 문자열 비교는 밀리초 표기가 섞이면 뒤집힌다 — 이 저장소의
  // completed_at 은 `…00Z`(픽스처)와 `…00.000Z`(toISOString)가 함께 오고, 같은 초에서
  // `.`(0x2E) < `Z`(0x5A) 라 밀리초 없는 쪽이 더 나중으로 읽힌다.
  const rolledBackAt = project?.status.connectionTest.rolledBackAt;
  const rolledBackMs = rolledBackAt ? Date.parse(rolledBackAt) : NaN;
  const completedMs = job?.completed_at ? Date.parse(job.completed_at) : NaN;
  const supersededByRollback =
    Number.isFinite(rolledBackMs) && Number.isFinite(completedMs) && completedMs < rolledBackMs;
  const succeeded = job?.status === 'SUCCESS' && !supersededByRollback;
  // 완료 여부는 완료 승인 요청 PUT(confirmed:true)이 세팅하는 passedAt 으로 판별한다.
  // 테스트 성공만으로는 confirmed 가 아니다(승인 전 = LATEST_TEST_CONNECTION_SUCCESS).
  const confirmed = project?.status.connectionTest.passedAt != null;
  // 카드 상태 fixture(2105)만 갖는 정책 변경 시각 — 성공한 실행이 이 시각보다 앞서면
  // 재실행이 필요하다는 판정이 된다(재실행이 끝나면 자연히 success 로 돌아간다).
  const policyChangedAt =
    targetSourceId === TC_CARD_FIXTURE.policyChanged ? TC_FIXTURE_POLICY_UPDATED_AT : null;
  const policyChanged =
    policyChangedAt !== null &&
    succeeded &&
    !confirmed &&
    Number.isFinite(completedMs) &&
    completedMs < Date.parse(policyChangedAt);

  const status:
    | 'CONFIRMED'
    | 'LATEST_TEST_CONNECTION_SUCCESS'
    | 'TEST_CONNECTION_REQUIRED'
    | 'LOGICAL_DATABASE_RECENTLY_UPDATED' =
    succeeded && confirmed
      ? 'CONFIRMED'
      : policyChanged
        ? 'LOGICAL_DATABASE_RECENTLY_UPDATED'
        : succeeded
          ? 'LATEST_TEST_CONNECTION_SUCCESS'
          : 'TEST_CONNECTION_REQUIRED';

  return {
    target_source_id: targetSourceId,
    latest_test_connection_requested_at: job?.requested_at ?? WIRE_DATE_PLACEHOLDER,
    logical_database_updated_at: policyChangedAt ?? WIRE_DATE_PLACEHOLDER,
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
    const ct = project.status.connectionTest;
    const now = new Date().toISOString();
    if (confirmed) {
      // 완료 승인 — advance ONE step. Step 5→6 sets passedAt (the
      // test-connection-acknowledgment gate); Step 6→7 sets operationConfirmed.
      project.status.connectionTest = !ct.passedAt
        ? { ...ct, passedAt: now }
        : { ...ct, operationConfirmed: true };
    } else {
      // 되돌아가기 — 확인 자체를 지운다. 계약의 `confirmed` 는 불리언 하나라 "한 계단만
      // 뒤로"를 담을 수 없고, false 로 되돌린다는 것은 완료 확인이 없던 상태라는 뜻이다.
      // passedAt 이 WAITING_CONNECTION_TEST 게이트이므로 둘을 함께 비워야 5단계로 간다 —
      // Step 6 은 operationConfirmed 가 애초에 false 라 결과가 같고, Step 7 의 "연결 테스트
      // 재실행"이 대화상자가 약속한 5단계에 내린다(한 계단씩이면 6단계에 멈췄다).
      //
      // rolledBackAt 을 함께 찍는다: 이것이 없으면 5단계가 되돌리기 전의 성공한 실행을 그대로
      // 읽어 완료 승인 버튼을 곧바로 열어 준다 — "연결 테스트부터 다시 진행해요"라고 말해 놓고
      // 한 번도 다시 돌리지 않은 채 6단계로 돌아갈 수 있었다. 실행 이력은 지우지 않는다:
      // 무엇을 테스트했는지는 기록으로 남아야 하고, 여기서 필요한 것은 "그 실행이 되돌리기보다
      // 앞선다"는 사실 하나뿐이다.
      project.status.connectionTest = {
        ...ct,
        passedAt: undefined,
        operationConfirmed: false,
        rolledBackAt: now,
      };
    }
    project.processStatus = getCurrentStep(project.status);
  }
  return {
    target_source_id: targetSourceId,
    confirmed,
    confirmed_at: new Date().toISOString(),
  };
};
