/**
 * SDU (Self Data Upload) owner flow — hand-written types.
 *
 * ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md.
 *
 * `docs/swagger/install-v1.yaml` says three things about SDU and nothing more:
 * `cloud_provider: SDU`, `metadata.is_sdu_type`, `metadata.is_china_region`, plus the
 * two terraform names `SDU_BDC_SERVICE_COMMON` / `SDU_BDC_SERVICE`. There is no SDU
 * operation in it. So none of the shapes below may live in `lib/generated/*` — they are
 * ours until the BFF declares them, and this file is the one place they are written.
 *
 * Wire types are snake_case (`…Wire`); the view types the UI reads are camelCase. The
 * boundary between them is `app/lib/api/sdu.ts`, nowhere else.
 *
 * SDU is NOT a `CloudProvider` (see `isSduTarget` in `@/lib/types`) — it names how the
 * data arrives, not where it lives. Nothing here widens that union.
 */

// ── Region scope (권역) ────────────────────────────────────────────────────────

export const SDU_REGION_SCOPES = ['GLOBAL', 'CHINA'] as const;
export type SduRegionScope = (typeof SDU_REGION_SCOPES)[number];

/**
 * Canonical region order. Every list of regions this domain returns is sorted by it, so
 * the firewall table and the command blocks cannot disagree about order.
 */
export const SDU_REGION_ORDER = ['asia', 'us', 'eu', 'cx', 'china'] as const;
export type SduRegion = (typeof SDU_REGION_ORDER)[number];

/**
 * A scope owns its regions exclusively. CHINA has exactly one, which is why a China
 * target source always has a single upload path (one firewall row, one command block).
 *
 * Which scope a target source is in is NOT a choice — it is read from the target source's
 * `metadata.is_china_region` (`project.isChinaRegion`), the same field AWS branches on.
 */
export const SDU_REGIONS_BY_SCOPE: Record<SduRegionScope, readonly SduRegion[]> = {
  GLOBAL: ['asia', 'us', 'eu', 'cx'],
  CHINA: ['china'],
};

/** Display names. `asia` is our own name, not an AWS region code. */
export const SDU_REGION_LABEL: Record<SduRegion, string> = {
  asia: 'Asia',
  us: 'US',
  eu: 'EU',
  cx: 'CX',
  china: 'China',
};

// ── Target row ────────────────────────────────────────────────────────────────

export const SDU_CLOUDS = ['AWS', 'GCP', 'AZURE', 'IDC', 'OTHER'] as const;
export type SduCloud = (typeof SDU_CLOUDS)[number];

/** Per-target caps on the free-text Database Type list. */
export const SDU_DB_TYPE_MAX = 20;
export const SDU_DB_TYPE_MAXLEN = 50;

// ── Wire (snake_case) ─────────────────────────────────────────────────────────

export interface SduTargetWire {
  target_id: string;
  cloud: SduCloud;
  region: SduRegion;
  upload_ip: string;
  database_types: string[];
}

/**
 * 권역(`region_scope`)은 여기 없다. 대상 소스가 이미 가진 사실(`metadata.is_china_region`,
 * `project.isChinaRegion`)이라 이 응답이 다시 실어 오면 같은 값의 출처가 둘이 되고, 둘이
 * 어긋나는 날 화면은 어느 쪽을 믿을지 모른다. 화면은 대상 소스에서 읽는다.
 */
export interface SduDefinitionWire {
  targets: SduTargetWire[];
  updated_at: string | null;
}

/** PUT body. `target_id` is absent for a row the client has not saved before. */
export interface SduDefinitionRequestTargetWire {
  target_id?: string;
  cloud: SduCloud;
  region: SduRegion;
  upload_ip: string;
  database_types: string[];
}

/** No `region_scope`: the scope is the target source's, so a write cannot carry it. */
export interface SduDefinitionRequestWire {
  targets: SduDefinitionRequestTargetWire[];
}

export interface SduFirewallRowWire {
  region: SduRegion;
  s3_endpoint: string;
  port: number;
  destination_ips: string[];
}

/**
 * `acked_at` · `acked_by` 는 **관리자 몫이다.** 담당자 화면은 자기가 방금 누른 답에 시각을
 * 붙여 읽지 않고, 승인 조건 ①의 근거 행이 읽는다. 그래서 wire 에는 있고 view 에는 없다
 * (`app/lib/api/sdu.ts` 가 접지 않는다). 되돌린 답도 갱신이지 비움이 아니다 — 되돌린 것도
 * 누군가 한 일이다.
 */
export interface SduAckStampWire {
  acked_at: string | null;
  acked_by: SduRecipientWire | null;
}

export interface SduFirewallWire extends SduAckStampWire {
  rows: SduFirewallRowWire[];
  /** One answer for the whole step — the screen asks one question for every Region. */
  acked: boolean;
}

/** 한 사람. S3 Access Key 를 받을 사람이고, 그 이상의 뜻은 없다. */
export interface SduRecipientWire {
  id: string;
  name: string;
  email: string;
}

export interface SduAccessKeyRecipientsWire {
  users: SduRecipientWire[];
  updated_at: string | null;
}

export interface SduCommandRowWire {
  region: SduRegion;
  /** Three lines verbatim. The screen never parses it — see the doc's §4 note. */
  command: string;
}

export interface SduCommandsWire extends SduAckStampWire {
  rows: SduCommandRowWire[];
  acked: boolean;
}

export type SduBdcStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface SduBdcWire {
  status: SduBdcStatus;
  checked_at: string;
  completed_at: string | null;
}

/**
 * What the last definition edit invalidated. Cleared on the next ack write — it exists
 * to be told once, not to be a persistent state.
 *
 * A removed region is not here: with one answer per step, dropping a region leaves the
 * remaining answer true, so there is nothing to tell.
 */
export interface SduInvalidationWire {
  added_regions: SduRegion[];
  upload_ip_changed: boolean;
}

export interface SduUploadWire {
  submitted_at: string | null;
  regions: SduRegion[];
  firewall: SduFirewallWire;
  access_key_recipients: SduAccessKeyRecipientsWire;
  commands: SduCommandsWire;
  bdc: SduBdcWire;
  invalidation: SduInvalidationWire;
}

/**
 * 확인 응답의 본문. 어느 확인인지는 **경로가 말한다**(`…/upload/firewall/ack` ·
 * `…/upload/commands/ack`) — 이 저장소가 쓰기를 가르는 방식이 그것이다
 * (`approval-requests/{approve|reject}`, `support-raw-data/{enabled|disabled}`).
 */
export interface SduAckRequestWire {
  confirmed: boolean;
}


// ── View (camelCase) ──────────────────────────────────────────────────────────

export interface SduTarget {
  targetId: string;
  cloud: SduCloud;
  region: SduRegion;
  uploadIp: string;
  databaseTypes: string[];
}

export interface SduDefinition {
  targets: SduTarget[];
  updatedAt: string | null;
}

export interface SduFirewallRow {
  region: SduRegion;
  s3Endpoint: string;
  port: number;
  destinationIps: string[];
}

/**
 * `ackedAt` 는 시각을 그리려고 접는 것이 아니다 — **답이 있었는지**를 말한다. `acked` 만으로는
 * 「아니오」와 「아직 안 물어봄」이 같은 false 라, 새로고침하면 저장된 아니오가 미답으로 보인다.
 * (`ackedBy` 는 관리자 근거 행만 읽으므로 여기 없다.)
 */
export interface SduFirewall {
  rows: SduFirewallRow[];
  acked: boolean;
  ackedAt: string | null;
}

export interface SduRecipient {
  id: string;
  name: string;
  email: string;
}

export interface SduAccessKeyRecipients {
  users: SduRecipient[];
  updatedAt: string | null;
}

export interface SduCommandRow {
  region: SduRegion;
  command: string;
}

export interface SduCommands {
  rows: SduCommandRow[];
  acked: boolean;
  ackedAt: string | null;
}

export interface SduBdc {
  status: SduBdcStatus;
  checkedAt: string;
  completedAt: string | null;
}

export interface SduInvalidation {
  addedRegions: SduRegion[];
  uploadIpChanged: boolean;
}

export interface SduUpload {
  submittedAt: string | null;
  regions: SduRegion[];
  firewall: SduFirewall;
  accessKeyRecipients: SduAccessKeyRecipients;
  commands: SduCommands;
  bdc: SduBdc;
  invalidation: SduInvalidation;
}

// ── Guards ────────────────────────────────────────────────────────────────────

export const isSduRegion = (value: unknown): value is SduRegion =>
  typeof value === 'string' && (SDU_REGION_ORDER as readonly string[]).includes(value);

export const isSduCloud = (value: unknown): value is SduCloud =>
  typeof value === 'string' && (SDU_CLOUDS as readonly string[]).includes(value);

/** Canonical order, duplicates dropped. */
export const sortSduRegions = (regions: readonly SduRegion[]): SduRegion[] =>
  SDU_REGION_ORDER.filter((region) => regions.includes(region));
