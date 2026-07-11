import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { z } from 'zod';

// GET /idc/nlb/table — ADR-019 zod-codegen. Array of NlbTableResponse (camelCase
// ON THE WIRE per swagger). Route validates; no casing transform.
export const GET = withV1(async () => {
  const data = await bff.idc.getNlbTable();
  return NextResponse.json(z.array(schemas.NlbTableResponse).parse(data));
});
