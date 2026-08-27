import { beforeEach, describe, expect, it } from 'vitest';
import { mockSdu, resetSduMockStore, clearSduUploadState, completeSduBdcForTest } from '@/lib/bff/mock/sdu';
import { resetStore } from '@/lib/mock-store';
import * as mockData from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type {
  SduDefinitionRequestTargetWire,
  SduDefinitionWire,
  SduRegion,
  SduUploadWire,
} from '@/lib/types/sdu';

/**
 * ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §1–§8.
 *
 * The subject here is the RULES, not the shapes: the invalidation table is the reason
 * every Step-4 answer is stored per region, and if it silently over-drops the owner
 * learns to avoid going back to Step 1 — which is exactly what the design set out to
 * prevent. So each row of that table gets a case.
 */

const GLOBAL_ID = 1101;
const CHINA_ID = 1102;
const SEEDED_ID = 1100;

const target = (
  overrides: Partial<SduDefinitionRequestTargetWire> = {},
): SduDefinitionRequestTargetWire => ({
  target_id: 't1',
  cloud: 'AWS',
  region: 'us',
  upload_ip: '10.20.30.40',
  database_types: ['MySQL'],
  ...overrides,
});

const body = async <T>(response: Response): Promise<T> => (await response.json()) as T;

const putDefinition = (id: number, targets: SduDefinitionRequestTargetWire[], scope: 'GLOBAL' | 'CHINA' = 'GLOBAL') =>
  mockSdu.putDefinition(id, { region_scope: scope, targets });

const upload = async (id: number): Promise<SduUploadWire> => body(await mockSdu.getUpload(id));

/** Walks a target source to "every region acknowledged, recipients registered". */
const ackEverything = async (id: number, regions: SduRegion[]) => {
  await mockSdu.putRecipients(id, { user_ids: ['user-3'] });
  await mockSdu.putAcks(id, { kind: 'FIREWALL', regions, confirmed: true });
  await mockSdu.putAcks(id, { kind: 'UPLOAD', regions, confirmed: true });
};

beforeEach(() => {
  resetSduMockStore();
  resetStore();
  // 현재 사용자는 모듈 레벨 값이라 스토어 초기화가 되돌리지 않는다 — 파일 안에서
  // 바꾼 사용자가 다음 케이스로 새지 않게 여기서 명시적으로 되돌린다.
  mockData.setCurrentUser('admin-1');
});

describe('SDU 정의 — 저장 규칙 (§2)', () => {
  it('권역은 대상이 하나라도 있으면 바꿀 수 없다', async () => {
    await putDefinition(GLOBAL_ID, [target()]);

    const rejected = await putDefinition(GLOBAL_ID, [target({ region: 'china' })], 'CHINA');

    expect(rejected.status).toBe(400);
    await expect(body<{ error: { code: string } }>(rejected)).resolves.toMatchObject({
      error: { code: 'INVALID_PARAMETER' },
    });
  });

  it('대상이 비어 있으면 권역을 바꿀 수 있다 — 잠그는 것은 대상이지 권역이 아니다', async () => {
    const changed = await putDefinition(GLOBAL_ID, [], 'CHINA');

    expect(changed.status).toBe(200);
    await expect(body<SduDefinitionWire>(changed)).resolves.toMatchObject({
      region_scope: 'CHINA',
      locked: false,
    });
  });

  it('권역에 속하지 않는 Region 은 거절한다', async () => {
    // china 는 CHINA 권역의 Region 이다 — GLOBAL 에서 받으면 어느 권역도 소유하지 않는
    // 버킷 경로가 생기고, 무효화를 계산할 수 없게 된다.
    const rejected = await putDefinition(GLOBAL_ID, [target({ region: 'china' })]);
    expect(rejected.status).toBe(400);

    const accepted = await putDefinition(CHINA_ID, [target({ region: 'china' })], 'CHINA');
    expect(accepted.status).toBe(200);
  });

  it('database_types 는 20개·50자 상한을 넘길 수 없다', async () => {
    const twentyOne = Array.from({ length: 21 }, (_, i) => `T${i}`);
    expect((await putDefinition(GLOBAL_ID, [target({ database_types: twentyOne })])).status).toBe(400);

    const tooLong = 'x'.repeat(51);
    expect((await putDefinition(GLOBAL_ID, [target({ database_types: [tooLong] })])).status).toBe(400);

    // 경계는 통과한다 — 상한은 20개·50자'까지'다.
    const twenty = Array.from({ length: 20 }, (_, i) => `T${i}`);
    expect(
      (await putDefinition(GLOBAL_ID, [target({ database_types: [...twenty.slice(0, 19), 'x'.repeat(50)] })]))
        .status,
    ).toBe(200);
  });

  it('빈 Database Type 과 잘못된 upload_ip 는 거절한다', async () => {
    expect((await putDefinition(GLOBAL_ID, [target({ database_types: ['  '] })])).status).toBe(400);
    expect((await putDefinition(GLOBAL_ID, [target({ upload_ip: '10.20.30' })])).status).toBe(400);
    expect((await putDefinition(GLOBAL_ID, [target({ upload_ip: '10.20.30.999' })])).status).toBe(400);
  });

  it('locked 는 대상 유무를 그대로 말한다', async () => {
    await expect(body<SduDefinitionWire>(await mockSdu.getDefinition(GLOBAL_ID))).resolves.toMatchObject({
      locked: false,
      targets: [],
      updated_at: null,
    });

    await putDefinition(GLOBAL_ID, [target()]);

    await expect(body<SduDefinitionWire>(await mockSdu.getDefinition(GLOBAL_ID))).resolves.toMatchObject({
      locked: true,
    });
  });

  it('China 대상소스는 China 권역에서 시작한다 — is_china_region 이 초기값이다', async () => {
    await expect(body<SduDefinitionWire>(await mockSdu.getDefinition(CHINA_ID))).resolves.toMatchObject({
      region_scope: 'CHINA',
    });
    await expect(body<SduDefinitionWire>(await mockSdu.getDefinition(GLOBAL_ID))).resolves.toMatchObject({
      region_scope: 'GLOBAL',
    });
  });
});

describe('SDU 정의 — 무효화 표 (§2)', () => {
  const twoRegions = () => [
    target({ target_id: 'a', region: 'us' }),
    target({ target_id: 'b', region: 'eu', upload_ip: '10.20.30.41' }),
  ];

  const seedAcked = async () => {
    await putDefinition(GLOBAL_ID, twoRegions());
    await ackEverything(GLOBAL_ID, ['us', 'eu']);
  };

  it('Region 추가 — 기존 확인은 살아남고, 새 Region 만 답이 없다', async () => {
    await seedAcked();

    await putDefinition(GLOBAL_ID, [...twoRegions(), target({ target_id: 'c', region: 'asia' })]);

    const state = await upload(GLOBAL_ID);
    expect(state.regions).toEqual(['asia', 'us', 'eu']);
    expect(state.firewall.acked_regions).toEqual(['us', 'eu']);
    expect(state.commands.acked_regions).toEqual(['us', 'eu']);
    expect(state.invalidation).toEqual({
      added_regions: ['asia'],
      removed_regions: [],
      upload_ip_changed: false,
    });
  });

  it('Region 삭제 — 그 Region 의 확인만 두 목록에서 폐기된다', async () => {
    await seedAcked();

    await putDefinition(GLOBAL_ID, [target({ target_id: 'a', region: 'us' })]);

    const state = await upload(GLOBAL_ID);
    expect(state.regions).toEqual(['us']);
    expect(state.firewall.acked_regions).toEqual(['us']);
    expect(state.commands.acked_regions).toEqual(['us']);
    expect(state.invalidation).toMatchObject({ removed_regions: ['eu'], upload_ip_changed: false });
  });

  it('업로드 IP 변경 — 방화벽 확인만 전부 폐기되고 업로드 확인은 남는다', async () => {
    await seedAcked();

    await putDefinition(GLOBAL_ID, [
      target({ target_id: 'a', region: 'us', upload_ip: '10.99.99.99' }),
      target({ target_id: 'b', region: 'eu', upload_ip: '10.20.30.41' }),
    ]);

    const state = await upload(GLOBAL_ID);
    // 방화벽 규칙은 출발지 → 목적지 한 쌍이라, 출발지가 바뀌면 전 Region 이 다른 규칙이다.
    expect(state.firewall.acked_regions).toEqual([]);
    // 명령 세 줄에는 출발지 IP 가 없다 — 그래서 살아남는다.
    expect(state.commands.acked_regions).toEqual(['us', 'eu']);
    expect(state.invalidation.upload_ip_changed).toBe(true);
  });

  it('Database Type 만 바뀌면 아무것도 무효가 되지 않는다', async () => {
    await seedAcked();

    await putDefinition(GLOBAL_ID, [
      target({ target_id: 'a', region: 'us', database_types: ['MySQL', 'Oracle'] }),
      target({ target_id: 'b', region: 'eu', upload_ip: '10.20.30.41' }),
    ]);

    const state = await upload(GLOBAL_ID);
    expect(state.firewall.acked_regions).toEqual(['us', 'eu']);
    expect(state.commands.acked_regions).toEqual(['us', 'eu']);
    expect(state.invalidation).toEqual({
      added_regions: [],
      removed_regions: [],
      upload_ip_changed: false,
    });
  });

  it('클라우드만 바뀌면 아무것도 무효가 되지 않는다', async () => {
    await seedAcked();

    await putDefinition(GLOBAL_ID, [
      target({ target_id: 'a', region: 'us', cloud: 'IDC' }),
      target({ target_id: 'b', region: 'eu', upload_ip: '10.20.30.41' }),
    ]);

    const state = await upload(GLOBAL_ID);
    expect(state.firewall.acked_regions).toEqual(['us', 'eu']);
    expect(state.invalidation.upload_ip_changed).toBe(false);
  });

  it('무효화 안내는 다음 확인 응답이 저장되면 지워진다 — 한 번만 말한다', async () => {
    await seedAcked();
    await putDefinition(GLOBAL_ID, [...twoRegions(), target({ target_id: 'c', region: 'asia' })]);
    expect((await upload(GLOBAL_ID)).invalidation.added_regions).toEqual(['asia']);

    await mockSdu.putAcks(GLOBAL_ID, { kind: 'FIREWALL', regions: ['asia'], confirmed: true });

    expect((await upload(GLOBAL_ID)).invalidation).toEqual({
      added_regions: [],
      removed_regions: [],
      upload_ip_changed: false,
    });
  });
});

describe('SDU 업로드 — 조회와 확인 (§4·§5·§6)', () => {
  beforeEach(async () => {
    await putDefinition(GLOBAL_ID, [
      target({ target_id: 'a', region: 'eu' }),
      target({ target_id: 'b', region: 'us', upload_ip: '10.20.30.41' }),
    ]);
  });

  it('Region 은 정규 순서로 중복 없이 온다 — 방화벽·명령 행도 그 순서다', async () => {
    const state = await upload(GLOBAL_ID);
    expect(state.regions).toEqual(['us', 'eu']);
    expect(state.firewall.rows.map((row) => row.region)).toEqual(['us', 'eu']);
    expect(state.commands.rows.map((row) => row.region)).toEqual(['us', 'eu']);
  });

  it('명령은 정확히 세 줄이고, 마지막 줄이 이 대상의 버킷 경로다', async () => {
    const state = await upload(GLOBAL_ID);
    const usCommand = state.commands.rows.find((row) => row.region === 'us')?.command ?? '';
    const lines = usCommand.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('export http_proxy=http://proxy.bdc.com:8080');
    expect(lines[1]).toBe('export https_proxy=http://proxy.bdc.com:8080');
    expect(lines[2]).toBe(
      `aws s3 ls s3://bdc-sdu-us-east-1/${GLOBAL_ID}/ --recursive --human-readable`,
    );
  });

  it('China 는 다른 파티션의 엔드포인트를 쓴다', async () => {
    await putDefinition(CHINA_ID, [target({ region: 'china' })], 'CHINA');
    const state = await upload(CHINA_ID);

    expect(state.firewall.rows).toHaveLength(1);
    expect(state.firewall.rows[0].s3_endpoint).toBe('s3.cn-north-1.amazonaws.com.cn');
    expect(state.firewall.rows[0].port).toBe(443);
  });

  it('다시 조회는 조회 시각만 새로 찍는다 — 행은 그대로다', async () => {
    const before = await upload(GLOBAL_ID);
    const refreshed = await body<SduUploadWire['firewall']>(await mockSdu.refreshFirewall(GLOBAL_ID));

    expect(refreshed.rows).toEqual(before.firewall.rows);
    expect(refreshed.queried_at).not.toBe(before.firewall.queried_at);
  });

  it('연동 대상에 없는 Region 은 확인할 수 없다', async () => {
    const rejected = await mockSdu.putAcks(GLOBAL_ID, {
      kind: 'FIREWALL',
      regions: ['asia'],
      confirmed: true,
    });

    expect(rejected.status).toBe(400);
    expect((await upload(GLOBAL_ID)).firewall.acked_regions).toEqual([]);
  });

  it('confirmed=false 는 확인을 되돌린다 — 끝난 블록은 잠기는 게 아니라 접힐 뿐이다', async () => {
    await mockSdu.putAcks(GLOBAL_ID, { kind: 'FIREWALL', regions: ['us', 'eu'], confirmed: true });
    expect((await upload(GLOBAL_ID)).firewall.acked_regions).toEqual(['us', 'eu']);

    await mockSdu.putAcks(GLOBAL_ID, { kind: 'FIREWALL', regions: ['eu'], confirmed: false });
    expect((await upload(GLOBAL_ID)).firewall.acked_regions).toEqual(['us']);
  });

  it('수신자는 목이 아는 사용자만 받는다', async () => {
    expect((await mockSdu.putRecipients(GLOBAL_ID, { user_ids: ['nope'] })).status).toBe(400);

    await mockSdu.putRecipients(GLOBAL_ID, { user_ids: ['user-3', 'user-4'] });
    const state = await upload(GLOBAL_ID);
    expect(state.recipients.users.map((user) => user.id)).toEqual(['user-3', 'user-4']);
    expect(state.recipients.updated_at).not.toBeNull();
  });
});

describe('SDU 제출과 BDC 진행 (§3·§8)', () => {
  it('제출은 대상이 없으면 거절되고, 있으면 1단계에서 업로드 단계로 옮긴다', async () => {
    expect((await mockSdu.submitDefinition(GLOBAL_ID)).status).toBe(400);
    expect(mockData.getProjectByTargetSourceId(GLOBAL_ID)?.processStatus).toBe(
      ProcessStatus.WAITING_TARGET_CONFIRMATION,
    );

    await putDefinition(GLOBAL_ID, [target()]);
    expect((await mockSdu.submitDefinition(GLOBAL_ID)).status).toBe(200);

    // SDU 는 승인 절차가 없다 — 2·3 을 거치지 않고 곧바로 업로드 단계다.
    expect(mockData.getProjectByTargetSourceId(GLOBAL_ID)?.processStatus).toBe(ProcessStatus.INSTALLING);
  });

  it('BDC 는 전 Region 확인 + 수신자 1명 이상에서 시작하고, 60초 뒤 연결 테스트 단계로 넘긴다', async () => {
    await putDefinition(GLOBAL_ID, [target({ target_id: 'a', region: 'us' })]);
    await mockSdu.submitDefinition(GLOBAL_ID);

    // 방화벽만으로는 시작하지 않는다.
    await mockSdu.putAcks(GLOBAL_ID, { kind: 'FIREWALL', regions: ['us'], confirmed: true });
    expect((await upload(GLOBAL_ID)).bdc.status).toBe('NOT_STARTED');

    await ackEverything(GLOBAL_ID, ['us']);
    expect((await upload(GLOBAL_ID)).bdc.status).toBe('IN_PROGRESS');
    expect(mockData.getProjectByTargetSourceId(GLOBAL_ID)?.processStatus).toBe(ProcessStatus.INSTALLING);

    completeSduBdcForTest(GLOBAL_ID);

    const done = await upload(GLOBAL_ID);
    expect(done.bdc.status).toBe('COMPLETED');
    expect(done.bdc.completed_at).not.toBeNull();
    expect(mockData.getProjectByTargetSourceId(GLOBAL_ID)?.processStatus).toBe(
      ProcessStatus.WAITING_CONNECTION_TEST,
    );
  });

  it('시작 조건을 잃으면 BDC 는 다시 대기로 돌아간다 — 무효화된 확인은 반쯤 된 것이 아니다', async () => {
    await putDefinition(GLOBAL_ID, [target({ target_id: 'a', region: 'us' })]);
    await ackEverything(GLOBAL_ID, ['us']);
    expect((await upload(GLOBAL_ID)).bdc.status).toBe('IN_PROGRESS');

    // 업로드 IP 를 고치면 방화벽 확인이 전부 날아간다.
    await putDefinition(GLOBAL_ID, [target({ target_id: 'a', region: 'us', upload_ip: '10.1.1.1' })]);

    expect((await upload(GLOBAL_ID)).bdc.status).toBe('NOT_STARTED');
  });
});

describe('SDU 시드와 초기화 (§8)', () => {
  it('1100 은 업로드 단계 한가운데다 — Region 2곳, 방화벽은 us 만, 수신자 3명', async () => {
    const state = await upload(SEEDED_ID);

    expect(state.regions).toEqual(['us', 'eu']);
    expect(state.firewall.acked_regions).toEqual(['us']);
    expect(state.commands.acked_regions).toEqual([]);
    expect(state.recipients.users).toHaveLength(3);
    expect(state.submitted_at).not.toBeNull();
    expect(mockData.getProjectByTargetSourceId(SEEDED_ID)?.processStatus).toBe(ProcessStatus.INSTALLING);
  });

  it('초기화는 업로드 상태만 버리고 연동 대상 정의는 남긴다', async () => {
    const before = await body<SduDefinitionWire>(await mockSdu.getDefinition(SEEDED_ID));
    expect(before.targets).toHaveLength(2);

    clearSduUploadState(SEEDED_ID);

    // 1단계가 고칠 목록이 바로 이 정의다 — 지우면 담당자는 빈 화면을 다시 채워야 한다.
    const after = await body<SduDefinitionWire>(await mockSdu.getDefinition(SEEDED_ID));
    expect(after.targets).toEqual(before.targets);
    expect(after.region_scope).toBe(before.region_scope);

    const state = await upload(SEEDED_ID);
    expect(state.submitted_at).toBeNull();
    expect(state.firewall.acked_regions).toEqual([]);
    expect(state.recipients.users).toEqual([]);
    expect(state.bdc.status).toBe('NOT_STARTED');
  });
});

describe('SDU 접근 제어', () => {
  it('권한 없는 서비스는 403, 없는 대상은 404', async () => {
    mockData.setCurrentUser('user-6'); // serviceCodePermissions: []
    expect((await mockSdu.getDefinition(SEEDED_ID)).status).toBe(403);

    mockData.setCurrentUser('admin-1');
    expect((await mockSdu.getDefinition(999_999)).status).toBe(404);
  });
});
