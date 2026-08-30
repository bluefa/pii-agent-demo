/**
 * CSR helpers for the SDU (Self Data Upload) owner flow.
 *
 * ASSUMED contracts (docs/api/sdu-assumed-contracts.md §1–§6) — the Next routes exist,
 * the upstream BFF endpoints do not. Against the real BFF every call here 404s, so the
 * failure copy on these screens must not promise that a retry will work.
 *
 * This module is the ONE case boundary for the domain: the wire is snake, the view types
 * are camel, and the mappers below are the only place the two meet. `camelCaseKeys` is
 * deliberately not used — it would also rewrite the *contents* of a command string's keys
 * were the shape ever to nest, and a hand-written mapper is what the adapter test can
 * pin field by field.
 */
import { fetchInfraJson } from '@/app/lib/api/infra';
import { sortSduRegions } from '@/lib/types/sdu';
import type {
  SduAckStampWire,
  SduCommands,
  SduCommandsWire,
  SduDefinition,
  SduDefinitionRequestWire,
  SduDefinitionWire,
  SduFirewall,
  SduFirewallWire,
  SduInvalidation,
  SduInvalidationWire,
  SduAccessKeyRecipients,
  SduAccessKeyRecipientsWire,
  SduRegion,
  SduTarget,
  SduTargetWire,
  SduUpload,
  SduUploadWire,
} from '@/lib/types/sdu';

const base = (targetSourceId: number): string => `/target-sources/${targetSourceId}/sdu`;

// ── snake → camel ─────────────────────────────────────────────────────────────

const toTarget = (wire: SduTargetWire): SduTarget => ({
  targetId: wire.target_id,
  cloud: wire.cloud,
  region: wire.region,
  uploadIp: wire.upload_ip,
  databaseTypes: [...wire.database_types],
});

export const toSduDefinition = (wire: SduDefinitionWire): SduDefinition => ({
  targets: wire.targets.map(toTarget),
  updatedAt: wire.updated_at,
});

/**
 * 확인 한 블록의 답 — `acked` · `acked_at` · `acked_by` 셋이 한 사실이라 한 자리에서 접는다.
 *
 * 담당자 화면이 `acked_at` 을 읽는 것은 시각을 그리려는 것이 아니라 **답이 있었는지**를 알기
 * 위해서다 — `acked: false` 하나로는 「아니오」와 「미답」이 구별되지 않는다. `acked_by` 는
 * 관리자 쪽이 읽는다: 승인 조건 ①의 근거 행과 운영 콘솔의 「담당자 입력 정보」다(계약 §5).
 */
const toAckStamp = (wire: SduAckStampWire & { acked: boolean }) => ({
  acked: wire.acked,
  ackedAt: wire.acked_at,
  ackedBy: wire.acked_by
    ? { id: wire.acked_by.id, name: wire.acked_by.name, email: wire.acked_by.email }
    : null,
});

const toFirewall = (wire: SduFirewallWire): SduFirewall => ({
  rows: byRegion(wire.rows).map((row) => ({
    region: row.region,
    s3Endpoint: row.s3_endpoint,
    port: row.port,
    destinationIps: [...row.destination_ips],
  })),
  ...toAckStamp(wire),
});

/**
 * 행을 정규 순서로 세운다. 방화벽 표와 명령 블록과 `regions` 가 서로 다른 순서를 말하면
 * 화면은 같은 Region 을 세 자리에서 다르게 읽는다. 정렬은 여기 한 곳에서만 한다.
 */
const byRegion = <T extends { region: SduRegion }>(rows: readonly T[]): T[] => {
  const order = sortSduRegions(rows.map((row) => row.region));
  return order.flatMap((region) => rows.filter((row) => row.region === region));
};

const toAccessKeyRecipients = (wire: SduAccessKeyRecipientsWire): SduAccessKeyRecipients => ({
  users: wire.users.map((user) => ({ id: user.id, name: user.name, email: user.email })),
  updatedAt: wire.updated_at,
});

const toCommands = (wire: SduCommandsWire): SduCommands => ({
  rows: byRegion(wire.rows).map((row) => ({ region: row.region, command: row.command })),
  ...toAckStamp(wire),
});

const toInvalidation = (wire: SduInvalidationWire): SduInvalidation => ({
  addedRegions: sortSduRegions(wire.added_regions),
  uploadIpChanged: wire.upload_ip_changed,
});

export const toSduUpload = (wire: SduUploadWire): SduUpload => ({
  submittedAt: wire.submitted_at,
  regions: sortSduRegions(wire.regions),
  firewall: toFirewall(wire.firewall),
  accessKeyRecipients: toAccessKeyRecipients(wire.access_key_recipients),
  commands: toCommands(wire.commands),
  bdc: {
    status: wire.bdc.status,
    checkedAt: wire.bdc.checked_at,
    completedAt: wire.bdc.completed_at,
  },
  invalidation: toInvalidation(wire.invalidation),
});

// ── camel → snake (the one write body that carries a shape) ───────────────────

export const toSduDefinitionRequest = (
  definition: Pick<SduDefinition, 'targets'>,
): SduDefinitionRequestWire => ({
  targets: definition.targets.map((target) => ({
    // 저장된 적 없는 행은 id 가 없다 — 서버가 채운다. 빈 문자열을 보내면 서버가 그것을
    // "이전에 있던 행"으로 읽어 IP 변경 판정이 어긋난다.
    ...(target.targetId ? { target_id: target.targetId } : {}),
    cloud: target.cloud,
    region: target.region,
    upload_ip: target.uploadIp,
    database_types: [...target.databaseTypes],
  })),
});

// ── Calls ─────────────────────────────────────────────────────────────────────

/** assumed §1 — 1단계가 그리는 연동 대상 정의. */
export const getSduDefinition = async (
  targetSourceId: number,
  init?: { signal?: AbortSignal },
): Promise<SduDefinition> =>
  toSduDefinition(await fetchInfraJson<SduDefinitionWire>(`${base(targetSourceId)}/definition`, init));

/**
 * assumed §2 — 저장. 서버가 무효화를 다시 계산하므로 응답이 곧 새 정의다. 권역은 본문에
 * 실리지 않는다: 대상소스가 가진 값이라 이 화면이 쓸 수 있는 값이 아니다.
 */
export const putSduDefinition = async (
  targetSourceId: number,
  definition: Pick<SduDefinition, 'targets'>,
): Promise<SduDefinition> =>
  toSduDefinition(
    await fetchInfraJson<SduDefinitionWire>(`${base(targetSourceId)}/definition`, {
      method: 'PUT',
      body: toSduDefinitionRequest(definition),
    }),
  );

/** assumed §3 — 제출. 응답 본문이 없다: 단계 이동은 process-status 를 다시 읽어 안다. */
export const submitSduDefinition = async (targetSourceId: number): Promise<void> => {
  await fetchInfraJson<void>(`${base(targetSourceId)}/definition/submit`, { method: 'POST' });
};

/** assumed §4 — 4단계 전체. 모든 목록이 Region 단위로 묶여 온다. */
export const getSduUpload = async (
  targetSourceId: number,
  init?: { signal?: AbortSignal },
): Promise<SduUpload> =>
  toSduUpload(await fetchInfraJson<SduUploadWire>(`${base(targetSourceId)}/upload`, init));

/**
 * assumed §5 — 확인 응답. 예/아니오는 `confirmed` 하나이고, 되돌릴 수 있다.
 *
 * 한 블록에 답은 하나다. 화면이 "모든 Region의 …을 확인하셨습니까?" 하나만 묻기 때문에,
 * Region 단위로 저장할 답이 애초에 만들어지지 않는다. 어느 확인인지는 경로가 말한다.
 */
const putAck = async (
  targetSourceId: number,
  block: 'firewall' | 'commands',
  confirmed: boolean,
): Promise<void> => {
  await fetchInfraJson<void>(`${base(targetSourceId)}/upload/${block}/ack`, {
    method: 'PUT',
    body: { confirmed },
  });
};

/** 방화벽 결재 확인. */
export const putSduFirewallAck = (targetSourceId: number, confirmed: boolean): Promise<void> =>
  putAck(targetSourceId, 'firewall', confirmed);

/** 데이터 업로드 확인. */
export const putSduCommandsAck = (targetSourceId: number, confirmed: boolean): Promise<void> =>
  putAck(targetSourceId, 'commands', confirmed);

/**
 * assumed §6 — S3 Access Key 수신자. 이것은 **목록**이지 발송이 아니다: 키는 관리자가
 * 메일로 직접 전달하고, 화면은 누구 앞으로 가는지만 정한다.
 */
export const putSduAccessKeyRecipients = async (
  targetSourceId: number,
  userIds: readonly string[],
): Promise<void> => {
  await fetchInfraJson<void>(`${base(targetSourceId)}/upload/access-key-recipients`, {
    method: 'PUT',
    body: { user_ids: [...userIds] },
  });
};

/**
 * 2026-08-30 델타 §1 — BDC 구축 완료 단언. **관리자 콘솔만 부른다**(델타 §2).
 *
 * 한 경로가 두 방향을 진다: `true` 는 완료로 세우고, `false` 는 그 단언을 지워 §8 의 파생으로
 * 되돌린다. 응답 본문이 없으므로 화면은 `getSduUpload` 와 process-status 를 **다시 읽어**
 * 무엇이 됐는지 안다 — 단계를 움직이는 것은 서버지 이 함수가 아니다.
 */
export const putSduBdcCompletion = async (
  targetSourceId: number,
  completed: boolean,
): Promise<void> => {
  await fetchInfraJson<void>(`${base(targetSourceId)}/upload/bdc/completion`, {
    method: 'PUT',
    body: { completed },
  });
};
