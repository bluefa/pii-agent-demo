import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeApprovedIntegration } from '@/lib/approval-bff';

const createNotFoundProblem = (requestId: string): NextResponse =>
  NextResponse.json({
    type: 'https://pii-agent.dev/problems/APPROVED_INTEGRATION_NOT_FOUND',
    title: 'Not Found',
    status: 404,
    detail: '승인된 연동 정보가 없습니다.',
    code: 'APPROVED_INTEGRATION_NOT_FOUND',
    retriable: false,
    requestId,
  }, {
    status: 404,
    headers: { 'content-type': 'application/problem+json' },
  });

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  try {
    const data = await bff.confirm.getApprovedIntegration(parsed.value);
    return NextResponse.json(normalizeApprovedIntegration(data));
  } catch (error) {
    if (error instanceof BffError && error.status === 404) {
      return createNotFoundProblem(requestId);
    }
    throw error;
  }
});
