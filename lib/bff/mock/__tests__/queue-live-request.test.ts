import { beforeEach, describe, expect, it } from 'vitest';
import { mockConfirm } from '@/lib/bff/mock/confirm';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';
import { resetStore } from '@/lib/mock-store';

/** The EC2-only seed target: step 1, no request yet, nowhere in the queue fixtures. */
const TARGET_SOURCE_ID = 1035;

const request = {
  resources: [
    {
      resource_id: 'i-0a1b2c3d4e5f67890',
      resource_type: 'AWS_EC2_INSTANCE',
      integration_category: 'NO_INSTALL_NEEDED',
      selected: true,
      metadata: { provider: 'AWS', database_type: 'mysql', host: '10.10.1.24', port: 3306 },
    },
  ],
};

const pendingIds = async (): Promise<number[]> => {
  const res = await mockTaskQueue.getTargetSourcesPage({ confirmStatus: 'PENDING', page: 0, size: 100 });
  const body = (await res.json()) as { content: { targetSourceId: number }[] };
  return body.content.map((row) => row.targetSourceId);
};

const header = async (): Promise<unknown> => {
  const res = await mockTaskQueue.getTargetSourcesPage({ targetSourceId: TARGET_SOURCE_ID, page: 0, size: 1 });
  const body = (await res.json()) as { content: unknown[] };
  return body.content[0];
};

/**
 * The 연동 요청 큐 read a fixed fixture, so a request made on the user screen a minute ago
 * was neither listed under 승인 대기 nor resolvable as the P3 header — the admin could not
 * approve what the user had just submitted.
 */
describe('연동 요청 큐 — a request made through the user flow', () => {
  beforeEach(() => {
    resetStore();
  });

  it('is absent before the request and listed under 승인 대기 after it', async () => {
    expect(await pendingIds()).not.toContain(TARGET_SOURCE_ID);
    expect(await header()).toMatchObject({ targetSourceId: TARGET_SOURCE_ID, confirmStatus: 'NO_REQUEST' });

    const submitted = await mockConfirm.createApprovalRequest(String(TARGET_SOURCE_ID), request);
    expect(submitted.status).toBe(200);

    expect(await pendingIds()).toContain(TARGET_SOURCE_ID);
    expect(await header()).toMatchObject({
      targetSourceId: TARGET_SOURCE_ID,
      serviceCode: 'aws',
      cloudProvider: 'AWS',
      confirmStatus: 'PENDING',
      latest_approval_request: { status: 'PENDING' },
    });
  });
});
