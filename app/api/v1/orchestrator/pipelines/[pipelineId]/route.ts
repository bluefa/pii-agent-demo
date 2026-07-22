import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #4 GET /pass/api/v1/orchestrator/pipelines/{pipelineId}
export const GET = withOrchestratorProxy(async (_req, ctx) =>
  bff.pipeline.detail(ctx.params.pipelineId),
);
