import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    confirm: {
      createConfirmedResources: vi.fn(),
      deleteConfirmedResources: vi.fn(),
      getApprovedRecommendations: vi.fn(),
    },
  },
}));

import {
  POST as createConfirmed,
  DELETE as deleteConfirmed,
} from '@/app/api/v1/target-sources/[targetSourceId]/confirmed-resources/route';
import { GET as getRecommendations } from '@/app/api/v1/target-sources/[targetSourceId]/confirmed-resources/recommendations/route';
import { bff } from '@/lib/bff/client';

const mockedCreate = vi.mocked(bff.confirm.createConfirmedResources);
const mockedDelete = vi.mocked(bff.confirm.deleteConfirmedResources);
const mockedRecommend = vi.mocked(bff.confirm.getApprovedRecommendations);

const routeParams = { params: Promise.resolve({ targetSourceId: '42' }) };
const url = (query: string): string => `http://localhost/x?${query}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST …/confirmed-resources', () => {
  it('forwards the opaque object body to the provider path and answers 201', async () => {
    mockedCreate.mockResolvedValue({ ok: true });

    const response = await createConfirmed(
      new Request(url('provider=aws'), {
        method: 'POST',
        body: JSON.stringify({ resource_infos: [{ resource_id: 'arn:x' }] }),
      }),
      routeParams,
    );

    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(
      42,
      'AWS',
      { resource_infos: [{ resource_id: 'arn:x' }] },
      false,
    );
  });

  it('mirrors applyNLBSecurityGroup=true into the call (AWS-only swagger flag)', async () => {
    mockedCreate.mockResolvedValue({});

    await createConfirmed(
      new Request(url('provider=AWS&applyNLBSecurityGroup=true'), { method: 'POST', body: '{}' }),
      routeParams,
    );

    expect(mockedCreate).toHaveBeenCalledWith(42, 'AWS', {}, true);
  });

  it('rejects a provider outside the four upstream paths with 400', async () => {
    const response = await createConfirmed(
      new Request(url('provider=oracle'), { method: 'POST', body: '{}' }),
      routeParams,
    );

    expect(response.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  // The contract's whole request-body statement is "required JSON object" — the
  // route enforces exactly that floor and nothing more.
  it.each([
    ['unreadable JSON', 'not-json'],
    ['a JSON array', '[]'],
    ['a JSON scalar', '"text"'],
    ['JSON null', 'null'],
  ])('rejects %s with 400 instead of forwarding it', async (_label, body) => {
    const response = await createConfirmed(
      new Request(url('provider=aws'), { method: 'POST', body }),
      routeParams,
    );

    expect(response.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe('DELETE …/confirmed-resources', () => {
  it('passes the provider through and answers 200', async () => {
    mockedDelete.mockResolvedValue(undefined);

    const response = await deleteConfirmed(
      new Request(url('provider=idc'), { method: 'DELETE' }),
      routeParams,
    );

    expect(response.status).toBe(200);
    expect(mockedDelete).toHaveBeenCalledWith(42, 'IDC');
  });
});

describe('GET …/confirmed-resources/recommendations', () => {
  it('passes the opaque 200 body through untouched', async () => {
    mockedRecommend.mockResolvedValue({ resource_infos: [{ resource_id: 'arn:y' }] });

    const response = await getRecommendations(new Request(url('provider=gcp')), routeParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resource_infos: [{ resource_id: 'arn:y' }],
    });
    expect(mockedRecommend).toHaveBeenCalledWith(42, 'GCP');
  });

  it('gates the provider with the shared allowlist', async () => {
    const response = await getRecommendations(new Request(url('provider=sdu')), routeParams);

    expect(response.status).toBe(400);
    expect(mockedRecommend).not.toHaveBeenCalled();
  });
});
