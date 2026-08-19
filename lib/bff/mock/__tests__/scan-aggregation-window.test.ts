import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mock-data', () => ({
  getCurrentUser: vi.fn(),
  getProjectByTargetSourceId: vi.fn(),
}));
// Only the two store readers are stubbed — isSavingWindow is the predicate under
// test, so it stays real. Stubbing it would make these assertions tautological.
vi.mock('@/lib/mock-scan', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/mock-scan')>()),
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

const historyRowBody = async (): Promise<Record<string, unknown>> => {
  const response = await mockScan.getHistory(String(TARGET_SOURCE_ID), { limit: 10, offset: 0 });
  const page = (await response.json()) as { content: Record<string, unknown>[] };
  return page.content[0];
};

/**
 * The mock reproduces the BFF's saving tail: SCANNING → SAVING → SUCCESS. Between
 * discovery ending and the totals being written the job reports SAVING with a full
 * progress bar and no counts; only SUCCESS carries the numbers. Without this window
 * the state the UI draws ("스캔 마무리 중") is unreachable in demo mode.
 */
describe('mockScan saving window', () => {
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

  it('answers SAVING with no counts for the first 3s after discovery ends', async () => {
    seedHistory(500);
    const body = await latestScanBody();

    expect(body.scan_status).toBe('SAVING');
    expect(body.resource_count_by_resource_type).toBeNull();
    // Every resource type is scanned by now — the bar is full while the write runs.
    expect(body.scan_progress).toBe(100);
  });

  it('answers SUCCESS with the counts once the window has passed', async () => {
    seedHistory(4_000);
    const body = await latestScanBody();

    expect(body.scan_status).toBe('SUCCESS');
    expect(Object.keys(body.resource_count_by_resource_type as object).length).toBeGreaterThan(0);
  });

  // The card and the history table share a screen: one row cannot read 마무리 중 in
  // one and 성공 with numbers in the other for the same three seconds.
  it('reports the same row as SAVING in the history page', async () => {
    seedHistory(500);
    const row = await historyRowBody();

    expect(row.scan_status).toBe('SAVING');
    expect(row.resource_count_by_resource_type).toBeNull();
  });

  it('reports the settled row as SUCCESS in the history page', async () => {
    seedHistory(4_000);
    const row = await historyRowBody();

    expect(row.scan_status).toBe('SUCCESS');
    expect(Object.keys(row.resource_count_by_resource_type as object).length).toBeGreaterThan(0);
  });
});
