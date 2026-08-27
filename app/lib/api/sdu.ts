/**
 * CSR helpers for the SDU (Self Data Upload) owner flow.
 *
 * ASSUMED contracts (docs/api/sdu-assumed-contracts.md §1–§7) — the Next routes exist,
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
  SduAckKind,
  SduCommands,
  SduCommandsWire,
  SduDefinition,
  SduDefinitionRequestWire,
  SduDefinitionWire,
  SduFirewall,
  SduFirewallWire,
  SduInvalidation,
  SduInvalidationWire,
  SduRecipients,
  SduRecipientsWire,
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
  regionScope: wire.region_scope,
  targets: wire.targets.map(toTarget),
  updatedAt: wire.updated_at,
});

export const toSduFirewall = (wire: SduFirewallWire): SduFirewall => ({
  queriedAt: wire.queried_at,
  rows: wire.rows.map((row) => ({
    region: row.region,
    s3Endpoint: row.s3_endpoint,
    port: row.port,
    destinationIps: [...row.destination_ips],
  })),
  ackedRegions: sortSduRegions(wire.acked_regions),
});

const toRecipients = (wire: SduRecipientsWire): SduRecipients => ({
  users: wire.users.map((user) => ({ id: user.id, name: user.name, email: user.email })),
  updatedAt: wire.updated_at,
});

const toCommands = (wire: SduCommandsWire): SduCommands => ({
  rows: wire.rows.map((row) => ({ region: row.region, command: row.command })),
  ackedRegions: sortSduRegions(wire.acked_regions),
});

const toInvalidation = (wire: SduInvalidationWire): SduInvalidation => ({
  addedRegions: sortSduRegions(wire.added_regions),
  removedRegions: sortSduRegions(wire.removed_regions),
  uploadIpChanged: wire.upload_ip_changed,
});

export const toSduUpload = (wire: SduUploadWire): SduUpload => ({
  submittedAt: wire.submitted_at,
  regions: sortSduRegions(wire.regions),
  firewall: toSduFirewall(wire.firewall),
  recipients: toRecipients(wire.recipients),
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

/** assumed §5 — 다시 조회. 행은 그대로고 조회 시각만 새로 찍힌다. */
export const refreshSduFirewall = async (targetSourceId: number): Promise<SduFirewall> =>
  toSduFirewall(
    await fetchInfraJson<SduFirewallWire>(`${base(targetSourceId)}/upload/firewall/refresh`, {
      method: 'POST',
    }),
  );

/** assumed §6 — 확인 응답. 예/아니오는 `confirmed` 하나이고, 되돌릴 수 있다. */
export const putSduAcks = async (
  targetSourceId: number,
  body: { kind: SduAckKind; regions: readonly SduRegion[]; confirmed: boolean },
): Promise<void> => {
  await fetchInfraJson<void>(`${base(targetSourceId)}/upload/acks`, {
    method: 'PUT',
    body: { kind: body.kind, regions: [...body.regions], confirmed: body.confirmed },
  });
};

/**
 * assumed §7 — S3 Access Key 수신자. 이것은 **목록**이지 발송이 아니다: 키는 관리자가
 * 메일로 직접 전달하고, 화면은 누구 앞으로 가는지만 정한다.
 */
export const putSduRecipients = async (
  targetSourceId: number,
  userIds: readonly string[],
): Promise<void> => {
  await fetchInfraJson<void>(`${base(targetSourceId)}/upload/recipients`, {
    method: 'PUT',
    body: { user_ids: [...userIds] },
  });
};
