import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #2 GET /integration/api/v1/orchestrator/pipelines/statistics?period=1h|1d|7d
export const GET = withOrchestratorProxy(async (req) => {
  const period = new URL(req.url).searchParams.get('period') ?? undefined;
  return bff.pipeline.statistics(period);
});
