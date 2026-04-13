import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { getCurrentUser } from '@/lib/mock-data';
import type { GcpServiceAccountInfo } from '@/app/api/_lib/v1-types';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProject(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const user = getCurrentUser();
  if (!user) {
    return problemResponse(createProblem('UNAUTHORIZED', '인증이 필요합니다.', requestId));
  }
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(resolved.project.serviceCode)) {
    return problemResponse(createProblem('FORBIDDEN', '접근 권한이 없습니다.', requestId));
  }

  const gcpProjectId = resolved.project.gcpProjectId ?? `gcp-project-${parsed.value}`;

  const response: GcpServiceAccountInfo = {
    gcpProjectId,
    status: 'VALID',
    lastVerifiedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
});
