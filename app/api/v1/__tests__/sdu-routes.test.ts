import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    sdu: {
      getDefinition: vi.fn(),
      putDefinition: vi.fn(),
      submitDefinition: vi.fn(),
      getUpload: vi.fn(),
      putFirewallAck: vi.fn(),
      putCommandsAck: vi.fn(),
      putAccessKeyRecipients: vi.fn(),
      putBdcCompletion: vi.fn(),
    },
  },
}));

import { GET as getDefinition, PUT as putDefinition } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/definition/route';
import { POST as submitDefinition } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/definition/submit/route';
import { GET as getUpload } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/upload/route';
import { PUT as putFirewallAck } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/upload/firewall/ack/route';
import { PUT as putCommandsAck } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/upload/commands/ack/route';
import { PUT as putRecipients } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/upload/access-key-recipients/route';
import { PUT as putBdcCompletion } from '@/app/api/v1/target-sources/[targetSourceId]/sdu/upload/bdc/completion/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import type { SduDefinitionWire, SduFirewallWire, SduUploadWire } from '@/lib/types/sdu';

/** ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §1–§6. */

const mocked = vi.mocked(bff.sdu);

const params = (targetSourceId: string) => ({ params: Promise.resolve({ targetSourceId }) });
const url = (path: string) => `http://localhost/pass/api/v1/target-sources/1101/sdu${path}`;

const DEFINITION: SduDefinitionWire = {
  targets: [
    { target_id: 't1', cloud: 'AWS', region: 'us', upload_ip: '10.20.30.40', database_types: ['MySQL'] },
  ],
  updated_at: '2026-08-24T05:40:00Z',
};

const FIREWALL: SduFirewallWire = {
  rows: [
    { region: 'us', s3_endpoint: 's3.us-east-1.amazonaws.com', port: 443, destination_ips: ['52.216.0.0/15'] },
  ],
  acked: true,
  acked_at: '2026-08-25T10:40:00Z',
  acked_by: { id: 'user-1', name: '김철수', email: 'kim@company.com' },
};

const UPLOAD: SduUploadWire = {
  submitted_at: '2026-08-24T05:41:00Z',
  regions: ['us'],
  firewall: FIREWALL,
  access_key_recipients: { users: [], updated_at: null },
  commands: {
    rows: [{ region: 'us', command: 'export http_proxy=…' }],
    acked: false,
    acked_at: null,
    acked_by: null,
  },
  bdc: { status: 'NOT_STARTED', checked_at: '2026-08-24T08:00:00Z', completed_at: null, completed_by: null },
  invalidation: { added_regions: [], upload_ip_changed: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getDefinition.mockResolvedValue(DEFINITION);
  mocked.putDefinition.mockResolvedValue(DEFINITION);
  mocked.submitDefinition.mockResolvedValue(undefined);
  mocked.getUpload.mockResolvedValue(UPLOAD);
  mocked.putFirewallAck.mockResolvedValue(undefined);
  mocked.putCommandsAck.mockResolvedValue(undefined);
  mocked.putAccessKeyRecipients.mockResolvedValue(undefined);
  mocked.putBdcCompletion.mockResolvedValue(undefined);
});

describe('SDU 라우트 — targetSourceId 검증', () => {
  it('정수가 아닌 id 는 어느 라우트에서든 INVALID_PARAMETER problem 이다', async () => {
    const responses = await Promise.all([
      getDefinition(new Request(url('/definition')), params('abc')),
      putDefinition(new Request(url('/definition'), { method: 'PUT', body: '{}' }), params('abc')),
      submitDefinition(new Request(url('/definition/submit'), { method: 'POST' }), params('abc')),
      getUpload(new Request(url('/upload')), params('abc')),
      putFirewallAck(new Request(url('/upload/firewall/ack'), { method: 'PUT', body: '{}' }), params('abc')),
      putCommandsAck(new Request(url('/upload/commands/ack'), { method: 'PUT', body: '{}' }), params('abc')),
      putRecipients(new Request(url('/upload/access-key-recipients'), { method: 'PUT', body: '{}' }), params('abc')),
      putBdcCompletion(new Request(url('/upload/bdc/completion'), { method: 'PUT', body: '{}' }), params('abc')),
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

  it('두 확인은 각자의 경로를 가지고, 서로의 메서드를 부르지 않는다', async () => {
    const body = { confirmed: false };

    const firewall = await putFirewallAck(
      new Request(url('/upload/firewall/ack'), { method: 'PUT', body: JSON.stringify(body) }),
      params('1101'),
    );
    expect(firewall.status).toBe(204);
    expect(mocked.putFirewallAck).toHaveBeenCalledWith(1101, body);
    expect(mocked.putCommandsAck).not.toHaveBeenCalled();

    const commands = await putCommandsAck(
      new Request(url('/upload/commands/ack'), { method: 'PUT', body: JSON.stringify(body) }),
      params('1101'),
    );
    expect(commands.status).toBe(204);
    expect(mocked.putCommandsAck).toHaveBeenCalledWith(1101, body);
  });

  it('confirmed 가 boolean 이 아니면 상류에 닿기 전에 400 이다', async () => {
    const response = await putFirewallAck(
      new Request(url('/upload/firewall/ack'), { method: 'PUT', body: JSON.stringify({ confirmed: 'yes' }) }),
      params('1101'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocked.putFirewallAck).not.toHaveBeenCalled();
  });

  it('PUT /upload/access-key-recipients 는 user_ids 배열만 받는다', async () => {
    const ok = await putRecipients(
      new Request(url('/upload/access-key-recipients'), { method: 'PUT', body: JSON.stringify({ user_ids: ['user-3'] }) }),
      params('1101'),
    );
    expect(ok.status).toBe(204);
    expect(mocked.putAccessKeyRecipients).toHaveBeenCalledWith(1101, ['user-3']);

    const bad = await putRecipients(
      new Request(url('/upload/access-key-recipients'), { method: 'PUT', body: JSON.stringify({ user_ids: [7] }) }),
      params('1101'),
    );
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('BDC 완료는 한 경로가 두 방향을 진다 — 본문의 boolean 만 다르다 (델타 §1)', async () => {
    for (const completed of [true, false]) {
      const response = await putBdcCompletion(
        new Request(url('/upload/bdc/completion'), { method: 'PUT', body: JSON.stringify({ completed }) }),
        params('1101'),
      );
      expect(response.status).toBe(204);
      expect(mocked.putBdcCompletion).toHaveBeenCalledWith(1101, { completed });
    }
  });

  it('completed 가 boolean 이 아니면 상류에 닿기 전에 400 이다', async () => {
    const response = await putBdcCompletion(
      new Request(url('/upload/bdc/completion'), { method: 'PUT', body: JSON.stringify({ completed: 'yes' }) }),
      params('1101'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocked.putBdcCompletion).not.toHaveBeenCalled();
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
