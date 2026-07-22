import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #12 GET /pass/api/v1/orchestrator/task-definitions?provider
export const GET = withOrchestratorProxy(async (req) => {
  const provider = new URL(req.url).searchParams.get('provider') ?? undefined;
  return bff.pipeline.taskDefinitions(provider);
});
