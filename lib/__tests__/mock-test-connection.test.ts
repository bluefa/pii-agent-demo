import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestConnectionJob,
  getLatestJob,
  getJobHistory,
  hasPendingJob,
  clearJobHistory,
  toJobResponse,
  toVersionResultResponse,
  toLatestResultSummaries,
  getCompletionStatus,
  setConfirmation,
} from '@/lib/mock-test-connection';
import { getStore, resetStore } from '@/lib/mock-store';
import type { Project } from '@/lib/types';

// ===== Fixtures =====

const AWS_PROJECT_ID = 'proj-1';
const AWS_TARGET_SOURCE_ID = 1006;
const GCP_PROJECT_ID = 'gcp-proj-1';
const GCP_TARGET_SOURCE_ID = 1002;
const NONEXISTENT_TARGET_SOURCE_ID = 99999;

const FIXED_DATE = new Date('2026-04-23T00:00:00.000Z');
const FIXED_ISO = FIXED_DATE.toISOString();

// proj-1 은 seed 에서 모든 리소스가 isSelected:false. 테스트용으로 앞 2개를 select.
// Seed 오염 방지를 위해 structuredClone 으로 deep copy 후 store 내 슬롯 교체.
const SELECTED_RESOURCE_COUNT = 2;

const getAwsProjectWithSelectedResources = (): Project => {
  const store = getStore();
  const idx = store.projects.findIndex((p) => p.id === AWS_PROJECT_ID);
  if (idx === -1) throw new Error(`${AWS_PROJECT_ID} not found`);
  const cloned = structuredClone(store.projects[idx]);
  cloned.resources.slice(0, SELECTED_RESOURCE_COUNT).forEach((r) => {
    r.isSelected = true;
  });
  store.projects[idx] = cloned;
  return cloned;
};

const getGcpProjectClone = (): Project => {
  const store = getStore();
  const idx = store.projects.findIndex((p) => p.id === GCP_PROJECT_ID);
  if (idx === -1) throw new Error(`${GCP_PROJECT_ID} not found`);
  const cloned = structuredClone(store.projects[idx]);
  store.projects[idx] = cloned;
  return cloned;
};

describe('mock-test-connection behavior lock-in', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createTestConnectionJob', () => {
    it('PENDING job 을 생성하고 store 에 저장', () => {
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      expect(selectedCount).toBeGreaterThan(0);

      const job = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'tester@example.com');

      expect(job.target_source_id).toBe(AWS_TARGET_SOURCE_ID);
      expect(job.status).toBe('PENDING');
      expect(job.requested_at).toBe(FIXED_ISO);
      expect(job.completed_at).toBeNull();
      expect(job.requested_by).toBe('tester@example.com');
      expect(job.resource_results).toEqual([]);
      expect(job.id).toMatch(/^tc-\d+-[a-z0-9]+$/);

      const store = getStore();
      // filter by target — the store also carries the per-step SUCCESS seed.
      const jobs = store.testConnectionJobs.filter((j) => j.target_source_id === AWS_TARGET_SOURCE_ID);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(job.id);
    });

    it('selected 리소스가 없어도 job 생성 (빈 schedule)', () => {
      const project = getAwsProjectWithSelectedResources();
      project.resources = []; // selected 없음

      const job = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'tester@example.com');
      expect(job.status).toBe('PENDING');
      expect(job.resource_results).toEqual([]);
    });

    it('두번 호출 시 jobs 에 2개 저장', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      vi.setSystemTime(new Date('2026-04-23T00:00:01.000Z'));
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'b@example.com');

      const store = getStore();
      const jobs = store.testConnectionJobs.filter((j) => j.target_source_id === AWS_TARGET_SOURCE_ID);
      expect(jobs).toHaveLength(2);
    });
  });

  describe('getLatestJob', () => {
    it('job 이 없는 project → undefined', () => {
      expect(getLatestJob(AWS_TARGET_SOURCE_ID)).toBeUndefined();
    });

    it('최근 requested_at 순으로 첫번째 job 반환', () => {
      const project = getAwsProjectWithSelectedResources();
      const first = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      vi.setSystemTime(new Date('2026-04-23T00:00:05.000Z'));
      const second = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'b@example.com');

      const latest = getLatestJob(AWS_TARGET_SOURCE_ID);
      expect(latest?.id).toBe(second.id);
      expect(latest?.id).not.toBe(first.id);
    });

    it('다른 project 의 job 은 무시', () => {
      const awsProject = getAwsProjectWithSelectedResources();
      createTestConnectionJob(awsProject, AWS_TARGET_SOURCE_ID, 'a@example.com');

      expect(getLatestJob(GCP_TARGET_SOURCE_ID)).toBeUndefined();
    });

    it('PENDING job 은 시간 진행 시 SUCCESS 로 전환 (Math.random=0)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      // 모든 리소스가 5초 간격으로 스케줄 → 전체 완료 시점까지 시간 진행
      const advanceMs = selectedCount * 5000 + 1000;
      vi.setSystemTime(new Date(FIXED_DATE.getTime() + advanceMs));

      const latest = getLatestJob(AWS_TARGET_SOURCE_ID);
      expect(latest?.status).toBe('SUCCESS');
      expect(latest?.completed_at).toBeDefined();
      expect(latest?.resource_results).toHaveLength(selectedCount);
      latest?.resource_results.forEach((r) => {
        expect(r.status).toBe('SUCCESS');
        expect(r.error_status).toBeNull();
        expect(r.guide).toBeNull();
      });
    });

    it('Math.random=0.9 → FAIL (리소스 일부 FAIL → 전체 FAIL)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      const advanceMs = selectedCount * 5000 + 1000;
      vi.setSystemTime(new Date(FIXED_DATE.getTime() + advanceMs));

      const latest = getLatestJob(AWS_TARGET_SOURCE_ID);
      expect(latest?.status).toBe('FAIL');
      expect(latest?.completed_at).toBeDefined();
      latest?.resource_results.forEach((r) => {
        expect(r.status).toBe('FAIL');
        expect(r.error_status).toBe('PERMISSION_DENIED');
        expect(r.guide).toBeTruthy();
      });
    });

    it('project 가 삭제되면 job 은 FAIL 로 전환', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      // project 제거
      const store = getStore();
      store.projects = store.projects.filter((p) => p.id !== AWS_PROJECT_ID);

      const latest = getLatestJob(AWS_TARGET_SOURCE_ID);
      expect(latest?.status).toBe('FAIL');
      expect(latest?.resource_results).toEqual([]);
    });
  });

  describe('getJobHistory', () => {
    it('job 이 없는 project → 빈 content + total 0', () => {
      const result = getJobHistory(AWS_TARGET_SOURCE_ID, 0, 10);
      expect(result).toEqual({ content: [], total: 0 });
    });

    it('최신순 정렬 + 페이지네이션', () => {
      const project = getAwsProjectWithSelectedResources();
      for (let i = 0; i < 5; i += 1) {
        vi.setSystemTime(new Date(FIXED_DATE.getTime() + i * 1000));
        createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, `user-${i}@example.com`);
      }

      const page0 = getJobHistory(AWS_TARGET_SOURCE_ID, 0, 2);
      expect(page0.total).toBe(5);
      expect(page0.content).toHaveLength(2);
      expect(page0.content[0].requested_by).toBe('user-4@example.com');
      expect(page0.content[1].requested_by).toBe('user-3@example.com');

      const page1 = getJobHistory(AWS_TARGET_SOURCE_ID, 1, 2);
      expect(page1.content).toHaveLength(2);
      expect(page1.content[0].requested_by).toBe('user-2@example.com');

      const page2 = getJobHistory(AWS_TARGET_SOURCE_ID, 2, 2);
      expect(page2.content).toHaveLength(1);
      expect(page2.content[0].requested_by).toBe('user-0@example.com');
    });

    it('다른 project 의 job 은 포함 안됨', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      const sduHistory = getJobHistory(GCP_TARGET_SOURCE_ID, 0, 10);
      expect(sduHistory).toEqual({ content: [], total: 0 });
    });
  });

  describe('hasPendingJob', () => {
    it('job 없으면 false', () => {
      expect(hasPendingJob(AWS_TARGET_SOURCE_ID)).toBe(false);
    });

    it('PENDING job 있으면 true', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');
      expect(hasPendingJob(AWS_TARGET_SOURCE_ID)).toBe(true);
    });

    it('모든 job 이 SUCCESS 면 false', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      vi.setSystemTime(new Date(FIXED_DATE.getTime() + selectedCount * 5000 + 1000));

      // 시간 진행 후 getLatestJob 호출로 status 재계산 → SUCCESS 고정
      getLatestJob(AWS_TARGET_SOURCE_ID);

      expect(hasPendingJob(AWS_TARGET_SOURCE_ID)).toBe(false);
    });

    it('다른 project 의 PENDING job 은 무시', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      expect(hasPendingJob(GCP_TARGET_SOURCE_ID)).toBe(false);
    });
  });

  describe('clearJobHistory', () => {
    it('해당 project 의 jobs 만 삭제', () => {
      const awsProject = getAwsProjectWithSelectedResources();
      const sduProject = getGcpProjectClone();

      createTestConnectionJob(awsProject, AWS_TARGET_SOURCE_ID, 'a@example.com');
      createTestConnectionJob(sduProject, GCP_TARGET_SOURCE_ID, 'b@example.com');

      clearJobHistory(AWS_TARGET_SOURCE_ID);

      const store = getStore();
      // AWS jobs gone; GCP job retained (store also carries the per-step seed).
      expect(store.testConnectionJobs.filter((j) => j.target_source_id === AWS_TARGET_SOURCE_ID)).toHaveLength(0);
      expect(store.testConnectionJobs.filter((j) => j.target_source_id === GCP_TARGET_SOURCE_ID)).toHaveLength(1);
    });

    it('job 없는 project → no-op', () => {
      expect(() => clearJobHistory(NONEXISTENT_TARGET_SOURCE_ID)).not.toThrow();
    });
  });

  describe('toJobResponse', () => {
    it('내부 필드 (projectId, estimated_end_at, resource_schedule) 제외', () => {
      const project = getAwsProjectWithSelectedResources();
      const job = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      const response = toJobResponse(job);

      expect(response).toEqual({
        id: job.id,
        target_source_id: AWS_TARGET_SOURCE_ID,
        status: 'PENDING',
        requested_at: job.requested_at,
        completed_at: null,
        requested_by: 'a@example.com',
        resource_results: [],
      });
      expect(response).not.toHaveProperty('projectId');
      expect(response).not.toHaveProperty('estimated_end_at');
      expect(response).not.toHaveProperty('resource_schedule');
    });
  });

  // ===== ADR-019 /install/v1 wire projections =====

  describe('toVersionResultResponse', () => {
    it('PENDING job → connection_status RUNNING + version cursor', () => {
      const project = getAwsProjectWithSelectedResources();
      const job = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      const wire = toVersionResultResponse(job);

      expect(wire.target_source_id).toBe(AWS_TARGET_SOURCE_ID);
      expect(wire.connection_status).toBe('RUNNING');
      expect(wire.test_connection_version).toBe(1);
      expect(wire.requested_at).toBe(FIXED_ISO);
      // incomplete job → deterministic date-time placeholder (valid format:date-time, not '')
      expect(wire.completed_at).toBe('1970-01-01T00:00:00.000Z');
      expect(wire.test_connection_agent_results).toEqual([]);
    });

    it('SUCCESS job → per-agent results in wire shape', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');
      vi.setSystemTime(new Date(FIXED_DATE.getTime() + selectedCount * 5000 + 1000));

      const job = getLatestJob(AWS_TARGET_SOURCE_ID);
      const wire = toVersionResultResponse(job!);

      expect(wire.connection_status).toBe('SUCCESS');
      expect(wire.test_connection_agent_results).toHaveLength(selectedCount);
      wire.test_connection_agent_results.forEach((agent) => {
        expect(agent.connection_status).toBe('SUCCESS');
        expect(agent.agent_id).toMatch(/^agent-/);
        expect(agent.resource_id).toBeTruthy();
        expect(agent.gcp_region).toBe('');
        expect(agent.database_uri_list.length).toBeGreaterThan(0);
      });
    });
  });

  describe('toLatestResultSummaries', () => {
    it('non-success latest run → empty array', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');
      expect(toLatestResultSummaries(AWS_TARGET_SOURCE_ID)).toEqual([]);
    });

    it('SUCCESS run → per-resource logical-DB counts', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');
      vi.setSystemTime(new Date(FIXED_DATE.getTime() + selectedCount * 5000 + 1000));
      getLatestJob(AWS_TARGET_SOURCE_ID);

      const summaries = toLatestResultSummaries(AWS_TARGET_SOURCE_ID);
      expect(summaries).toHaveLength(selectedCount);
      summaries.forEach((s) => {
        expect(s.resource_id).toBeTruthy();
        expect(s.agent_id).toMatch(/^agent-/);
        expect(s.logical_database_count).toBeGreaterThanOrEqual(0);
        expect(s.excluded_logical_database_count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getCompletionStatus / setConfirmation', () => {
    it('no passed run → TEST_CONNECTION_REQUIRED', () => {
      getAwsProjectWithSelectedResources();
      const status = getCompletionStatus(AWS_TARGET_SOURCE_ID);
      expect(status.test_connection_status).toBe('TEST_CONNECTION_REQUIRED');
      expect(status.latest_test_connection_success).toBe(false);
      expect(status.test_connection_confirmed).toBe(false);
    });

    it('passed run, unconfirmed → LATEST_TEST_CONNECTION_SUCCESS; confirm → CONFIRMED; rollback → back', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');
      vi.setSystemTime(new Date(FIXED_DATE.getTime() + selectedCount * 5000 + 1000));
      getLatestJob(AWS_TARGET_SOURCE_ID); // settle to PASSED

      expect(getCompletionStatus(AWS_TARGET_SOURCE_ID).test_connection_status)
        .toBe('LATEST_TEST_CONNECTION_SUCCESS');

      const confirmed = setConfirmation(AWS_TARGET_SOURCE_ID, true);
      expect(confirmed.confirmed).toBe(true);
      expect(confirmed.target_source_id).toBe(AWS_TARGET_SOURCE_ID);
      expect(getCompletionStatus(AWS_TARGET_SOURCE_ID).test_connection_status).toBe('CONFIRMED');

      setConfirmation(AWS_TARGET_SOURCE_ID, false);
      expect(getCompletionStatus(AWS_TARGET_SOURCE_ID).test_connection_status)
        .toBe('LATEST_TEST_CONNECTION_SUCCESS');
    });
  });

  // Per-step seed: Step 5/6/7 targets must have a coherent completed-SUCCESS
  // result present at store init (otherwise the pages 404). resetStore() in
  // beforeEach re-seeds on the next getStore().
  describe('per-step seed', () => {
    const STEP5_TARGET = 1010; // WAITING_CONNECTION_TEST (AWS)
    const STEP6_TARGET = 1011; // CONNECTION_VERIFIED
    const STEP7_TARGET = 1012; // INSTALLATION_COMPLETE

    it('Step 5 target → SUCCESS job + non-empty summaries + LATEST_TEST_CONNECTION_SUCCESS', () => {
      const job = getLatestJob(STEP5_TARGET);
      expect(job?.status).toBe('SUCCESS');
      expect(job?.resource_results.length).toBeGreaterThan(0);

      const wire = toVersionResultResponse(job!);
      expect(wire.connection_status).toBe('SUCCESS');
      expect(wire.test_connection_agent_results.length).toBeGreaterThan(0);

      expect(toLatestResultSummaries(STEP5_TARGET).length).toBeGreaterThan(0);

      const completion = getCompletionStatus(STEP5_TARGET);
      expect(completion.latest_test_connection_success).toBe(true);
      expect(completion.test_connection_status).toBe('LATEST_TEST_CONNECTION_SUCCESS');
      expect(completion.test_connection_confirmed).toBe(false);
    });

    it('Step 6 + Step 7 targets → SUCCESS job + completion-status CONFIRMED', () => {
      for (const target of [STEP6_TARGET, STEP7_TARGET]) {
        expect(getLatestJob(target)?.status).toBe('SUCCESS');
        const completion = getCompletionStatus(target);
        expect(completion.latest_test_connection_success).toBe(true);
        expect(completion.test_connection_confirmed).toBe(true);
        expect(completion.test_connection_status).toBe('CONFIRMED');
      }
    });

    it('deterministic: seed timestamps are fixed (no Date.now())', () => {
      const job = getLatestJob(STEP5_TARGET);
      expect(job?.requested_at).toBe('2026-06-01T00:00:00.000Z');
      expect(job?.completed_at).toBe('2026-06-01T00:00:20.000Z');
    });
  });
});
