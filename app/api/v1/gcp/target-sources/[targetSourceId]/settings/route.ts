import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProject(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const gcpProjectId = resolved.project.gcpProjectId ?? `gcp-project-${parsed.value}`;

  return NextResponse.json({
    gcpProjectId,
    scanServiceAccount: `pii-scan-sa@${gcpProjectId}.iam.gserviceaccount.com`,
    terraformExecutionServiceAccount: `pii-tf-sa@${gcpProjectId}.iam.gserviceaccount.com`,
  });
});
