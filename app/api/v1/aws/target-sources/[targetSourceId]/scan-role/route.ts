import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { AWS_ROLE_NAME_RE } from '@/lib/constants/aws-role';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §3.
// PUT …/aws/scan-role { role_name } → { role_arn } (server composes the ARN).
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as { role_name?: unknown } | null;
  const roleName = typeof body?.role_name === 'string' ? body.role_name.trim() : '';
  if (!AWS_ROLE_NAME_RE.test(roleName)) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'role_name이 IAM Role 이름 규칙에 맞지 않습니다.', requestId),
    );
  }

  const data = await bff.ops.putRole(parsed.value, 'scan', roleName);
  return NextResponse.json(data);
});
