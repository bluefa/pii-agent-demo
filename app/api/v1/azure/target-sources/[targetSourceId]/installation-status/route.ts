import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// swagger AzureInstallationStatusResponse embeds vm_installation per resource,
// so this is a single GET (the legacy vm/installation-status merge is removed —
// azure vm/* endpoints are absent from install-v1.yaml).
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const raw = await bff.azure.getInstallationStatus(parsed.value);
  return NextResponse.json(schemas.AzureInstallationStatusResponse.parse(raw));
});
