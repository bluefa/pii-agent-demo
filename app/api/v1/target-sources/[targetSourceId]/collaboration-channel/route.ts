import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §4 (BE PR #8891, ahead of the
// swagger drop). Snake wire passed through verbatim: the reader in
// lib/types/collaboration-channel.ts owns the casing boundary on both surfaces. The
// contract's PUT is not called from the Jira console (owner 2026-09-30: retry instead),
// so this file serves GET only; the retry lives in ./retry/route.ts.

/** `?watcher_page` / `?watcher_size` forwarded as integers when they parse; anything
 *  else is simply not sent, and an out-of-range value is the upstream's 400 to give. */
const intParam = (value: string | null): number | undefined =>
  value !== null && /^-?\d+$/.test(value) ? Number(value) : undefined;

// GET …/collaboration-channel?watcher_page&watcher_size → always 200 (NONE when no
// ticket was ever created), with one page of failed watchers.
export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);
  const search = new URL(request.url).searchParams;
  return NextResponse.json(
    await bff.ops.getCollaborationChannel(parsed.value, {
      watcherPage: intParam(search.get('watcher_page')),
      watcherSize: intParam(search.get('watcher_size')),
    }),
  );
});
