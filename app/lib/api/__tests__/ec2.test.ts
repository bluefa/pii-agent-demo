// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchEc2Instances } from '@/app/lib/api/ec2';

const respondWith = (body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

afterEach(() => vi.restoreAllMocks());

/**
 * The search response is a contract gap (no generated schema), so every field is read
 * defensively here rather than trusted. These pin the two decisions that matter: the
 * instance id is required, and the private address fields are the ones the UI consumes.
 */
describe('searchEc2Instances', () => {
  it('maps the metadata fields the flow consumes', async () => {
    respondWith({
      resources: [
        {
          resource_id: 'i-0a1b2c3d4e5f67890',
          resource_name: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
          resource_type: 'AWS_EC2_INSTANCE',
          metadata: {
            private_dns_name: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
            private_ip_address: '10.10.1.24',
            scan_version: 12,
          },
        },
      ],
      total_count: 1,
    });

    const [instance] = await searchEc2Instances(1801, 'i-0a');

    expect(instance).toEqual({
      instanceId: 'i-0a1b2c3d4e5f67890',
      privateIpAddress: '10.10.1.24',
      privateDnsName: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
    });
  });

  it('drops rows with no instance id and tolerates a null metadata block', async () => {
    respondWith({
      resources: [
        { resource_id: null, metadata: { private_ip_address: '10.0.0.1' } },
        { resource_id: 'i-0b73d5a91e8c246f0', metadata: null },
      ],
    });

    const results = await searchEc2Instances(1801, 'i-0');

    expect(results).toHaveLength(1);
    expect(results[0].instanceId).toBe('i-0b73d5a91e8c246f0');
    expect(results[0].privateIpAddress).toBe('');
  });

  it('asks for the requested prefix and page size', async () => {
    const fetchSpy = respondWith({ resources: [] });

    await searchEc2Instances(1801, 'i-0a', { limit: 5 });

    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain('/target-sources/1801/ec2-resources/search');
    expect(url).toContain('query=i-0a');
    expect(url).toContain('limit=5');
  });
});
