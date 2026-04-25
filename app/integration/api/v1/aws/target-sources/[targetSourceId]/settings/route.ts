import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import type { ServiceSettingsAwsResponse } from '@/lib/bff/types/services';

function toAwsRoleInfo(role: ServiceSettingsAwsResponse['scanRole']) {
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

  const projectResponse = await bff.projects.get(parsed.value);
  const serviceCode = projectResponse.project?.serviceCode;
  if (!serviceCode) {
    return problemResponse(createProblem(
      'INTERNAL_ERROR',
      '프로젝트 serviceCode를 확인할 수 없습니다.',
      requestId,
    ));
  }

  const settings = await bff.services.settings.aws.get(serviceCode);

  let executionRole: { roleArn: string | null; status: 'VALID' | 'UNVERIFIED' } = {
    roleArn: null,
    status: 'UNVERIFIED',
  };

  // Augment settings with executionRoleArn from installation status.
  // Installation lookup failure falls back to UNVERIFIED — installation
  // is auxiliary info, not a hard dependency for settings.
  try {
    const installation = await bff.aws.getInstallationStatus(parsed.value);
    if (installation.tfExecutionRoleArn) {
      executionRole = { roleArn: installation.tfExecutionRoleArn, status: 'VALID' };
    }
  } catch (e) {
    if (!(e instanceof BffError)) throw e;
    console.warn(`[aws settings] installation status failed: ${e.code} (${e.status}) ${e.message}`);
  }

  return NextResponse.json({
    executionRole,
    scanRole: toAwsRoleInfo(settings.scanRole),
  });
}, { expectedDuration: '150ms' });
