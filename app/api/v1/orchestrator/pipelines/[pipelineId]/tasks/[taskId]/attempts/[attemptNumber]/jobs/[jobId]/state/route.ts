import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #5b GET …/pipelines/{pipelineId}/tasks/{taskId}/attempts/{attemptNumber}/jobs/{jobId}/state
export const GET = withOrchestratorProxy(async (_req, ctx) =>
  bff.pipeline.jobState(
    ctx.params.pipelineId,
    ctx.params.taskId,
    ctx.params.attemptNumber,
    ctx.params.jobId,
  ),
);
