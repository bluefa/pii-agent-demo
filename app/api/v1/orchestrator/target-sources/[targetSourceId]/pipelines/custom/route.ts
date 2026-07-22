import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #11 POST /pass/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/custom
export const POST = withOrchestratorProxy(async (req, ctx) => {
  const body = (await req.json().catch(() => null)) as unknown;
  return bff.pipeline.createCustom(ctx.params.targetSourceId, body);
});
