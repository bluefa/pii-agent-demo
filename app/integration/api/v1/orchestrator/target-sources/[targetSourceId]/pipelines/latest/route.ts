import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #8 GET /integration/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/latest (204 when empty)
export const GET = withOrchestratorProxy(async (_req, ctx) =>
  bff.pipeline.latestByTarget(ctx.params.targetSourceId),
);
