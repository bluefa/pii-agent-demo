import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';

const IS_MOCK = process.env.USE_MOCK_DATA !== 'false';

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
  return { roleArn: null, status: 'UNVERIFIED' as const };
}

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  // Mock 모드: project에서 serviceCode 조회 → legacy settings API
  if (IS_MOCK) {
    const resolved = resolveProject(parsed.value, requestId);
    if (!resolved.ok) return problemResponse(resolved.problem);

    const response = await client.services.settings.aws.get(resolved.project.serviceCode);
    if (!response.ok) return response;

    const legacy = await response.json() as LegacyAwsSettings;
    return NextResponse.json({
      executionRole: { roleArn: null, status: 'UNVERIFIED' },
      scanRole: toAwsRoleInfo(legacy.scanRole),
    });
  }

  // BFF 모드: BFF가 targetSourceId로 직접 처리
  // TODO: BFF settings API 연동 시 구현
  return NextResponse.json({
    executionRole: { roleArn: null, status: 'UNVERIFIED' },
    scanRole: { roleArn: null, status: 'UNVERIFIED' },
  });
}, { expectedDuration: '150ms' });
