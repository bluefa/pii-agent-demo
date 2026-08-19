/**
 * 연결 테스트 — pure presentation logic (no React, no I/O).
 *
 * Kept out of the card/adapter so the results→row derivations are unit-testable
 * in isolation.
 */
import type { TcExecutionStatus, TcResultRow } from '@/app/lib/api/task-queue-tc';
import type {
  ConfirmedIntegrationResourceItem,
  TestConnectionAgentResult,
  TestConnectionVersionResult,
} from '@/app/lib/api';
import type { SecretKey } from '@/lib/types';
import { foldAgentStatuses, type UnitTcStatus } from '@/lib/test-connection-summary';

/**
 * 리소스 한 건의 연결 판정.
 *
 * 출처는 `latest_version` 의 `test_connection_agent_results[]` — 계약이 선언하는
 * 유일한 per-resource 연결 상태다. 접기는 사용자 화면 Step 5 와 같은 한 벌
 * (`foldAgentStatuses`, FAIL 우선: FAIL → UNKNOWN → RUNNING → PENDING → SUCCESS)
 * 을 그대로 쓴다 — 두 화면이 같은 리소스를 다른 낱말로 부르면 안 된다.
 */
export type TcVerdict = UnitTcStatus;

/**
 * 확정 정보 표가 리소스 한 행에 대해 아는 전부 — 판정 + 로그의 열쇠(pod) + 사유.
 * pod_id/fail_reason 은 DRAFT CONTRACT passthrough (agentPodId 참조).
 */
export interface TcResourceFact {
  verdict: TcVerdict;
  /** 로그 조회의 열쇠 — 디스패치 전(PENDING)이거나 pod 가 못 뜬 실패면 null. */
  podId: string | null;
  /** 12종 허용목록 원문 — 실패가 아닌 행은 null. */
  failReason: string | null;
}

/**
 * DRAFT CONTRACT — 리소스별 `pod_id`/`fail_reason` 은 다음 install-v1 swagger 개정에
 * 실리는 필드로, 아직 codegen 타입에 없다(loose codegen 이 passthrough 로만 보존).
 * 계약이 랜딩하면 이 헬퍼들은 일반 필드 접근으로 줄인다. 빈 문자열·비문자열은 "없음".
 */
function agentPodId(agent: TestConnectionAgentResult): string | null {
  const raw: unknown = (agent as Record<string, unknown>).pod_id;
  return typeof raw === 'string' && raw !== '' ? raw : null;
}

function agentFailReason(agent: TestConnectionAgentResult): string | null {
  const raw: unknown = (agent as Record<string, unknown>).fail_reason;
  return typeof raw === 'string' && raw !== '' ? raw : null;
}

/** 실행(TargetSource) 단위 fail_reason — 밴드 사유 줄의 재료. 같은 passthrough 규칙. */
export function runFailReason(latest: TestConnectionVersionResult | null): string | null {
  if (!latest) return null;
  const raw: unknown = (latest as Record<string, unknown>).fail_reason;
  return typeof raw === 'string' && raw !== '' ? raw : null;
}

/** agent 한 건의 상태를 접기 어휘로 — runStatus 와 같은 "enum 밖은 UNKNOWN" 규칙. */
const agentVerdict = (agent: TestConnectionAgentResult): TcVerdict => {
  const status = (agent.connection_status ?? '').toUpperCase();
  return status === 'SUCCESS' || status === 'FAIL' || status === 'RUNNING' || status === 'PENDING'
    ? status
    : 'UNKNOWN';
};

/**
 * agent 결과를 리소스 단위 사실로 접는다. 판정은 `foldAgentStatuses`(FAIL 우선)이고,
 * pod·사유는 그 판정을 만든 대표 agent 의 것이다 — 실패로 접힌 리소스의 로그 링크가
 * 성공한 다른 agent 의 pod 를 열면 운영자는 엉뚱한 로그를 읽는다.
 */
export function tcFactsByResource(
  latest: TestConnectionVersionResult | null,
): Map<string, TcResourceFact> {
  const agents = (latest?.test_connection_agent_results ?? []).filter((agent) =>
    Boolean(agent?.resource_id),
  );
  const verdicts = foldAgentStatuses(agents);
  const facts = new Map<string, TcResourceFact>();
  for (const [id, verdict] of verdicts) {
    const own = agents.filter((agent) => agent.resource_id === id);
    const representative = own.find((agent) => agentVerdict(agent) === verdict) ?? own[0];
    facts.set(id, {
      verdict,
      podId: representative ? agentPodId(representative) : null,
      failReason: representative ? agentFailReason(representative) : null,
    });
  }
  return facts;
}

/** 판정만 필요한 소비자(집계)용 — 접기는 `tcFactsByResource` 한 벌뿐이다. */
export function verdictByResource(
  latest: TestConnectionVersionResult | null,
): Map<string, TcVerdict> {
  const verdicts = new Map<string, TcVerdict>();
  for (const [id, fact] of tcFactsByResource(latest)) verdicts.set(id, fact.verdict);
  return verdicts;
}

/**
 * 진행 사항 — 판정이 끝난 agent / 전체.
 *
 * 분모를 받은 agent 수로 잡으면 안 된다: 응답은 아직 보고하지 않은 agent 를 아예
 * 빼고 올 수 있어, 3건 중 2건만 끝난 실행이 "2/2 완료"(100%) 로 보인다. 분모는
 * 확정 리소스 수 — 실행이 대상으로 삼는 집합 — 로 잡고, 한 리소스를 여러 agent 가
 * 맡아 행이 그보다 많아지면 그때는 받은 행 수를 쓴다(100% 를 넘지 않도록).
 */
export function runProgress(
  latest: TestConnectionVersionResult | null,
  expectedTotal: number,
): { done: number; total: number } {
  const agents = (latest?.test_connection_agent_results ?? []).filter((agent) =>
    Boolean(agent?.resource_id),
  );
  const done = agents.filter((agent) => {
    const verdict = agentVerdict(agent);
    return verdict === 'SUCCESS' || verdict === 'FAIL';
  }).length;
  return { done, total: Math.max(expectedTotal, agents.length) };
}

/**
 * 실행 한 건의 상태. `latest_version.connection_status` 는 loose codegen 이라 `string`
 * 이므로 계약 enum 밖의 값은 UNKNOWN 으로 떨어뜨린다 — 실행 기록 표와 같은 어휘.
 */
export function runStatus(latest: TestConnectionVersionResult | null): TcExecutionStatus {
  const status = (latest?.connection_status ?? '').toUpperCase();
  return status === 'PENDING' || status === 'RUNNING' || status === 'SUCCESS' || status === 'FAIL'
    ? status
    : 'UNKNOWN';
}

/** 아직 끝나지 않은 실행 — 폴링을 계속할지, 결과를 집계할지의 기준. */
export function isRunOpen(latest: TestConnectionVersionResult | null): boolean {
  const status = runStatus(latest);
  return status === 'PENDING' || status === 'RUNNING';
}

/** Header/section summary counts. 성패는 latest_version, 논리 DB 합계는 latest-results. */
export interface TcResultStats {
  /** 최신 실행이 결과를 낸 리소스 수. */
  resourceCount: number;
  /** 연동 대상 논리 DB 합계. */
  includedTotal: number;
  /** 연동 제외 논리 DB 합계. */
  excludedTotal: number;
  successCount: number;
  failedCount: number;
  /** 아직 판정 전인 리소스. */
  runningCount: number;
  /** 계약 enum 밖의 값이 온 리소스 — 성공으로도 실패로도 세지 않는다. */
  unknownCount: number;
}

export function tcResultStats(
  rows: readonly TcResultRow[],
  latest: TestConnectionVersionResult | null,
): TcResultStats {
  const stats: TcResultStats = {
    resourceCount: 0,
    includedTotal: 0,
    excludedTotal: 0,
    successCount: 0,
    failedCount: 0,
    runningCount: 0,
    unknownCount: 0,
  };
  const verdicts = verdictByResource(latest);
  // 표의 셀과 같은 게이트(ldbCount) — 붙지 않은 리소스의 건수를 합계에 넣으면 카드와
  // 표가 서로 다른 말을 한다. latest-results 는 최신 실행이 성공했을 때의 스냅샷이라,
  // 실패한 실행 뒤에도 직전 성공분이 남아 있을 수 있다.
  for (const row of rows) {
    if (verdicts.get(row.resourceId) !== 'SUCCESS') continue;
    stats.includedTotal += row.includedCount ?? 0;
    stats.excludedTotal += row.excludedCount ?? 0;
  }
  for (const verdict of verdicts.values()) {
    stats.resourceCount += 1;
    if (verdict === 'SUCCESS') stats.successCount += 1;
    else if (verdict === 'FAIL') stats.failedCount += 1;
    else if (verdict === 'RUNNING' || verdict === 'PENDING') stats.runningCount += 1;
    else stats.unknownCount += 1;
  }
  return stats;
}

/**
 * 실행 소요 시간(초). 두 시각이 모두 있고 순서가 맞을 때만 값을 낸다 — 진행 중인 실행이나
 * 시각이 빠진 행은 `null` 이고, 카드에서 "—" 로 표기된다.
 */
export function runDurationSeconds(
  requestedAt: string | null,
  completedAt: string | null,
): number | null {
  if (!requestedAt || !completedAt) return null;
  const start = Date.parse(requestedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

/**
 * 확정 리소스를 Step 2(연동 요청) 표와 같은 순서로 정렬한다. 두 화면이 같은 리소스를
 * 다른 순서로 보여주면 관리자가 행을 눈으로 대조할 수 없다.
 *
 * 요청 목록에 없는 리소스(요청 이후 추가/변경분)는 원래 순서를 유지한 채 뒤에 붙는다 —
 * 임의로 섞거나 숨기지 않는다. 요청 목록을 못 받았으면 확정 순서를 그대로 쓴다.
 */
export function orderByRequest<T extends { resource_id?: string | null }>(
  rows: readonly T[],
  requestOrder: readonly string[],
): T[] {
  if (requestOrder.length === 0) return [...rows];
  const rank = new Map(requestOrder.map((id, index) => [id, index]));
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ra = rank.get(a.row.resource_id ?? '') ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.row.resource_id ?? '') ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** One credential list row: a contract credential, or an assignment the list lost. */
export interface CredentialEntry {
  name: string;
  /** last_updated_time — absent for an entry reconstructed from an assignment. */
  updatedAt: string | null;
  /** 확정 리소스 중 이 credential 을 쓰는 건수. */
  assignedCount: number;
  /** GET …/secrets 응답에 없는 이름 (배정에서만 발견). */
  missing: boolean;
}

/**
 * secrets ∪ (배정에만 존재하는 이름). Sorted: 목록에 없는 것 먼저 (조치가 필요한 쪽),
 * 그다음 배정 많은 순, 마지막으로 이름순.
 */
export function credentialEntries(
  secrets: readonly SecretKey[],
  rows: readonly ConfirmedIntegrationResourceItem[],
): CredentialEntry[] {
  const assigned = new Map<string, number>();
  for (const row of rows) {
    if (row.credential_id) assigned.set(row.credential_id, (assigned.get(row.credential_id) ?? 0) + 1);
  }
  const known = new Set(secrets.map((secret) => secret.name));
  const entries: CredentialEntry[] = secrets.map((secret) => ({
    name: secret.name,
    updatedAt: secret.lastUpdatedTime || null,
    assignedCount: assigned.get(secret.name) ?? 0,
    missing: false,
  }));
  for (const [name, count] of assigned) {
    if (!known.has(name)) entries.push({ name, updatedAt: null, assignedCount: count, missing: true });
  }
  return entries.sort(
    (a, b) =>
      Number(b.missing) - Number(a.missing)
      || b.assignedCount - a.assignedCount
      || a.name.localeCompare(b.name),
  );
}

/** 이름 부분 일치(대소문자·양끝 공백 무시). 계약에 그룹 필드가 없어 검색만 제공한다. */
export function filterCredentials(
  entries: readonly CredentialEntry[],
  query: string,
): CredentialEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  return entries.filter((entry) => entry.name.toLowerCase().includes(q));
}

/** The confirmed table's three conditions. An empty string = do not filter on that axis. */
export interface ConfirmedRowFilter {
  query: string;
  dbType: string;
  region: string;
}

/**
 * Search and filter over confirmed resources — the same three axes as the Step 6·7
 * confirmed table (search · Database Type · Region). The search matches Resource ID AND
 * Resource Name: an operator looks up whichever of the two they happen to know.
 *
 * `labelOfDbType` must return the string the table actually prints — comparing against
 * the wire value (mysql) never equals the cell's MySQL, so no row would ever pass.
 */
export function filterConfirmedRows(
  rows: readonly ConfirmedIntegrationResourceItem[],
  filter: ConfirmedRowFilter,
  labelOfDbType: (row: ConfirmedIntegrationResourceItem) => string,
): ConfirmedIntegrationResourceItem[] {
  const needle = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.dbType && labelOfDbType(row) !== filter.dbType) return false;
    if (filter.region && (row.database_region ?? '') !== filter.region) return false;
    if (!needle) return true;
    return (
      row.resource_id.toLowerCase().includes(needle)
      || (row.resource_name ?? '').toLowerCase().includes(needle)
      // An IDC row has no name and does not print its id — its address is the only
      // identity on the screen, so it has to be what the box matches.
      || (row.idc_host ?? '').toLowerCase().includes(needle)
      || (row.idc_ips ?? []).some((ip) => ip.toLowerCase().includes(needle))
    );
  });
}

export type LdbTab = 'inc' | 'exc';

/**
 * 논리 DB count cell value: the count only when this resource's run verdict is
 * SUCCESS *and* the wire carried the count. Any other case (FAIL, 판정 전, 결과 행
 * 없음, or a SUCCESS whose count the wire omitted) → `null`, which the table
 * renders as "—" with no drill-down link (never a false "0").
 */
export function ldbCount(
  row: TcResultRow | undefined,
  tab: LdbTab,
  verdict: TcVerdict | undefined,
): number | null {
  if (!row || verdict !== 'SUCCESS') return null;
  return tab === 'inc' ? row.includedCount : row.excludedCount;
}
