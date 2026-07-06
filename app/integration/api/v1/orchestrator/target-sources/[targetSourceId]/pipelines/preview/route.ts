import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #9 GET /integration/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/preview?type=INSTALL|DELETE
export const GET = withOrchestratorProxy(async (req, ctx) => {
  const type = new URL(req.url).searchParams.get('type') ?? undefined;
  return bff.pipeline.preview(ctx.params.targetSourceId, type);
});
