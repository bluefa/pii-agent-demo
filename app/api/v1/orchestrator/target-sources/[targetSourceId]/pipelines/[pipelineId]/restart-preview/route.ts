import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #13 GET /pass/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/{pipelineId}/restart-preview?from_sequence=
export const GET = withOrchestratorProxy(async (req, ctx) => {
  const fromSequence = new URL(req.url).searchParams.get('from_sequence') ?? undefined;
  return bff.pipeline.restartPreview(ctx.params.targetSourceId, ctx.params.pipelineId, fromSequence);
});
