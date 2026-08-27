import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    sdu: {
      getDefinition: vi.fn(),
      putDefinition: vi.fn(),
      submitDefinition: vi.fn(),
      getUpload: vi.fn(),
      putAcks: vi.fn(),
      putRecipients: vi.fn(),
    },
  },
}));

import { GET as getDefinition, PUT as putDefinition } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/definition/route';
import { POST as submitDefinition } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/definition/submit/route';
import { GET as getUpload } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/upload/route';
import { PUT as putAcks } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/upload/acks/route';
import { PUT as putRecipients } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/upload/recipients/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import type { SduDefinitionWire, SduFirewallWire, SduUploadWire } from '@/lib/types/sdu';

/** ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §1–§6. */

const mocked = vi.mocked(bff.sdu);

const params = (targetSourceId: string) => ({ params: Promise.resolve({ targetSourceId }) });
const url = (path: string) => `http://localhost/pass/api/v1/target-sources/1101/sdu${path}`;

const DEFINITION: SduDefinitionWire = {
  region_scope: 'GLOBAL',
  targets: [
    { target_id: 't1', cloud: 'AWS', region: 'us', upload_ip: '10.20.30.40', database_types: ['MySQL'] },
  ],
  updated_at: '2026-08-24T05:40:00Z',
};

const FIREWALL: SduFirewallWire = {
  rows: [
    { region: 'us', s3_endpoint: 's3.us-east-1.amazonaws.com', port: 443, destination_ips: ['52.216.0.0/15'] },
  ],
  acked_regions: ['us'],
};

const UPLOAD: SduUploadWire = {
  submitted_at: '2026-08-24T05:41:00Z',
  regions: ['us'],
  firewall: FIREWALL,
  recipients: { users: [], updated_at: null },
  commands: { rows: [{ region: 'us', command: 'export http_proxy=…' }], acked_regions: [] },
  bdc: { status: 'NOT_STARTED', checked_at: '2026-08-24T08:00:00Z', completed_at: null },
  invalidation: { added_regions: [], removed_regions: [], upload_ip_changed: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getDefinition.mockResolvedValue(DEFINITION);
  mocked.putDefinition.mockResolvedValue(DEFINITION);
  mocked.submitDefinition.mockResolvedValue(undefined);
  mocked.getUpload.mockResolvedValue(UPLOAD);
  mocked.putAcks.mockResolvedValue(undefined);
  mocked.putRecipients.mockResolvedValue(undefined);
});

describe('SDU 라우트 — targetSourceId 검증', () => {
  it('정수가 아닌 id 는 어느 라우트에서든 INVALID_PARAMETER problem 이다', async () => {
    const responses = await Promise.all([
      getDefinition(new Request(url('/definition')), params('abc')),
      putDefinition(new Request(url('/definition'), { method: 'PUT', body: '{}' }), params('abc')),
      submitDefinition(new Request(url('/definition/submit'), { method: 'POST' }), params('abc')),
      getUpload(new Request(url('/upload')), params('abc')),
      putAcks(new Request(url('/upload/acks'), { method: 'PUT', body: '{}' }), params('abc')),
      putRecipients(new Request(url('/upload/recipients'), { method: 'PUT', body: '{}' }), params('abc')),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_PARAMETER' });
    }
    // 하나도 업스트림까지 가지 않는다.
    expect(mocked.getDefinition).not.toHaveBeenCalled();
    expect(mocked.putDefinition).not.toHaveBeenCalled();
    expect(mocked.submitDefinition).not.toHaveBeenCalled();
  });
});

describe('SDU 라우트 — 해피 패스', () => {
  it('GET /definition 은 wire 를 그대로 넘긴다', async () => {
    const response = await getDefinition(new Request(url('/definition')), params('1101'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(DEFINITION);
    expect(mocked.getDefinition).toHaveBeenCalledWith(1101);
  });

  it('PUT /definition 은 본문을 손대지 않고 넘긴다 — 규칙은 저장된 정의를 아는 쪽에 있다', async () => {
    const requestBody = { targets: DEFINITION.targets };
    const response = await putDefinition(
      new Request(url('/definition'), { method: 'PUT', body: JSON.stringify(requestBody) }),
      params('1101'),
    );

    expect(response.status).toBe(200);
    expect(mocked.putDefinition).toHaveBeenCalledWith(1101, requestBody);
  });

  it('PUT /definition 은 JSON 이 아닌 본문을 VALIDATION_FAILED 로 막는다', async () => {
    const response = await putDefinition(
      new Request(url('/definition'), { method: 'PUT', body: 'not json' }),
      params('1101'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocked.putDefinition).not.toHaveBeenCalled();
  });

  it('POST /definition/submit 은 204 — 읽을 본문이 없다', async () => {
    const response = await submitDefinition(
      new Request(url('/definition/submit'), { method: 'POST' }),
      params('1101'),
    );

    expect(response.status).toBe(204);
    expect(mocked.submitDefinition).toHaveBeenCalledWith(1101);
  });

  it('GET /upload 은 단계 전체를 한 응답으로 준다', async () => {
    const response = await getUpload(new Request(url('/upload')), params('1101'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(UPLOAD);
  });

  it('PUT /upload/acks 는 204 이고 본문을 그대로 넘긴다', async () => {
    const requestBody = { kind: 'FIREWALL', regions: ['us'], confirmed: false };
    const response = await putAcks(
      new Request(url('/upload/acks'), { method: 'PUT', body: JSON.stringify(requestBody) }),
      params('1101'),
    );

    expect(response.status).toBe(204);
    expect(mocked.putAcks).toHaveBeenCalledWith(1101, requestBody);
  });

  it('PUT /upload/recipients 는 user_ids 배열만 받는다', async () => {
    const ok = await putRecipients(
      new Request(url('/upload/recipients'), { method: 'PUT', body: JSON.stringify({ user_ids: ['user-3'] }) }),
      params('1101'),
    );
    expect(ok.status).toBe(204);
    expect(mocked.putRecipients).toHaveBeenCalledWith(1101, ['user-3']);

    const bad = await putRecipients(
      new Request(url('/upload/recipients'), { method: 'PUT', body: JSON.stringify({ user_ids: [7] }) }),
      params('1101'),
    );
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('SDU 라우트 — 업스트림 실패', () => {
  it('BffError 는 ProblemDetails 로 바뀐다', async () => {
    mocked.putDefinition.mockRejectedValueOnce(
      new BffError(400, 'INVALID_PARAMETER', 'targets[0].region "china"은 GLOBAL 권역의 Region이 아닙니다.'),
    );

    const response = await putDefinition(
      new Request(url('/definition'), { method: 'PUT', body: JSON.stringify({ targets: [] }) }),
      params('1101'),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_PARAMETER',
      detail: 'targets[0].region "china"은 GLOBAL 권역의 Region이 아닙니다.',
    });
  });
});
