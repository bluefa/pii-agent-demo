import { beforeEach, describe, expect, it } from 'vitest';
import { mockPipeline, resetPipelineMockStore } from '@/lib/bff/mock/pipeline';
import type {
  LivePipelineStatistics,
  OrchestratorErrorBody,
  PipelineDetail,
  PipelineStatistics,
  PipelineSummary,
  RecipePreview,
  TaskCatalogResponse,
  TaskDetail,
  TerraformJobResultDetail,
  TerraformJobStateDetail,
} from '@/lib/pipeline/types';

const asError = (body: unknown): OrchestratorErrorBody => body as OrchestratorErrorBody;

describe('mockPipeline (in-memory orchestrator)', () => {
  beforeEach(() => {
    resetPipelineMockStore();
  });

  describe('statistics', () => {
    it('computes live statistics from the fixtures', () => {
      const { status, body } = mockPipeline.liveStatistics();
      const live = body as LivePipelineStatistics;
      expect(status).toBe(200);
      // 130 (SDU) + 128 + 125 RUNNING, 129 PENDING; one IN_PROGRESS terraform task per running pipeline.
      expect(live.running_pipeline_count).toBe(3);
      expect(live.pending_pipeline_count).toBe(1);
      expect(live.in_progress_terraform_task_count).toBe(3);
      expect(live.active_claim_count).toBe(3);
      expect(live.terraform_slot_cap).toBeGreaterThan(0);
    });

    it('computes period statistics within the window', () => {
      const week = mockPipeline.statistics('7d').body as PipelineStatistics;
      expect(week.total_count).toBe(9);
      expect(week.done_count).toBe(2);
      expect(week.failed_count).toBe(2); // 124 (JOB_FAILED) + 131 (dispatch-call failure)
      expect(week.cancelled_count).toBe(1);
      expect(week.running_count).toBe(3);
      expect(week.pending_count).toBe(1);

      // 1h window only catches the freshly-anchored PENDING + three RUNNING
      // (incl. the SDU demo pipeline 130); the older FAILED 131 falls outside it.
      const hour = mockPipeline.statistics('1h').body as PipelineStatistics;
      expect(hour.total_count).toBe(4);
      expect(hour.pending_count).toBe(1);
      expect(hour.running_count).toBe(3);
    });

    it('rejects a missing / invalid period', () => {
      expect(mockPipeline.statistics(undefined).status).toBe(400);
      expect(asError(mockPipeline.statistics(undefined).body).code).toBe('ORCHESTRATION_INVALID_PARAMETER');
      expect(asError(mockPipeline.statistics('90d').body).code).toBe('ORCHESTRATION_INVALID_STATISTICS_PERIOD');
    });
  });

  describe('detail / task detail', () => {
    it('404s an unknown pipeline', () => {
      const res = mockPipeline.detail('99999');
      expect(res.status).toBe(404);
      expect(asError(res.body).code).toBe('ORCHESTRATION_PIPELINE_NOT_FOUND');
    });

    it('derives current_* coordinates on the running pipeline (0-based sequences)', () => {
      const detail = mockPipeline.detail('128').body as PipelineDetail;
      expect(detail.status).toBe('RUNNING');
      expect(detail.total_task_count).toBe(7);
      expect(detail.tasks[0].sequence).toBe(0); // upstream sequences are 0-based
      expect(detail.current_task_sequence).toBe(4); // first IN_PROGRESS/READY
      expect(detail.final_task_sequence).toBe(6);
      expect(detail.current_max_fail_count).toBe(1);
    });

    it('exposes the CONDITION_CHECK render surface (NETWORK_READY_V1)', () => {
      // task_id = pipelineId * 100 + sequence → 128 * 100 + 2 (0-based)
      const task = mockPipeline.taskDetail('128', '12802').body as TaskDetail;
      expect(task.kind).toBe('CONDITION_CHECK');
      expect(task.effective_execution_timeout).toBeNull();
      expect(task.definition).not.toBeNull();
      expect(task.definition).not.toHaveProperty('dispatch_api');
      expect(task.definition).not.toHaveProperty('result_api');
      expect(task.attempts).toHaveLength(2);
      expect(task.attempts[0].check).not.toBeNull();
    });

    it('404s a task that belongs to another pipeline', () => {
      const res = mockPipeline.taskDetail('128', '99999');
      expect(res.status).toBe(404);
      expect(asError(res.body).code).toBe('ORCHESTRATION_TASK_NOT_FOUND');
    });

    it('inlines per-job results/states + failure_detail on the FAILED terraform task', () => {
      const task = mockPipeline.taskDetail('124', '12401').body as TaskDetail;
      expect(task.status).toBe('FAILED');
      expect(task.attempts).toHaveLength(2);
      const [a1, a2] = task.attempts;
      // #1 timed out before terminal → states only, no results.
      expect(a1.error_code).toBe('CALL_TIMEOUT');
      expect(a1.terraform_results).toHaveLength(0);
      expect(a1.job_states).toHaveLength(3);
      // #2 judged with a FAILED job → results recorded, failure_detail names it.
      expect(a2.terraform_results).toHaveLength(3);
      expect(a2.job_states).toHaveLength(3);
      expect(a2.failure_detail).toContain('1027');
    });

    it('surfaces failure_detail with zero job rows on a dispatch-call failure (131)', () => {
      // task_id = 131 * 100 + 1 → the APPLY step whose dispatch call failed on every attempt.
      const task = mockPipeline.taskDetail('131', '13101').body as TaskDetail;
      expect(task.status).toBe('FAILED');
      expect(task.error_code).toBe('CHECK_ERROR');
      expect(task.attempts).toHaveLength(2);
      for (const a of task.attempts) {
        // The dispatch call failed before any job id came back → no synth, zero jobs; the
        // cause lives only in failure_detail (AttemptDetail's "실패 원인" fallback).
        expect(a.terraform_results).toHaveLength(0);
        expect(a.job_states).toHaveLength(0);
        expect(a.failure_detail).toContain('503 Service Unavailable');
      }
    });
  });

  describe('per-job result / state (#5a / #5b)', () => {
    const result = (t: string, n: string, job: string): TerraformJobResultDetail =>
      mockPipeline.jobResult('124', t, n, job).body as TerraformJobResultDetail;
    const state = (t: string, n: string, job: string): TerraformJobStateDetail =>
      mockPipeline.jobState('124', t, n, job).body as TerraformJobStateDetail;

    it('returns a stored, truncated FAILED log body', () => {
      const r = result('12401', '2', '1027');
      expect(r.source).toBe('stored');
      expect(r.succeeded).toBe(false);
      expect(r.truncated).toBe(true);
      expect(r.content).toContain('Error acquiring the state lock');
      expect(r.created_at).not.toBeNull();
    });

    it('distinguishes a live fetch miss (content null + fetch_error, created_at null)', () => {
      const res = mockPipeline.jobResult('124', '12401', '1', '1021');
      expect(res.status).toBe(200); // NOT a 404 — the row exists as a pointer
      const r = res.body as TerraformJobResultDetail;
      expect(r.source).toBe('live');
      expect(r.created_at).toBeNull();
      expect(r.content).toBeNull();
      expect(r.fetch_error).not.toBeNull();
    });

    it('distinguishes a stored pointer row (content null, no fetch_error)', () => {
      const r = result('12401', '2', '1028');
      expect(r.content).toBeNull();
      expect(r.fetch_error).toBeNull();
      expect(r.source).toBe('stored');
    });

    it('404s an unknown job result but 200s with a valid task', () => {
      const res = mockPipeline.jobResult('124', '12401', '2', '9999');
      expect(res.status).toBe(404);
      expect(asError(res.body).code).toBe('ORCHESTRATION_TERRAFORM_RESULT_NOT_FOUND');
    });

    it('404s the result/state endpoints for an unknown pipeline or task', () => {
      expect(mockPipeline.jobResult('99999', '12401', '2', '1027').status).toBe(404);
      expect(asError(mockPipeline.jobResult('99999', '12401', '2', '1027').body).code).toBe('ORCHESTRATION_PIPELINE_NOT_FOUND');
      expect(asError(mockPipeline.jobState('124', '99999', '2', '1027').body).code).toBe('ORCHESTRATION_TASK_NOT_FOUND');
    });

    it('returns the raw last_response for a terminal job, null when the last poll errored', () => {
      const failed = state('12401', '2', '1027');
      expect(failed.last_state).toBe('FAILED');
      expect(failed.last_response).toContain('mock forced failure');

      const errored = state('12401', '1', '1021');
      expect(errored.last_state).toBeNull();
      expect(errored.last_response).toBeNull();
      expect(errored.last_error).not.toBeNull();
    });
  });

  describe('synthesized terraform jobs (tasks without hand-written fixtures)', () => {
    it('every terraform attempt surfaces a Terraform Job list', () => {
      // 12800 = 128 seq0 AWS_SERVICE_PLAN_V1 (DONE) — no fixtures → synthesized.
      const task = mockPipeline.taskDetail('128', '12800').body as TaskDetail;
      expect(task.kind).toBe('TERRAFORM_JOB');
      expect(task.attempts[0].terraform_results.length).toBeGreaterThan(0);
      expect(task.attempts[0].job_states.length).toBeGreaterThan(0);
    });

    it('resolves a log body + state for a synthesized job (200, not 404)', () => {
      const task = mockPipeline.taskDetail('128', '12800').body as TaskDetail;
      const jobId = task.attempts[0].job_states[0].job_id;
      const res = mockPipeline.jobResult('128', '12800', '1', jobId);
      expect(res.status).toBe(200);
      expect((res.body as TerraformJobResultDetail).content).toBeTruthy();
      const st = mockPipeline.jobState('128', '12800', '1', jobId);
      expect(st.status).toBe(200);
      expect((st.body as TerraformJobStateDetail).last_state).not.toBeNull();
    });

    it('does NOT synthesize jobs for CONDITION_CHECK attempts', () => {
      const cond = mockPipeline.taskDetail('128', '12802').body as TaskDetail;
      expect(cond.kind).toBe('CONDITION_CHECK');
      expect(cond.attempts.every((a) => a.terraform_results.length === 0 && a.job_states.length === 0)).toBe(true);
    });

    it('404s a job id that is not part of the attempt', () => {
      const res = mockPipeline.jobResult('128', '12800', '1', '404040');
      expect(res.status).toBe(404);
    });
  });

  describe('latest by target', () => {
    it('returns 204 when a target has no runs', () => {
      const res = mockPipeline.latestByTarget('1010');
      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it('returns the newest run for a target', () => {
      const summary = mockPipeline.latestByTarget('1002').body as PipelineSummary;
      expect(summary.pipeline_id).toBe(129); // PENDING (newest) over the older DONE 126
    });
  });

  describe('preview', () => {
    it('returns the AWS install recipe steps with the condition-check step', () => {
      const preview = mockPipeline.preview('1006', 'INSTALL').body as RecipePreview;
      expect(preview.recipe_definition).toBe('AWS_INSTALL_V1');
      expect(preview.provider).toBe('AWS');
      expect(preview.steps).toHaveLength(7);
      expect(preview.steps[2].task_definition).toBe('NETWORK_READY_V1');
      expect(preview.steps[2].kind).toBe('CONDITION_CHECK');
      expect(preview.steps[2].definition).not.toHaveProperty('dispatch_api');
    });

    it('rejects CUSTOM with UNSUPPORTED_RECIPE and unknown target with 503', () => {
      expect(asError(mockPipeline.preview('1006', 'CUSTOM').body).code).toBe('ORCHESTRATION_UNSUPPORTED_RECIPE');
      const unknown = mockPipeline.preview('99999', 'INSTALL');
      expect(unknown.status).toBe(503);
      expect(asError(unknown.body).code).toBe('ORCHESTRATION_PROVIDER_LOOKUP_FAILED');
    });
  });

  describe('create', () => {
    it('409s when the target already has an active run', () => {
      const res = mockPipeline.create('1006', { type: 'INSTALL' }); // 1006 has RUNNING 128
      expect(res.status).toBe(409);
      expect(asError(res.body).code).toBe('ORCHESTRATION_PIPELINE_ALREADY_ACTIVE');
    });

    it('creates a PENDING pipeline with the first task READY when idle', () => {
      const created = mockPipeline.create('1008', { type: 'INSTALL' }).body as PipelineDetail; // 1008 CANCELLED (terminal)
      expect(created.status).toBe('PENDING');
      expect(created.recipe_definition).toBe('AWS_INSTALL_V1');
      expect(created.cloud_provider).toBe('AWS');
      expect(created.tasks[0].status).toBe('READY');
      expect(created.tasks.slice(1).every((t) => t.status === 'BLOCKED')).toBe(true);

      // now the target has an active run → a second create conflicts.
      expect(mockPipeline.create('1008', { type: 'INSTALL' }).status).toBe(409);
    });

    it('rejects a missing type and a CUSTOM type', () => {
      expect(asError(mockPipeline.create('1008', {}).body).code).toBe('ORCHESTRATION_PIPELINE_TYPE_REQUIRED');
      expect(asError(mockPipeline.create('1008', { type: 'CUSTOM' }).body).code).toBe('ORCHESTRATION_UNSUPPORTED_RECIPE');
    });
  });

  describe('createCustom', () => {
    it('rejects empty tasks, unknown names, and provider mismatch in order', () => {
      expect(asError(mockPipeline.createCustom('1008', { tasks: [] }).body).code)
        .toBe('ORCHESTRATION_CUSTOM_TASKS_REQUIRED');
      expect(asError(mockPipeline.createCustom('1008', { tasks: [{ name: 'NOPE_V1' }] }).body).code)
        .toBe('ORCHESTRATION_UNKNOWN_TASK');
      // 1008 is AWS; a GCP task definition mismatches the target provider.
      expect(asError(mockPipeline.createCustom('1008', { tasks: [{ name: 'GCP_BDC_APPLY_V1' }] }).body).code)
        .toBe('ORCHESTRATION_TASK_PROVIDER_MISMATCH');
    });

    it('creates a CUSTOM pipeline from catalog tasks (null recipe, 0-based sequence)', () => {
      const created = mockPipeline.createCustom('1008', {
        tasks: [{ name: 'AWS_SERVICE_PLAN_V1', description: '수동 재실행' }],
      }).body as PipelineDetail;
      expect(created.type).toBe('CUSTOM');
      expect(created.recipe_definition).toBeNull(); // upstream: PipelinePlan.custom → no catalog recipe
      expect(created.tasks[0].sequence).toBe(0);
      expect(created.tasks[0].description).toBe('수동 재실행');
      expect(created.tasks[0].status).toBe('READY');
    });
  });

  describe('cancel (two-phase)', () => {
    it('PENDING → immediate CANCELLED with cascaded tasks', () => {
      const cancelled = mockPipeline.cancel('129').body as PipelineDetail;
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancel_requested).toBe(false);
      expect(cancelled.tasks.every((t) => t.status === 'CANCELLED')).toBe(true);
    });

    it('leased RUNNING → cancel_requested only, status stays RUNNING', () => {
      const requested = mockPipeline.cancel('128').body as PipelineDetail;
      expect(requested.status).toBe('RUNNING');
      expect(requested.cancel_requested).toBe(true);
      // the in-progress task is NOT cascaded on a cooperative cancel.
      expect(requested.tasks.some((t) => t.status === 'IN_PROGRESS')).toBe(true);
    });

    it('is idempotent on a terminal pipeline', () => {
      const res = mockPipeline.cancel('124'); // FAILED
      expect(res.status).toBe(200);
      expect((res.body as PipelineDetail).status).toBe('FAILED');
    });
  });

  describe('task definitions', () => {
    it('filters the catalog by provider', () => {
      const all = mockPipeline.taskDefinitions(undefined).body as TaskCatalogResponse;
      expect(all.task_definitions).toHaveLength(25);
      const aws = mockPipeline.taskDefinitions('AWS').body as TaskCatalogResponse;
      expect(aws.task_definitions).toHaveLength(10); // 9 terraform + NETWORK_READY_V1
      expect(aws.task_definitions.every((d) => d.provider === 'AWS')).toBe(true);
    });

    it('rejects an invalid provider', () => {
      expect(mockPipeline.taskDefinitions('ORACLE').status).toBe(400);
    });
  });
});
