import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// GET /idc/nlb/table — array of NlbTableResponse (camelCase ON THE WIRE per
// swagger). Raw passthrough; the IDC mapper (app/lib/api/idc.ts) owns the
// wire→domain conversion (ADR-019 D6 carve-out).
export const GET = withV1(async () => {
  return NextResponse.json(await bff.idc.getNlbTable());
});
