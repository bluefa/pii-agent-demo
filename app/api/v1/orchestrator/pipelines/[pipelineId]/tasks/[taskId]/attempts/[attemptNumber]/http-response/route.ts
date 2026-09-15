import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #5c GET …/pipelines/{pipelineId}/tasks/{taskId}/attempts/{attemptNumber}/http-response
export const GET = withOrchestratorProxy(async (_req, ctx) =>
  bff.pipeline.attemptHttpResponse(ctx.params.pipelineId, ctx.params.taskId, ctx.params.attemptNumber),
);
