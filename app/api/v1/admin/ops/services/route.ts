import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §6.
// GET /admin/ops/services → OpsServiceSummary[].
export const GET = withV1(async () => NextResponse.json(await bff.ops.getServices()));
