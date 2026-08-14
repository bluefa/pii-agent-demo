/**
 * 연결 테스트 — pure presentation logic (no React, no I/O).
 *
 * Kept out of the card/adapter so the results→row derivations are unit-testable
 * in isolation.
 */
import type { TcExecutionStatus, TcResultRow } from '@/app/lib/api/task-queue-tc';
import type { ConfirmedIntegrationResourceItem, TestConnectionVersionResult } from '@/app/lib/api';
import type { SecretKey } from '@/lib/types';

/**
 * 리소스 한 건의 연결 판정.
 *
 * 출처는 `latest_version` 의 `test_connection_agent_results[]` — 계약이 선언하는
 * 유일한 per-resource 연결 상태다. `latest-results` 의 `connection_status` 는 계약에
 * 없는 passthrough 필드라 여기서 쓰지 않는다.
 */
export type TcVerdict = 'SUCCESS' | 'FAIL' | 'RUNNING' | 'PENDING' | 'UNKNOWN';

/**
 * agent 결과를 리소스 단위로 접는다. 한 리소스에 agent 가 여럿일 수 있어 규칙이 필요한데,
 * 부분 성공을 성공으로 올리지 않는 쪽으로 잡았다 —
 *   하나라도 FAIL          → FAIL
 *   아니고 PENDING/RUNNING → RUNNING (아직 판정 전)
 *   아니고 알 수 없는 값    → UNKNOWN (임의로 성공 처리하지 않는다)
 *   전부 SUCCESS           → SUCCESS
 *
 * PENDING 은 여기서 나오지 않는다. 대기와 실행이 섞인 리소스를 "대기"라고 부를 수 없어
 * 둘 다 진행 중으로 접는다 — PENDING/RUNNING 의 구분은 agent 한 건을 볼 때만 성립한다
 * (`runAgentRows`).
 */
export function verdictByResource(
  latest: TestConnectionVersionResult | null,
): Map<string, TcVerdict> {
  const kinds = new Map<string, { fail: number; open: number; unknown: number; ok: number }>();
  for (const agent of latest?.test_connection_agent_results ?? []) {
    const id = agent?.resource_id;
    if (!id) continue;
    const bucket = kinds.get(id) ?? { fail: 0, open: 0, unknown: 0, ok: 0 };
    const status = (agent.connection_status ?? '').toUpperCase();
    if (status === 'FAIL') bucket.fail += 1;
    else if (status === 'PENDING' || status === 'RUNNING') bucket.open += 1;
    else if (status === 'SUCCESS') bucket.ok += 1;
    else bucket.unknown += 1;
    kinds.set(id, bucket);
  }
  const verdicts = new Map<string, TcVerdict>();
  for (const [id, bucket] of kinds) {
    verdicts.set(
      id,
      bucket.fail > 0 ? 'FAIL'
        : bucket.open > 0 ? 'RUNNING'
          : bucket.unknown > 0 || bucket.ok === 0 ? 'UNKNOWN'
            : 'SUCCESS',
    );
  }
  return verdicts;
}

/** 실행이 보고한 agent 결과 한 줄 — 접기 전의 원문 순서 그대로. */
export interface TcAgentRow {
  resourceId: string;
  /** 계약상 optional — 응답이 주지 않으면 null. */
  agentId: string | null;
  /** 이 agent 한 건의 판정 (리소스 단위 fold 가 아니다). */
  verdict: TcVerdict;
}

/**
 * agent 결과를 화면 순서대로 편다. `verdictByResource` 가 접기 전의 원재료 —
 * 한 리소스를 여러 agent 가 나눠 맡을 수 있어서, 어느 agent 가 어디서 걸렸는지는
 * 접힌 판정으로는 알 수 없다.
 *
 * 여기서는 PENDING(아직 시작 안 함)과 RUNNING(붙는 중)을 계약이 나눈 그대로 둔다.
 * 30건짜리 실행에서 "10건이 아직 시작도 안 했다"와 "10건이 붙는 중이다"는 운영자에게
 * 다른 사실이다.
 */
export function runAgentRows(latest: TestConnectionVersionResult | null): TcAgentRow[] {
  return (latest?.test_connection_agent_results ?? [])
    .filter((agent) => Boolean(agent?.resource_id))
    .map((agent) => {
      const status = (agent.connection_status ?? '').toUpperCase();
      return {
        resourceId: agent.resource_id ?? '',
        agentId: agent.agent_id || null,
        verdict:
          status === 'SUCCESS' ? 'SUCCESS'
            : status === 'FAIL' ? 'FAIL'
              : status === 'RUNNING' ? 'RUNNING'
                : status === 'PENDING' ? 'PENDING'
                  : 'UNKNOWN',
      };
    });
}

/** 조치가 필요한 순서 — 실패가 맨 위, 이미 끝난 성공이 맨 아래. */
export const AGENT_VERDICT_ORDER: readonly TcVerdict[] = [
  'FAIL',
  'RUNNING',
  'PENDING',
  'UNKNOWN',
  'SUCCESS',
];

/**
 * 판정 순으로 세운다. wire 순서에는 의미가 없고, 30건 목록에서 실패가 27번째 줄에
 * 있으면 목록이 없는 것과 같다. 같은 판정 안에서는 받은 순서를 지킨다(안정 정렬).
 */
export function sortAgentRows(rows: readonly TcAgentRow[]): TcAgentRow[] {
  const rank = new Map(AGENT_VERDICT_ORDER.map((verdict, index) => [verdict, index]));
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        (rank.get(a.row.verdict) ?? 0) - (rank.get(b.row.verdict) ?? 0) || a.index - b.index,
    )
    .map((entry) => entry.row);
}

/** 판정별 건수 — 필터 칩이 "몇 건인지"를 눌러보기 전에 말하게 한다. */
export function countAgentVerdicts(rows: readonly TcAgentRow[]): Record<TcVerdict, number> {
  const counts: Record<TcVerdict, number> = {
    FAIL: 0,
    RUNNING: 0,
    PENDING: 0,
    UNKNOWN: 0,
    SUCCESS: 0,
  };
  for (const row of rows) counts[row.verdict] += 1;
  return counts;
}

/**
 * 진행 사항 — 판정이 끝난 agent / 전체.
 *
 * 분모를 `rows.length` 로 잡으면 안 된다: 응답은 아직 보고하지 않은 agent 를 아예
 * 빼고 오기 때문에, 3건 중 2건만 끝난 실행이 "2/2 완료"(100%) 로 보인다. 분모는
 * 확정 리소스 수 — 실행이 대상으로 삼는 집합 — 로 잡고, 한 리소스를 여러 agent 가
 * 맡아 행이 그보다 많아지면 그때는 받은 행 수를 쓴다(100% 를 넘지 않도록).
 */
export function runProgress(
  rows: readonly TcAgentRow[],
  expectedTotal: number,
): { done: number; total: number } {
  return {
    done: rows.filter((row) => row.verdict === 'SUCCESS' || row.verdict === 'FAIL').length,
    total: Math.max(expectedTotal, rows.length),
  };
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
    else if (verdict === 'RUNNING') stats.runningCount += 1;
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
