import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';

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

  const resolved = resolveProject(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.services.settings.aws.get(resolved.project.serviceCode);
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyAwsSettings;

  return NextResponse.json({
    executionRole: { roleArn: '', status: 'UNVERIFIED' },
    scanRole: toAwsRoleInfo(legacy.scanRole),
  });
}, { expectedDuration: '150ms', errorFormat: 'nested' });
