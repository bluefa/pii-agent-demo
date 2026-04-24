import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from '@/lib/api-client/mock';

beforeEach(() => {
  globalThis.__piiAgentMockStore = undefined;
});

describe('mockClient.targetSources', () => {
  it('서비스 목록 조회는 Issue #222 detail array shape를 반환한다', async () => {
    const response = await mockClient.targetSources.list('SERVICE-A');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target_source_id: expect.any(Number),
          process_status: expect.any(String),
          cloud_provider: expect.any(String),
          created_at: expect.any(String),
        }),
      ]),
    );
  });

  it('생성은 projectCode 없이 Issue #222 request를 받아 TargetSourceInfo를 반환한다', async () => {
    const response = await mockClient.targetSources.create({
      serviceCode: 'SERVICE-A',
      description: 'Issue 222 create test',
      cloudProvider: 'AZURE',
      tenantId: '11111111-1111-1111-1111-111111111111',
      subscriptionId: '22222222-2222-2222-2222-222222222222',
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      targetSourceId: expect.any(Number),
      description: 'Issue 222 create test',
      cloudProvider: 'AZURE',
      serviceCode: 'SERVICE-A',
      metadata: {
        tenant_id: '11111111-1111-1111-1111-111111111111',
        subscription_id: '22222222-2222-2222-2222-222222222222',
      },
    });
  });

  describe('get', () => {
    it('AWS target-source 응답은 awsAccountId 등 AWS 식별자를 노출하고 resources 필드는 누락한다', async () => {
      const response = await mockClient.targetSources.get('1006');
      expect(response.status).toBe(200);

      const payload = (await response.json()) as { targetSource: Record<string, unknown> };
      expect(payload.targetSource).toEqual(expect.objectContaining({
        targetSourceId: 1006,
        cloudProvider: 'AWS',
        awsAccountId: expect.any(String),
      }));
      expect(payload.targetSource).not.toHaveProperty('resources');
    });

    it('GCP target-source 응답은 gcpProjectId 를 노출하고 resources 필드는 누락한다', async () => {
      const response = await mockClient.targetSources.get('1002');
      expect(response.status).toBe(200);

      const payload = (await response.json()) as { targetSource: Record<string, unknown> };
      expect(payload.targetSource).toEqual(expect.objectContaining({
        targetSourceId: 1002,
        cloudProvider: 'GCP',
        gcpProjectId: expect.any(String),
      }));
      expect(payload.targetSource).not.toHaveProperty('resources');
    });

    it('Azure target-source 응답은 tenantId/subscriptionId 를 노출하고 resources 필드는 누락한다', async () => {
      const response = await mockClient.targetSources.get('1003');
      expect(response.status).toBe(200);

      const payload = (await response.json()) as { targetSource: Record<string, unknown> };
      expect(payload.targetSource).toEqual(expect.objectContaining({
        targetSourceId: 1003,
        cloudProvider: 'AZURE',
      }));
      expect(payload.targetSource).not.toHaveProperty('resources');
    });

  });
});
