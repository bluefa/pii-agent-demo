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
 * 붙여 읽지 않고, 승인 조건 ①의 근거 행과 운영 콘솔의 「담당자 입력 정보」가 읽는다.
 * 되돌린 답도 갱신이지 비움이 아니다 — 되돌린 것도 누군가 한 일이다.
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
  /**
   * 완료를 **단언한 사람** (2026-08-30 델타 §2). 파생값이던 시절에는 저자가 없었지만,
   * 단언에는 있다 — 그리고 그 단언 하나가 대상 소스를 ProcessStatus 5 로 옮긴다. 두 확인이
   * `acked_by` 를 지는 것과 같은 이유이고 같은 모양이다. 되돌리기와 초기화가 함께 비운다.
   */
  completed_by: SduRecipientWire | null;
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

/**
 * BDC 구축 완료 **단언**의 본문 (2026-08-30 델타 §1).
 *
 * 완료와 되돌리기는 같은 사실의 두 값이라 경로가 하나이고 본문이 boolean 하나다 — 확인
 * 답변이 두 경로인 것은 방화벽과 업로드가 서로 다른 사실이기 때문이었지 값이 둘이어서가
 * 아니다. 이름이 `confirmed` 가 아닌 이유도 같다: 확인은 담당자의 어휘이고, 이것은 관리자가
 * BDC 쪽 작업에 대해 하는 말이다.
 */
export interface SduBdcCompletionRequestWire {
  completed: boolean;
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
 *
 * `ackedBy` 는 담당자 화면이 아니라 **관리자**의 것이다(계약 §5) — 운영 콘솔의 근거 행이
 * 「방화벽 확인 · 홍길동 · 08-25 10:40」을 쓴다. 오래 뷰에서 빠져 있었는데, 그때는 이 응답을
 * 읽는 화면이 담당자쪽 하나뿐이었기 때문이다.
 */
export interface SduFirewall {
  rows: SduFirewallRow[];
  acked: boolean;
  ackedAt: string | null;
  ackedBy: SduRecipient | null;
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
  ackedBy: SduRecipient | null;
}

export interface SduBdc {
  status: SduBdcStatus;
  checkedAt: string;
  completedAt: string | null;
  completedBy: SduRecipient | null;
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

// ── Ack answer ────────────────────────────────────────────────────────────────

/**
 * 한 확인 블록의 답 — 계약 §5 의 규칙 하나를 담는 유일한 자리.
 *
 * `acked: false` 는 **두 가지 뜻**이다: 담당자가 「아니오」라고 답했거나, 아무도 아직
 * 답하지 않았거나. 가르는 것은 `ackedAt` 이다 — 확인 답변은 `false` 를 쓸 때도 반드시
 * 시각을 남기므로, 시각이 없다는 것은 답한 적이 없다는 뜻이다(무효화 §3.1 은 답과 도장을
 * 함께 비우므로 그때는 null 이 맞다). 저장된 「아니오」를 미답으로 그리면 담당자는 자기가
 * 답한 적 없다고 읽고, 관리자의 근거 행은 없는 사실을 말한다.
 *
 * 이 판정이 이 파일에 사는 이유는 **읽는 화면이 셋**이기 때문이다 — 담당자 2단계 블록,
 * 운영 콘솔의 「담당자 입력 정보」, 그리고 승인 조건 ①. 손으로 옮겨 적으면 갈라지고,
 * 갈라지는 지점이 정확히 위 문단이 막으려는 버그다.
 *
 * @returns `true` 예 · `false` 아니오 · `null` 미답
 */
export const sduAckAnswer = (block: {
  acked: boolean;
  ackedAt: string | null;
}): boolean | null => {
  // `acked` 가 참이면 도장을 보지 않는다 — 도장을 빠뜨린 응답에서 「예」를 미답으로
  // 되돌리는 것은 있는 답을 지우는 쪽이고, 그 방향의 오류가 더 나쁘다.
  if (block.acked) return true;
  return block.ackedAt === null ? null : false;
};

/**
 * 그 답을 부르는 낱말. `SDU_REGION_LABEL` 과 같은 자리에 두는 이유도 같다 — 두 화면이
 * (담당자 2단계·운영 콘솔 조건 ①) 같은 값을 다른 낱말로 부르면 근거 행이 갈린다.
 */
export const sduAckLabel = (answer: boolean | null): string =>
  answer === null ? '미답' : answer ? '예' : '아니오';

// ── Guards ────────────────────────────────────────────────────────────────────

export const isSduRegion = (value: unknown): value is SduRegion =>
  typeof value === 'string' && (SDU_REGION_ORDER as readonly string[]).includes(value);

export const isSduCloud = (value: unknown): value is SduCloud =>
  typeof value === 'string' && (SDU_CLOUDS as readonly string[]).includes(value);

/** Canonical order, duplicates dropped. */
export const sortSduRegions = (regions: readonly SduRegion[]): SduRegion[] =>
  SDU_REGION_ORDER.filter((region) => regions.includes(region));
