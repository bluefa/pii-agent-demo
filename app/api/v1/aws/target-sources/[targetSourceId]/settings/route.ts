import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';
import { getProjectById } from '@/lib/mock-data';

interface LegacyRoleInfo {
  registered: boolean;
  roleArn?: string;
  lastVerifiedAt?: string;
  status?: string;
}

interface LegacyAwsSettings {
  accountId?: string;
  scanRole: LegacyRoleInfo;
  guide?: unknown;
}

function toAwsRoleInfo(role: LegacyRoleInfo) {
  if (role.registered && role.roleArn) {
    return {
      roleArn: role.roleArn,
      status: role.status === 'NOT_VERIFIED' ? 'UNVERIFIED' : (role.status ?? 'UNVERIFIED'),
      ...(role.lastVerifiedAt && { lastVerifiedAt: role.lastVerifiedAt }),
    };
  }
  return { roleArn: '', status: 'UNVERIFIED' as const };
}

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const project = getProjectById(resolved.projectId);
  if (!project) {
    return problemResponse(createProblem(
      'TARGET_SOURCE_NOT_FOUND',
      `targetSourceId ${parsed.value}에 해당하는 프로젝트를 찾을 수 없습니다.`,
      requestId,
    ));
  }

  const response = await client.services.settings.aws.get(project.serviceCode);
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyAwsSettings;

  return NextResponse.json({
    executionRole: { roleArn: '', status: 'UNVERIFIED' },
    scanRole: toAwsRoleInfo(legacy.scanRole),
  });
}, { expectedDuration: '150ms' });
