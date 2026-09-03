import { withOrchestratorProxy, withRequester } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #14 POST /pass/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/{pipelineId}/restart
// The body is OPTIONAL upstream (omitted = restart from the first non-DONE task),
// so an absent/unparseable body forwards as `undefined` — the transport then omits
// both the body and Content-Type instead of sending a literal `null`. Once the
// requester is stamped the body exists (`{ requested_by }`), which upstream reads
// the same way: no `from_sequence` = default resume point, and the person who
// pressed restart becomes the run's requester (RequestContext.orInheritFrom).
export const POST = withOrchestratorProxy(async (req, ctx) => {
  const body = (await req.json().catch(() => undefined)) as unknown;
  return bff.pipeline.restart(ctx.params.targetSourceId, ctx.params.pipelineId, await withRequester(body));
});
