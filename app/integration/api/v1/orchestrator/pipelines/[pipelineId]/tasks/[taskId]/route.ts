import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #5 GET /integration/api/v1/orchestrator/pipelines/{pipelineId}/tasks/{taskId}
export const GET = withOrchestratorProxy(async (_req, ctx) =>
  bff.pipeline.taskDetail(ctx.params.pipelineId, ctx.params.taskId),
);
