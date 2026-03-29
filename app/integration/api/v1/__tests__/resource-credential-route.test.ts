import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    confirm: {
      updateResourceCredential: vi.fn(),
    },
  },
}));

import { PUT } from '@/app/integration/api/v1/target-sources/[targetSourceId]/resources/credential/route';
import { client } from '@/lib/api-client';

const mockedUpdateResourceCredential = vi.mocked(client.confirm.updateResourceCredential);

describe('PUT /integration/api/v1/target-sources/[targetSourceId]/resources/credential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Issue #222 PUT 계약으로 credential update를 프록시한다', async () => {
    mockedUpdateResourceCredential.mockResolvedValue(
      NextResponse.json({ success: true }, { status: 200 }),
    );

    const response = await PUT(
      new Request('http://localhost/integration/api/v1/target-sources/1003/resources/credential', {
        method: 'PUT',
        body: JSON.stringify({
          resourceId: 'res-1',
          credentialId: 'cred-1',
        }),
      }),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockedUpdateResourceCredential).toHaveBeenCalledWith('azure-proj-1', {
      resourceId: 'res-1',
      credentialId: 'cred-1',
    });
  });

  it('유효하지 않은 targetSourceId면 problem response를 반환한다', async () => {
    const response = await PUT(
      new Request('http://localhost/integration/api/v1/target-sources/abc/resources/credential', {
        method: 'PUT',
        body: JSON.stringify({
          resourceId: 'res-1',
          credentialId: 'cred-1',
        }),
      }),
      { params: Promise.resolve({ targetSourceId: 'abc' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      title: 'Invalid Parameter',
      status: 400,
      code: 'INVALID_PARAMETER',
    });
    expect(mockedUpdateResourceCredential).not.toHaveBeenCalled();
  });
});
