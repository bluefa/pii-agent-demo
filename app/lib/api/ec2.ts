/**
 * EC2 instance search — client API + the wire↔domain boundary for the
 * "EC2 인스턴스 추가" flow (AWS Step 1).
 *
 * UI consumes ONLY `Ec2Instance`. The wire shape stays here, as in
 * `app/lib/api/idc.ts`, so a response change touches this mapper and nothing else.
 *
 * CONTRACT GAP: `GET …/ec2-resources/search` is owner-provided and absent from
 * docs/swagger/install-v1.yaml, so there is no generated type to import. The wire
 * type below is local and read defensively (every field may be missing or null);
 * the route owns the matching zod schema.
 */

import { fetchInfraJson } from '@/app/lib/api/infra';

/** One EC2 instance the latest scan found. */
export interface Ec2Instance {
  /** AWS instance id (`i-…`) — the resource id sent in the approval request. */
  instanceId: string;
  privateIpAddress: string;
  privateDnsName: string;
}

interface Ec2SearchWire {
  resources?: {
    resource_id?: string | null;
    resource_name?: string | null;
    resource_type?: string | null;
    metadata?: {
      private_dns_name?: string | null;
      private_ip_address?: string | null;
    } | null;
  }[] | null;
}

/** Default page size the search modal shows (the endpoint accepts 1..100). */
export const EC2_SEARCH_LIMIT = 5;

/**
 * GET …/ec2-resources/search — instances whose id starts with `query`.
 *
 * Rows without an instance id are dropped: the id IS the identity this flow adds,
 * so a row missing one cannot be turned into an integration target.
 */
export const searchEc2Instances = async (
  targetSourceId: number,
  query: string,
  opts?: { limit?: number; signal?: AbortSignal },
): Promise<Ec2Instance[]> => {
  const params = new URLSearchParams({
    query,
    limit: String(opts?.limit ?? EC2_SEARCH_LIMIT),
  });
  const res = await fetchInfraJson<Ec2SearchWire>(
    `/target-sources/${targetSourceId}/ec2-resources/search?${params}`,
    opts?.signal ? { signal: opts.signal } : undefined,
  );
  return (res.resources ?? []).flatMap((item) => {
    const instanceId = item.resource_id ?? '';
    if (!instanceId) return [];
    return [{
      instanceId,
      privateIpAddress: item.metadata?.private_ip_address ?? '',
      privateDnsName: item.metadata?.private_dns_name ?? item.resource_name ?? '',
    }];
  });
};
