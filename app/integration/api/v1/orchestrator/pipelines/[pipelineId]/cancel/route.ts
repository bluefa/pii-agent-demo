import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #6 POST /integration/api/v1/orchestrator/pipelines/{pipelineId}/cancel
export const POST = withOrchestratorProxy(async (_req, ctx) =>
  bff.pipeline.cancel(ctx.params.pipelineId),
);
