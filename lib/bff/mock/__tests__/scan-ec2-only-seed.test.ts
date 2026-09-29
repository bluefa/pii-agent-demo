import { beforeEach, describe, expect, it } from 'vitest';
import { mockAws } from '@/lib/bff/mock/aws';
import { mockConfirm } from '@/lib/bff/mock/confirm';
import { mockScan } from '@/lib/bff/mock/scan';
import { resetStore } from '@/lib/mock-store';

const EC2_ONLY_TARGET_SOURCE_ID = '1035';
const EC2_ONLY_COUNTS = { AWS_EC2_INSTANCE: 10 };

/**
 * The account holds EC2 instances only: the scan finished, the candidate list is empty,
 * and the EC2 search still answers. Step 1 has to offer the search-add flow from here.
 */
describe('EC2-only seed target (1035)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('has a finished scan that counted EC2 instances and no DB type', async () => {
    const response = await mockScan.getStatus(EC2_ONLY_TARGET_SOURCE_ID);
    expect(await response.json()).toMatchObject({
      scan_status: 'SUCCESS',
      resource_count_by_resource_type: EC2_ONLY_COUNTS,
    });
  });

  // The scan history modal opens from the same screen — the same scan must not read
  // as 590 DB instances there.
  it('reports the same counts in the scan history', async () => {
    const response = await mockScan.getHistory(EC2_ONLY_TARGET_SOURCE_ID, { limit: 10, offset: 0 });
    expect(await response.json()).toMatchObject({
      content: [{ resource_count_by_resource_type: EC2_ONLY_COUNTS }],
    });
  });

  it('answers /resources with 200 and no candidate', async () => {
    const response = await mockConfirm.getResources(EC2_ONLY_TARGET_SOURCE_ID);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ resources: [], total_count: 0 });
  });

  it('finds instances through the EC2 search', async () => {
    const response = await mockAws.searchEc2Resources(EC2_ONLY_TARGET_SOURCE_ID, 'i-0a1', 100);
    expect(await response.json()).toMatchObject({ total_count: 2 });
  });
});
