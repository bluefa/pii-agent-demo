import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #7 GET /pass/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines?page&size&sort
export const GET = withOrchestratorProxy(async (req, ctx) =>
  bff.pipeline.listByTarget(ctx.params.targetSourceId, new URL(req.url).searchParams.toString()),
);

// #10 POST /pass/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines
export const POST = withOrchestratorProxy(async (req, ctx) => {
  const body = (await req.json().catch(() => null)) as unknown;
  return bff.pipeline.create(ctx.params.targetSourceId, body);
});
