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

export interface SduDefinitionWire {
  /** Read-only — derived from `metadata.is_china_region`, never written by this screen. */
  region_scope: SduRegionScope;
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

export interface SduFirewallWire {
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

export interface SduCommandsWire {
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

export interface SduRecipientsRequestWire {
  user_ids: string[];
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
  regionScope: SduRegionScope;
  targets: SduTarget[];
  updatedAt: string | null;
}

export interface SduFirewallRow {
  region: SduRegion;
  s3Endpoint: string;
  port: number;
  destinationIps: string[];
}

export interface SduFirewall {
  rows: SduFirewallRow[];
  acked: boolean;
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
