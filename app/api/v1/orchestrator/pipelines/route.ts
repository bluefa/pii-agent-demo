import { withOrchestratorProxy } from '@/app/api/_lib/orchestrator';
import { bff } from '@/lib/bff/client';

// #3 GET /pass/api/v1/orchestrator/pipelines?status&provider&period&page&size&sort
// The raw search string passes through so repeatable `sort` order/duplicates survive.
export const GET = withOrchestratorProxy(async (req) =>
  bff.pipeline.list(new URL(req.url).searchParams.toString()),
);
