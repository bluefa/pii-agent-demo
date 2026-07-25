import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #14 POST /pass/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/{pipelineId}/restart
// Body is optional upstream (omitted = restart from the first non-DONE task).
export const POST = withOrchestratorProxy(async (req, ctx) => {
  const body = (await req.json().catch(() => null)) as unknown;
  return bff.pipeline.restart(ctx.params.targetSourceId, ctx.params.pipelineId, body);
});
