import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #14 POST /pass/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/{pipelineId}/restart
// The body is OPTIONAL upstream (omitted = restart from the first non-DONE task),
// so an absent/unparseable body forwards as `undefined` — the transport then omits
// both the body and Content-Type instead of sending a literal `null`.
export const POST = withOrchestratorProxy(async (req, ctx) => {
  const body = (await req.json().catch(() => undefined)) as unknown;
  return bff.pipeline.restart(ctx.params.targetSourceId, ctx.params.pipelineId, body);
});
