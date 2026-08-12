import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mock-data', () => ({
  getCurrentUser: vi.fn(),
  getProjectByTargetSourceId: vi.fn(),
}));
vi.mock('@/lib/mock-scan', () => ({
  getLatestScanForProject: vi.fn(),
  getScanHistory: vi.fn(),
}));

import { mockScan } from '@/lib/bff/mock/scan';
import * as mockData from '@/lib/mock-data';
import * as scanFns from '@/lib/mock-scan';
import type { ScanHistory, User } from '@/lib/types';

const TARGET_SOURCE_ID = 1001;

/** One finished SUCCESS row, `agoMs` milliseconds old. */
const seedHistory = (agoMs: number): void => {
  const row: ScanHistory = {
    id: 'h1',
    targetSourceId: TARGET_SOURCE_ID,
    scanId: 'scan-7',
    version: 3,
    provider: 'AWS',
    status: 'SUCCESS',
    startedAt: new Date(Date.now() - agoMs - 60_000).toISOString(),
    completedAt: new Date(Date.now() - agoMs).toISOString(),
    duration: 60,
    result: { totalFound: 1, byResourceType: [] },
    resourceCountBefore: 0,
    resourceCountAfter: 1,
    addedResourceIds: [],
  };
  vi.mocked(scanFns.getScanHistory).mockReturnValue({ history: [row], total: 1 });
};

const latestScanBody = async (): Promise<Record<string, unknown>> => {
  const response = await mockScan.getStatus(String(TARGET_SOURCE_ID));
  return response.json();
};

/**
 * The mock reproduces the BFF's aggregation tail: a scan reports SUCCESS a beat
 * before its counts are readable. Without it the finalizing state the UI draws
 * ("스캔 마무리 중") is unreachable in demo mode.
 */
describe('mockScan.getStatus aggregation window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const admin: User = {
      id: 'u1',
      knoxId: 'admin.u1',
      name: '관리자',
      email: 'admin@example.com',
      role: 'ADMIN',
      serviceCodePermissions: [],
    };
    vi.mocked(mockData.getCurrentUser).mockResolvedValue(admin);
    vi.mocked(mockData.getProjectByTargetSourceId).mockReturnValue({
      serviceCode: 'SVC',
    } as ReturnType<typeof mockData.getProjectByTargetSourceId>);
    vi.mocked(scanFns.getLatestScanForProject).mockReturnValue(undefined);
  });

  it('answers SUCCESS with null counts for the first 3s after completion', async () => {
    seedHistory(500);
    const body = await latestScanBody();

    expect(body.scan_status).toBe('SUCCESS');
    expect(body.resource_count_by_resource_type).toBeNull();
  });

  it('answers the counts once the window has passed', async () => {
    seedHistory(4_000);
    const body = await latestScanBody();

    expect(body.scan_status).toBe('SUCCESS');
    expect(Object.keys(body.resource_count_by_resource_type as object).length).toBeGreaterThan(0);
  });
});
