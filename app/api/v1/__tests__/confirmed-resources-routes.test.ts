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
    // 편집기가 응답을 그대로 보여 주므로 본문이 살아 나오는지도 잰다 — status 와 호출
    // 인자만 보면 라우트가 `raw` 를 흘리지 않게 되어도 초록으로 통과한다.
    expect(await response.json()).toEqual({ ok: true });
    expect(mockedCreate).toHaveBeenCalledWith(
      42,
      'AWS',
      { resource_infos: [{ resource_id: 'arn:x' }] },
      false,
    );
  });

  it('빈 업스트림 본문은 빈 object 로 내려 보낸다 — 계약이 성공 스키마를 선언하지 않는다', async () => {
    mockedCreate.mockResolvedValue(undefined);

    const response = await createConfirmed(
      new Request(url('provider=aws'), { method: 'POST', body: '{}' }),
      routeParams,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({});
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
    // IDC 업스트림은 204(본문 없음)라 `send` 가 undefined 를 준다 — 그것이 빈 object 로
    // 내려가야 응답 칸이 무언가를 그린다.
    expect(await response.json()).toEqual({});
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
