import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';

/**
 * GET …/target-sources/{id}/ec2-resources/search?query={instanceIdPrefix}&limit={1..100}
 *
 * CONTRACT GAP: the upstream endpoint is owner-provided and is not in
 * docs/swagger/install-v1.yaml yet, so `lib/generated/install-v1` carries no schema for
 * it. The schema below is local and holds the same LOOSE posture the generated ones do
 * (every field optional, objects passthrough, nullable-tolerant): an unexpected extra
 * field or a null must never fail the whole search. Delete it once the swagger lands.
 */
const Ec2SearchResponse = z
  .object({
    resources: z
      .array(
        z
          .object({
            resource_id: z.string().nullish(),
            resource_name: z.string().nullish(),
            resource_type: z.string().nullish(),
            metadata: z
              .object({
                private_dns_name: z.string().nullish(),
                private_ip_address: z.string().nullish(),
                scan_version: z.number().nullish(),
              })
              .partial()
              .passthrough()
              .nullish(),
          })
          .partial()
          .passthrough(),
      )
      .nullish(),
    total_count: z.number().nullish(),
  })
  .partial()
  .passthrough();

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 100;

export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') ?? '';
  const requested = Number(searchParams.get('limit'));
  const limit =
    Number.isFinite(requested) && requested >= 1
      ? Math.min(Math.trunc(requested), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const data = await bff.aws.searchEc2Resources(parsed.value, query, limit);
  return NextResponse.json(Ec2SearchResponse.parse(data));
});
