import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mock-data', () => ({
  getCurrentUser: vi.fn(),
  getProjectByTargetSourceId: vi.fn(),
}));
vi.mock('@/lib/mock-scan', () => ({
  getScanHistory: vi.fn(),
}));

import { mockConfirm } from '@/lib/bff/mock/confirm';
import * as mockData from '@/lib/mock-data';
import * as scanFns from '@/lib/mock-scan';
import type { Project, ScanHistory, User } from '@/lib/types';

const TARGET_SOURCE_ID = 1001;

const historyRow = (status: ScanHistory['status']): ScanHistory => ({
  id: `h-${status}`,
  targetSourceId: TARGET_SOURCE_ID,
  scanId: 'scan-7',
  version: 3,
  provider: 'AWS',
  status,
  startedAt: new Date(Date.now() - 120_000).toISOString(),
  completedAt: new Date(Date.now() - 60_000).toISOString(),
  duration: 60,
  result: { totalFound: 1, byResourceType: [] },
  resourceCountBefore: 0,
  resourceCountAfter: 1,
  addedResourceIds: [],
});

const seedHistory = (rows: ScanHistory[]): void => {
  vi.mocked(scanFns.getScanHistory).mockReturnValue({ history: rows, total: rows.length });
};

/**
 * 실 BFF 는 스캔 결과가 없는 타겟소스의 `GET /resources` 에 404 로 답한다(오너 확인
 * 2026-08-23). 목이 시드 리소스를 무조건 돌려주는 동안에는 1단계가 스캔 없이 표를 그렸고,
 * 게이트가 무엇을 막는지 데모로 확인할 수 없었다 — 목은 그 사실을 만들 수 있어야 한다.
 */
describe('mockConfirm.getResources — 스캔 결과 없음은 404', () => {
  beforeEach(() => {
    vi.mocked(mockData.getCurrentUser).mockReturnValue({ id: 'u1' } as User);
    vi.mocked(mockData.getProjectByTargetSourceId).mockReturnValue({
      targetSourceId: TARGET_SOURCE_ID,
      cloudProvider: 'AWS',
      resources: [
        {
          id: 'r-1',
          type: 'AWS_DB_INSTANCE',
          resourceId: 'arn:aws:rds:ap-northeast-2:1:db:one',
          resourceName: 'one',
          databaseType: 'MYSQL',
          connectionStatus: 'PENDING',
          isSelected: true,
          integrationCategory: 'TARGET',
          region: 'ap-northeast-2',
        },
      ],
    } as unknown as Project);
  });

  it('성공한 스캔이 한 번도 없으면 404', async () => {
    seedHistory([]);
    const response = await mockConfirm.getResources(String(TARGET_SOURCE_ID));
    expect(response.status).toBe(404);
  });

  it('마지막 스캔이 실패여도 직전 성공이 있으면 결과는 남아 있다', async () => {
    seedHistory([historyRow('FAIL'), historyRow('SUCCESS')]);
    const response = await mockConfirm.getResources(String(TARGET_SOURCE_ID));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { resources: unknown[] };
    expect(body.resources).toHaveLength(1);
  });

  // 대조군 — 실패 이력만 있으면 결과도 없다.
  it('실패 이력뿐이면 404', async () => {
    seedHistory([historyRow('FAIL')]);
    const response = await mockConfirm.getResources(String(TARGET_SOURCE_ID));
    expect(response.status).toBe(404);
  });
});
