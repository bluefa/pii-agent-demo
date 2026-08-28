import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSduDefinition,
  getSduUpload,
  putSduAcks,
  putSduDefinition,
  putSduRecipients,
  submitSduDefinition,
  toSduDefinitionRequest,
} from '@/app/lib/api/sdu';
import type { SduDefinitionWire, SduFirewallWire, SduUploadWire } from '@/lib/types/sdu';

/**
 * ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §1–§6.
 *
 * This module is the ONE case boundary for the domain. A field that never gets renamed
 * arrives as `undefined` at the consumer and renders as an empty cell — green everywhere
 * else — so every mapped key is pinned by name here, and the outgoing URL + body are
 * measured rather than inferred.
 */

const DEFINITION_WIRE: SduDefinitionWire = {
  region_scope: 'GLOBAL',
  targets: [
    { target_id: 't1', cloud: 'AWS', region: 'us', upload_ip: '10.20.30.40', database_types: ['MySQL'] },
  ],
  updated_at: '2026-08-24T05:40:00Z',
};

const FIREWALL_WIRE: SduFirewallWire = {
  // 정규 순서가 아닌 채로 온다 — 어댑터가 정렬한다.
  rows: [
    { region: 'eu', s3_endpoint: 's3.eu-west-1.amazonaws.com', port: 443, destination_ips: ['52.218.0.0/17'] },
    { region: 'us', s3_endpoint: 's3.us-east-1.amazonaws.com', port: 443, destination_ips: ['52.216.0.0/15'] },
  ],
  acked: true,
};

const UPLOAD_WIRE: SduUploadWire = {
  submitted_at: '2026-08-24T05:41:00Z',
  regions: ['eu', 'us'],
  firewall: FIREWALL_WIRE,
  recipients: {
    users: [{ id: 'user-3', name: '이영희', email: 'lee@company.com' }],
    updated_at: '2026-08-24T07:41:00Z',
  },
  commands: {
    rows: [{ region: 'us', command: 'export http_proxy=x\nexport https_proxy=x\naws s3 ls s3://b/1/' }],
    acked: false,
  },
  bdc: { status: 'IN_PROGRESS', checked_at: '2026-08-24T08:00:00Z', completed_at: null },
  invalidation: { added_regions: ['asia'], upload_ip_changed: true },
};

interface Seen {
  url: string;
  method: string;
  body: unknown;
}

const stubFetch = (payload: unknown, status = 200): Seen => {
  const seen: Seen = { url: '', method: '', body: undefined };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.method = init?.method ?? 'GET';
    seen.body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    if (status === 204) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return seen;
};

afterEach(() => vi.unstubAllGlobals());

describe('SDU 어댑터 — snake → camel', () => {
  it('정의의 모든 키가 이름으로 바뀐다', async () => {
    stubFetch(DEFINITION_WIRE);

    await expect(getSduDefinition(1101)).resolves.toEqual({
      regionScope: 'GLOBAL',
      targets: [
        {
          targetId: 't1',
          cloud: 'AWS',
          region: 'us',
          uploadIp: '10.20.30.40',
          databaseTypes: ['MySQL'],
        },
      ],
      updatedAt: '2026-08-24T05:40:00Z',
    });
  });

  it('업로드 응답의 네 블록과 무효화가 전부 camel 로 온다', async () => {
    stubFetch(UPLOAD_WIRE);

    const upload = await getSduUpload(1101);

    expect(upload.submittedAt).toBe('2026-08-24T05:41:00Z');
    expect(upload.firewall.rows[0]).toEqual({
      region: 'us',
      s3Endpoint: 's3.us-east-1.amazonaws.com',
      port: 443,
      destinationIps: ['52.216.0.0/15'],
    });
    expect(upload.recipients.updatedAt).toBe('2026-08-24T07:41:00Z');
    expect(upload.recipients.users[0]).toEqual({
      id: 'user-3',
      name: '이영희',
      email: 'lee@company.com',
    });
    expect(upload.commands.rows[0].command).toContain('aws s3 ls');
    expect(upload.bdc).toEqual({
      status: 'IN_PROGRESS',
      checkedAt: '2026-08-24T08:00:00Z',
      completedAt: null,
    });
    expect(upload.invalidation).toEqual({ addedRegions: ['asia'], uploadIpChanged: true });
  });

  it('Region 목록은 정규 순서로 세워진다 — 표·명령·확인이 서로 다른 순서를 말할 수 없다', async () => {
    stubFetch(UPLOAD_WIRE);

    const upload = await getSduUpload(1101);

    // 세 자리가 같은 순서를 말해야 한다 — wire 는 eu·us 로 왔다.
    expect(upload.regions).toEqual(['us', 'eu']);
    expect(upload.firewall.rows.map((row) => row.region)).toEqual(['us', 'eu']);
  });

  it('명령 문자열은 해석하지 않고 그대로 옮긴다', async () => {
    stubFetch(UPLOAD_WIRE);

    const upload = await getSduUpload(1101);

    expect(upload.commands.rows[0].command).toBe(UPLOAD_WIRE.commands.rows[0].command);
    expect(upload.commands.rows[0].command.split('\n')).toHaveLength(3);
  });

});

describe('SDU 어댑터 — camel → snake', () => {
  it('저장 본문은 snake 로 나가고, 저장된 적 없는 행은 target_id 를 싣지 않는다', () => {
    const wire = toSduDefinitionRequest({
      targets: [
        { targetId: 't1', cloud: 'AWS', region: 'us', uploadIp: '10.20.30.40', databaseTypes: ['MySQL'] },
        { targetId: '', cloud: 'GCP', region: 'eu', uploadIp: '10.20.30.41', databaseTypes: [] },
      ],
    });

    // 권역은 본문에 없다 — 대상소스가 가진 값이라 이 화면이 쓸 수 있는 값이 아니다.
    expect(wire).toEqual({
      targets: [
        { target_id: 't1', cloud: 'AWS', region: 'us', upload_ip: '10.20.30.40', database_types: ['MySQL'] },
        { cloud: 'GCP', region: 'eu', upload_ip: '10.20.30.41', database_types: [] },
      ],
    });
    expect('region_scope' in wire).toBe(false);
    // 빈 문자열을 실으면 서버가 그것을 "이전에 있던 행"으로 읽어 IP 변경 판정이 어긋난다.
    expect('target_id' in wire.targets[1]).toBe(false);
  });

  it('PUT /definition 은 변환된 본문을 보내고 변환된 응답을 돌려준다', async () => {
    const seen = stubFetch(DEFINITION_WIRE);

    const saved = await putSduDefinition(1101, {
      targets: [
        { targetId: 't1', cloud: 'AWS', region: 'us', uploadIp: '10.20.30.40', databaseTypes: ['MySQL'] },
      ],
    });

    expect(seen.method).toBe('PUT');
    expect(seen.body).toEqual({
      targets: [
        { target_id: 't1', cloud: 'AWS', region: 'us', upload_ip: '10.20.30.40', database_types: ['MySQL'] },
      ],
    });
    expect(saved.targets[0].uploadIp).toBe('10.20.30.40');
  });

  it('확인 응답과 수신자는 snake 본문으로 나가고 읽을 것이 없다', async () => {
    const ackSeen = stubFetch(null, 204);
    await expect(
      putSduAcks(1101, { kind: 'FIREWALL', confirmed: false }),
    ).resolves.toBeUndefined();
    expect(ackSeen.method).toBe('PUT');
    expect(ackSeen.url).toContain('/target-sources/1101/sdu/upload/acks');
    // 답은 블록당 하나다 — 본문에 Region 이 실리면 화면이 묻지 않은 것을 보내는 것이다.
    expect(ackSeen.body).toEqual({ kind: 'FIREWALL', confirmed: false });

    vi.unstubAllGlobals();
    const recipientSeen = stubFetch(null, 204);
    await expect(putSduRecipients(1101, ['user-3', 'user-4'])).resolves.toBeUndefined();
    expect(recipientSeen.body).toEqual({ user_ids: ['user-3', 'user-4'] });
  });

  it('제출은 POST 한 번이고 본문이 없다', async () => {
    const seen = stubFetch(null, 204);

    await expect(submitSduDefinition(1101)).resolves.toBeUndefined();

    expect(seen.method).toBe('POST');
    expect(seen.url).toContain('/target-sources/1101/sdu/definition/submit');
    expect(seen.body).toBeUndefined();
  });
});
