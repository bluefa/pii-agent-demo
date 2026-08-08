import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { AWS_ROLE_ARN_RE } from '@/lib/constants/aws-role';
import { schemas } from '@/lib/generated/install-v1';

// REAL contract — PUT /install/v1/target-sources/{id}/aws/terraform-execution-role (upsert).
// AwsAssumeRoleUpsertRequest { roleArn } → AwsAssumeRoleUpsertResponse (camel wire).
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as { roleArn?: unknown } | null;
  const roleArn = typeof body?.roleArn === 'string' ? body.roleArn.trim() : '';
  if (!AWS_ROLE_ARN_RE.test(roleArn)) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'roleArn이 IAM Role ARN 형식에 맞지 않습니다.', requestId),
    );
  }

  const data = await bff.ops.putRole(parsed.value, 'execution', roleArn);
  return NextResponse.json(schemas.AwsAssumeRoleUpsertResponse.parse(data));
});
