import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #1 GET /integration/api/v1/orchestrator/pipelines/statistics/live
export const GET = withOrchestratorProxy(async () => bff.pipeline.liveStatistics());
