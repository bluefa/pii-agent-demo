import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §11.
// GET /pipeline-manager/airflow-host?databaseUri={uri} → 200 string (the DAG's URL).
// The body is a bare JSON string, not an object: nothing to reshape, no case boundary.
export const GET = withV1(async (request, { requestId }) => {
  const databaseUri = new URL(request.url).searchParams.get('databaseUri');
  if (!databaseUri) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', 'databaseUri 쿼리 파라미터가 필요합니다.', requestId),
    );
  }

  const url = await bff.ops.getAirflowHost(databaseUri);
  return NextResponse.json(url);
});
