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
import { needsCredential, type SecretKey } from '@/lib/types';
import {
  computeTcBuckets,
  foldAgentStatuses,
  tcSummarySentence,
  type TcBuckets,
  type TcRunPhase,
  type UnitTcStatus,
} from '@/lib/test-connection-summary';
import { resultUnitId } from '@/lib/resource-grouping';
import { POD_CREATION_FAILED } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/failReason';

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

/** Pod 로그 칸이 할 수 있는 네 마디 — 표는 이 중 하나만 그린다. */
export type PodLogState = 'LOG' | 'BEFORE_POD' | 'NO_POD' | 'UNREPORTED';

/**
 * pod 가 없다는 말을 언제 해도 되는가.
 *
 * `pod_id` 는 아직 랜딩 전 필드다(DRAFT). 실계약 응답에는 실리지 않으므로 "값이 없다"를
 * 곧바로 "pod 가 안 떴다"로 읽으면, 멀쩡히 성공한 행까지 전부 `Pod 없음`을 달게 된다.
 * 그래서 영영 없다는 말은 사유가 POD_CREATION_FAILED 라고 말해 줄 때만 한다 — 그 값이
 * 이 계약에서 pod 없는 실패를 뜻하는 유일한 사유다. 사유가 말하지 않으면 우리도 모른다.
 *
 * 실행이 아직 열려 있으면(대기·진행 중) pod 는 **아직** 안 생긴 것이라 문장이 다르다.
 * 보고 자체가 없는 행(fact 없음)은 pod 부재와 다른 사실이라 또 따로 둔다.
 *
 * pod 가 있으면 실행 단계와 무관하게 연다(오너 2026-08-25). 로그는 pod 가 뜬 순간부터
 * 쌓이므로 진행 중에도 읽을 것이 있고, 그때가 바로 운영자가 가장 보고 싶어 하는 때다.
 */
export function podLogState(fact: TcResourceFact | undefined): PodLogState {
  if (!fact) return 'UNREPORTED';
  if (fact.podId) return 'LOG';
  if (fact.verdict === 'PENDING' || fact.verdict === 'RUNNING') return 'BEFORE_POD';
  return fact.failReason === POD_CREATION_FAILED ? 'NO_POD' : 'UNREPORTED';
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

/**
 * 표 한 행 = 연결 테스트가 실제로 보고하는 단위.
 *
 * Athena 는 Step 4 부터 리전이 곧 리소스다 — 판정도 논리 DB 건수도
 * `athena_region_resource_id`(`athena:<acct>:<region>/<catalog>`) 로만 오고,
 * 데이터베이스별로는 오지 않는다. 확정 스냅샷은 DB 단위라 DB 의 자기 id 로 조회하면
 * 어느 결과에도 닿지 못한다 — 연결 상태·실패 사유·Pod 로그가 전부 무보고(—)로 보이고,
 * 같은 리전이 여러 행을 차지해 "테스트가 4번 돌았다"고 읽힌다.
 *
 * 사용자 화면 Step 5(ConnectionTestCard)·Step 6·7(ConfirmedIntegrationTable)이 이미
 * 같은 키로 접는다. 키는 계약 필드 그대로 쓰고(`resultUnitId`), 아무것도 파싱하지 않는다.
 */
export interface ConfirmedUnit {
  /** 판정·논리 DB 를 조회하는 키 — Athena 는 리전 id, 그 외는 리소스 자신의 id. */
  unitId: string;
  /** 이 단위가 덮는 확정 행 — 한 건, 또는 한 리전의 데이터베이스 전부. */
  members: ConfirmedIntegrationResourceItem[];
  /** 리전을 대표하는 행인가 — 자식(데이터베이스) 목록을 접었다 펴는 행. */
  folded: boolean;
}

export function toConfirmedUnits(
  rows: readonly ConfirmedIntegrationResourceItem[],
): ConfirmedUnit[] {
  const units: ConfirmedUnit[] = [];
  const byUnitId = new Map<string, ConfirmedUnit>();
  for (const row of rows) {
    const unitId = resultUnitId({
      resourceId: row.resource_id,
      athenaRegionResourceId: row.athena_region_resource_id,
    });
    const existing = byUnitId.get(unitId);
    if (existing) {
      existing.members.push(row);
      continue;
    }
    const unit: ConfirmedUnit = {
      unitId,
      members: [row],
      folded: !!row.athena_region_resource_id,
    };
    byUnitId.set(unitId, unit);
    units.push(unit);
  }
  return units;
}

/**
 * 밴드가 그리는 국면. 사용자 화면 Step 5 의 `TcRunPhase` 다섯에 `unknown` 하나를 더한다 —
 * `connection_status` 는 loose codegen 이라 계약 밖 값이 올 수 있고, 그걸 `fail` 로 접으면
 * 밴드가 "연결 테스트가 실패했어요" 라고 없는 사실을 단정한다. 관리자 화면은 그 자리에서
 * 판정을 보류할 수 있어야 한다(운영자가 원문을 보고 판단하는 화면이다).
 *
 * ⛔ Step 5 의 `policy-changed`·`confirmed` 는 여기 없다 — 그 둘은 completion-status 가
 * 가르는데 이 탭은 그 엔드포인트를 부르지 않는다. 상태를 늘리기 전에 조회부터 붙일 것.
 */
export type TcBandPhase = TcRunPhase | 'unknown';

export function runBandPhase(latest: TestConnectionVersionResult | null): TcBandPhase {
  if (!latest) return 'idle';
  switch (runStatus(latest)) {
    case 'PENDING':
      return 'queued';
    case 'RUNNING':
      return 'running';
    case 'SUCCESS':
      return 'success';
    case 'FAIL':
      return 'fail';
    default:
      return 'unknown';
  }
}

/** 국면 문장 — `unknown` 만 이쪽 어휘이고 나머지는 Step 5 와 한 글자도 다르지 않다. */
export function bandSentence(phase: TcBandPhase, buckets: TcBuckets): string {
  return phase === 'unknown'
    ? '실행 상태를 판정할 수 없어요'
    : tcSummarySentence(phase, buckets);
}

/**
 * 버킷의 분모가 되는 단위 목록.
 *
 * 원칙은 확정 스냅샷의 단위 — 실행이 대상으로 삼는 집합이고, 그래야 "무보고"가 셀 수 있는
 * 사실이 된다. 다만 확정 조회가 404(연동 확정 전)이거나 실패했는데 실행은 있는 경우가
 * 있어서, 그때는 실행이 실제로 보고한 id 로 떨어진다. 빈 목록을 그대로 쓰면 total 0 ·
 * ok 0 이 되어 `ok === total` 이 성립하고, 문장이 "모든 리소스가 연결에 성공했어요" 라고
 * 아무것도 확인하지 않은 실행을 성공이라 부른다.
 */
export function bandUnitIds(
  units: readonly ConfirmedUnit[],
  latest: TestConnectionVersionResult | null,
): string[] {
  if (units.length > 0) return units.map((unit) => unit.unitId);
  const reported = new Set<string>();
  for (const agent of latest?.test_connection_agent_results ?? []) {
    if (agent?.resource_id) reported.add(agent.resource_id);
  }
  return [...reported];
}

/** 밴드의 카운트 — 접기·버킷 규칙은 Step 5 와 같은 한 벌을 쓴다. */
export function bandBuckets(
  unitIds: readonly string[],
  latest: TestConnectionVersionResult | null,
): TcBuckets {
  const agents = (latest?.test_connection_agent_results ?? []).filter((agent) =>
    Boolean(agent?.resource_id),
  );
  return computeTcBuckets(unitIds, foldAgentStatuses(agents, new Set(unitIds)));
}

/**
 * ⚠️ 관리자 화면에서만 경고를 면제하는 엔진 (오너 2026-08-25: "synapse 면 경고를 띄우지마").
 *
 * 공용 `needsCredential`(lib/types.ts `NO_CREDENTIAL_ENGINES`)에 `synapse` 하나를 더한
 * 것이다. 공용 목록을 직접 넓히지 않는 이유는 그 목록이 **서비스 화면 Step 5 의 실행
 * 게이트**이기도 해서다 — 오너가 말한 것은 이 탭의 경고이지 사용자 화면의 잠금이 아니다.
 *
 * synapse 가 정말 IAM 으로 붙는 엔진이라면 이 예외는 도메인 사실이므로
 * `NO_CREDENTIAL_ENGINES` 로 옮겨 두 화면이 같은 목록을 보게 해야 한다 — **오너 확인 대기**.
 */
const ADMIN_NO_WARN_ENGINES: readonly string[] = ['synapse'];

/**
 * 이 단위에 Credential 이 없으면 **경고할 일인가**.
 *
 * 배정 자체는 어느 엔진에서도 할 수 있다(오너 2026-08-25) — 이 술어가 가르는 것은 오직
 * "없는 것이 문제인가" 하나다. IAM 으로 붙는 엔진(Athena·DynamoDB·BigQuery·CosmosDB,
 * 그리고 위의 synapse)은 없어도 정상이라 세지 않고, 따라서 실행도 막지 않는다.
 *
 * 표가 쓰던 "접힌 행이면 불필요" 규칙으로는 Athena 하나만 맞았다: DynamoDB 행은 접히지
 * 않으므로 배정 없는 채로 세어져 있지도 않은 할 일이 경고로 떴다.
 *
 * 엔진을 모를 때(빈 값)는 필요하다고 본다 — `database_type` 은 계약상 optional 이고,
 * 비었다고 "불필요"라 답하면 실제로 막힌 배정을 화면에서 지운다.
 */
export function unitNeedsCredential(unit: ConfirmedUnit): boolean {
  const dbType = (unit.members[0]?.database_type ?? '').toLowerCase();
  if (!dbType) return true;
  return needsCredential(dbType) && !ADMIN_NO_WARN_ENGINES.includes(dbType);
}

/**
 * 배정이 비어 있는 단위 — 밴드의 경고가 세는 것과 표의 필터가 거르는 것이 같은 술어여야
 * "미설정 3건"이라 말해 놓고 표에 2행이 뜨는 일이 없다.
 */
export function unitCredentialMissing(unit: ConfirmedUnit): boolean {
  return unitNeedsCredential(unit) && !unit.members.some((row) => row.credential_id);
}

/** Credential 이 필요한데 배정되지 않은 단위 수. 0 이 정상이고, 0 이면 아무 줄도 서지 않는다. */
export function credentialMissingCount(units: readonly ConfirmedUnit[]): number {
  return units.filter(unitCredentialMissing).length;
}

