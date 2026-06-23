import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeTestConnectionConfirmationResult } from '@/lib/test-connection-response';

// PUT …/test-connection-acknowledgment — completion confirmation set/rollback.
// Body `{ confirmed }` is passed through as-authored (ADR-019 D3; `confirmed`
// is casing-invariant). confirmed:true = 완료 승인; false = 연결 테스트 재실행 rollback.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = await request.json().catch(() => ({}));
  const data = await bff.confirm.updateTestConnectionConfirmation(parsed.value, {
    confirmed: body.confirmed === true,
  });
  return NextResponse.json(normalizeTestConnectionConfirmationResult(camelCaseKeys(data)));
});
