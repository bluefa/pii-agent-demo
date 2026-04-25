import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

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

  const projectResponse = await client.projects.get(String(parsed.value));
  if (!projectResponse.ok) return projectResponse;

  const project = await projectResponse.json() as { serviceCode?: string };
  if (!project.serviceCode) {
    return problemResponse(createProblem(
      'INTERNAL_ERROR',
      '프로젝트 serviceCode를 확인할 수 없습니다.',
      requestId,
    ));
  }

  const settingsResponse = await client.services.settings.aws.get(project.serviceCode);
  if (!settingsResponse.ok) return settingsResponse;

  const legacy = await settingsResponse.json() as LegacyAwsSettings;

  let executionRole: { roleArn: string | null; status: 'VALID' | 'UNVERIFIED' } = {
    roleArn: null,
    status: 'UNVERIFIED',
  };

  // 설치 상태에서 executionRoleArn을 읽어 settings 응답에 보강한다.
  // 설치 조회 실패 시 기본값(UNVERIFIED) 유지 — 설치는 settings의 부수 정보.
  try {
    const installation = await bff.aws.getInstallationStatus(parsed.value);
    if (installation.tfExecutionRoleArn) {
      executionRole = { roleArn: installation.tfExecutionRoleArn, status: 'VALID' };
    }
  } catch (e) {
    if (!(e instanceof BffError)) throw e;
    console.warn(`[aws settings] installation status failed: ${e.code}`);
  }

  return NextResponse.json({
    executionRole,
    scanRole: toAwsRoleInfo(legacy.scanRole),
  });
}, { expectedDuration: '150ms' });
