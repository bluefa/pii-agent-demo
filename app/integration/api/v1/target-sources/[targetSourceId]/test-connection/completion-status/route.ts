import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeTestConnectionCompletionStatus } from '@/lib/test-connection-response';

// GET …/test-connection/completion-status — gates the Step 5 완료 승인 요청 CTA.
// Single casing boundary (ADR-019 D1): camelCaseKeys + normalizer.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getTestConnectionCompletionStatus(parsed.value);
  return NextResponse.json(normalizeTestConnectionCompletionStatus(camelCaseKeys(data)));
}, { expectedDuration: '50ms' });
