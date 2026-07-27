import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §6.
// GET /admin/ops/services/{serviceCode} → OpsServiceDetail.
export const GET = withV1(async (_request, { params }) => {
  const data = await bff.ops.getService(String(params.serviceCode));
  return NextResponse.json(data);
});
