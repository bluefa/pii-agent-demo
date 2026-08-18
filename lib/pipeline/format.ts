/**
 * Pipeline Orchestrator presentation formatters + derivations (LIN-25 Phase B).
 *
 * Pure functions only — no React, no I/O. These translate the wire contract
 * (lib/pipeline/types.ts: snake_case, ISO-8601 UTC instants, ISO-8601 durations)
 * into the exact Korean display grammar of design/pipeline/admin-pipeline.html.
 *
 * Design fidelity notes (docs/api/pipeline-orchestrator-bff.md §3 gaps):
 *  - Times render in Asia/Seoul as 'YYYY-MM-DD HH:mm' (deterministic — never the
 *    machine TZ).
 *  - The TTL segment of the CONDITION_CHECK meta line is OMITTED (gap #1: the
 *    upstream has no TTL field; retry budget bounds it).
 *  - RECIPE_LABELS mirror pipeline-orchestrator RecipeDefinition.java verbatim.
 */
import type {
  CloudProvider,
  PipelineStatus,
  PipelineType,
  TaskDetail,
  TaskKind,
  TaskStatus,
  TaskSummary,
  TerraformAction,
} from '@/lib/pipeline/types';

// ---------------------------------------------------------------------------
// Time / duration
// ---------------------------------------------------------------------------

const SEOUL_DATETIME = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function seoulDateTime(iso: string | null | undefined, withSeconds: boolean): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const parts = SEOUL_DATETIME.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  const base = `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute')}`;
  return withSeconds ? `${base}:${pick('second')}` : base;
}

/**
 * ISO-8601 UTC instant → 'YYYY-MM-DD HH:mm' in Asia/Seoul. `null`/invalid → '-'.
 * Assembled from `formatToParts` so the output shape is stable across engines
 * (some emit 'YYYY-MM-DD, HH:mm'); midnight's '24' hour is normalized to '00'.
 */
export function fmtDateTime(iso: string | null | undefined): string {
  return seoulDateTime(iso, false);
}

/**
 * ISO-8601 UTC instant → 'YYYY-MM-DD' in Asia/Seoul. `null`/invalid → '-'.
 * For places that carry a date as a value rather than as a timestamp — the
 * 연동 완료 도장 is one: it reads at 20px, and a 16-character instant there is a
 * number to parse, not a date to recognize.
 */
export function fmtDate(iso: string | null | undefined): string {
  return seoulDateTime(iso, false).split(' ')[0];
}

/**
 * fmtDateTime + seconds ('YYYY-MM-DD HH:mm:ss') — for schedule times whose
 * precision matters at second scale (start-delay is ~15s, so a minute-only
 * 시작 예정 renders identical to "now"; operator feedback asked for seconds).
 */
export function fmtDateTimeSec(iso: string | null | undefined): string {
  return seoulDateTime(iso, true);
}

/**
 * ISO-8601 UTC instant → Korean relative time from `now` (default Date.now()):
 * '방금 전' (<1m), 'N분 전' (<1h), 'N시간 전' (<1d), else 'N일 전'.
 * `null`/invalid → '-'. `now` is injectable so the derivation stays testable.
 */
export function fmtRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '-';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '-';
  const diffMin = Math.floor((now - then) / 60_000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

const ISO_DURATION = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/**
 * ISO-8601 duration → Korean short form: PT10M→'10분', PT1H→'1시간',
 * PT1H30M→'1시간 30분'. `null`/unparseable/empty → '-'.
 */
export function fmtDuration(iso: string | null | undefined): string {
  if (!iso) return '-';
  const m = ISO_DURATION.exec(iso);
  if (!m) return '-';
  const hours = m[1] ? Number(m[1]) : 0;
  const minutes = m[2] ? Number(m[2]) : 0;
  const seconds = m[3] ? Number(m[3]) : 0;
  const segments: string[] = [];
  if (hours) segments.push(`${hours}시간`);
  if (minutes) segments.push(`${minutes}분`);
  if (seconds && !hours && !minutes) segments.push(`${seconds}초`);
  if (!segments.length) return iso === 'P' ? '-' : '0분';
  return segments.join(' ');
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
  idc: 'IDC',
  sdu: 'SDU',
};

/** Lowercased provider key (wire CloudProvider is UPPERCASE; design vars are lower). */
export function providerKey(provider: string | null | undefined): string {
  return (provider ?? '').toLowerCase();
}

/** Provider as shown to the user — an SDU target reads as "SDU" over its
 *  underlying CSP (owner call). Feed the result to providerLabel/providerKey. */
export function displayProvider(
  cloudProvider: CloudProvider | string | null | undefined,
  isSduType?: boolean,
): string {
  return isSduType ? 'SDU' : cloudProvider ?? '';
}

/** Wire provider → display label ('AZURE'→'Azure'). Lowercase-tolerant; unknown → passthrough. */
export function providerLabel(provider: CloudProvider | string | null | undefined): string {
  if (!provider) return '-';
  return PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
}

/** Provider → the `--pl-pv-*` CSS custom-property name (lowercased key). */
export function providerAccentVar(provider: CloudProvider | string): string {
  return `--pl-pv-${providerKey(provider)}`;
}

// ---------------------------------------------------------------------------
// Recipe catalog — mirrors pipeline-orchestrator RecipeDefinition.java verbatim
// ---------------------------------------------------------------------------

export interface RecipeLabel {
  displayName: string;
  desc: string;
}

export const RECIPE_LABELS: Record<string, RecipeLabel> = {
  AWS_INSTALL_V1: {
    displayName: 'AWS 인프라 설치',
    desc: 'AWS 서비스, BDC common, BDC service level 인프라를 단위별 Terraform plan·apply로 구성한다. 서비스 apply 후 네트워크 준비를 확인하고 BDC 단위로 넘어간다.',
  },
  AWS_DELETE_V1: {
    displayName: 'AWS 인프라 삭제',
    desc: 'AWS BDC service level, BDC common, 서비스 인프라를 설치의 역순으로 Terraform destroy로 제거한다.',
  },
  GCP_INSTALL_V1: {
    displayName: 'GCP 인프라 설치',
    desc: 'GCP 서비스와 BDC 인프라를 단위별 Terraform plan·apply로 구성한다. apply 순서는 서비스 → BDC(서버 강제).',
  },
  GCP_DELETE_V1: {
    displayName: 'GCP 인프라 삭제',
    desc: 'GCP BDC와 서비스 인프라를 Terraform destroy로 제거한다. destroy 순서는 BDC → 서비스(서버 강제).',
  },
  AZURE_INSTALL_V1: {
    displayName: 'Azure 인프라 설치',
    desc: 'Azure BDC 인프라를 Terraform plan·apply로 구성한다.',
  },
  AZURE_DELETE_V1: {
    displayName: 'Azure 인프라 삭제',
    desc: 'Azure BDC 인프라를 Terraform destroy로 제거한다.',
  },
  IDC_INSTALL_V1: {
    displayName: 'IDC 인프라 설치',
    desc: 'IDC CX와 BDP 인프라를 단위별 Terraform plan·apply로 구성한다. apply 순서는 CX → BDP(서버 강제).',
  },
  IDC_DELETE_V1: {
    displayName: 'IDC 인프라 삭제',
    desc: 'IDC BDP와 CX 인프라를 Terraform destroy로 제거한다(BDP destroy는 pod 삭제 동반, 순서는 설치의 역순 가정).',
  },
};

/** Recipe code → catalog entry; unknown/CUSTOM (null) → null. */
export function recipeLabel(code: string | null | undefined): RecipeLabel | null {
  if (!code) return null;
  return RECIPE_LABELS[code] ?? null;
}

/** Recipe code → display name, falling back to the raw code then '-'. */
export function recipeDisplayName(code: string | null | undefined): string {
  return recipeLabel(code)?.displayName ?? code ?? '-';
}

// ---------------------------------------------------------------------------
// Infra side — 서비스측 vs BDC측
// ---------------------------------------------------------------------------

/** Which side's infrastructure a task operates on. */
export type InfraSide = 'SERVICE' | 'BDC';

export const INFRA_SIDE_LABELS: Record<InfraSide, string> = {
  SERVICE: '서비스측',
  BDC: 'BDC측',
};

/**
 * Derive the infra side from a task-definition/operation name's tokens
 * (AWS_SERVICE_PLAN_V1, GCP_BDC_TF_APPLY, …). BDC/BDP must win over SERVICE:
 * AWS_BDC_SERVICE_LEVEL_* is BDC-side despite its SERVICE token. CX is the
 * IDC service-side zone — the recipes order it exactly like GCP's 서비스 →
 * BDC (apply CX → BDP, destroy BDP → CX). Unknown names (e.g. the
 * NETWORK_READY condition) return null: no tag over a wrong tag.
 */
export function taskInfraSide(definitionName: string | null | undefined): InfraSide | null {
  if (!definitionName) return null;
  const tokens = definitionName.toUpperCase().split(/[^A-Z0-9]+/);
  if (tokens.includes('BDC') || tokens.includes('BDP')) return 'BDC';
  if (tokens.includes('SERVICE') || tokens.includes('CX')) return 'SERVICE';
  return null;
}

// ---------------------------------------------------------------------------
// Kind success policy (verbatim design copy — TaskDefinitionView.success_policy)
// ---------------------------------------------------------------------------

export const KIND_POLICY: Record<TaskKind, string> = {
  TERRAFORM_JOB:
    '디스패치한 모든 job을 polling 간격으로 폴링 — 전부 COMPLETED면 성공, 하나라도 FAILED면 JOB_FAILED, 타임아웃 도달 시 EXECUTION_TIMEOUT. 실패·호출 오류는 fail_count로 누적되고 max까지 멱등 재디스패치로 재시도한다.',
  CONDITION_CHECK:
    '디스패치 없이 조건 확인 API를 polling 간격으로 호출 — 충족이 관측되면 성공. 미충족·호출 오류는 fail_count로 누적돼 max에 도달하면 실패한다(타임아웃 대신 재시도 예산으로 경계).',
};

// ---------------------------------------------------------------------------
// Task meta line — the "most useful single line" per task status
// ---------------------------------------------------------------------------

/**
 * The node/summary meta line. `detail` (TaskDetail) supplies the effective
 * settings and attempt/poll history that `TaskSummary` lacks; without it the
 * detail-dependent segments degrade gracefully:
 *  - FAILED / IN_PROGRESS: max-fail denominator falls back to '?'.
 *  - DONE: the poll/attempt count segment is dropped.
 *  - READY / BLOCKED: returns '' (the contract line is entirely detail-sourced).
 *
 * The design's CONDITION_CHECK "주기 X · TTL Y · 한도 N회" drops the TTL segment
 * (contract gap #1). Poll count = Σ attempt.check.call_count (calls, not attempts).
 */
export function taskMetaLine(task: TaskSummary, detail?: TaskDetail | null): string {
  const isCondition = task.kind === 'CONDITION_CHECK';
  const maxFail = detail ? String(detail.effective_max_fail_count) : '?';

  if (task.status === 'FAILED') {
    return `실패 ${task.fail_count}/${maxFail} — ${task.error_code ?? '원인 미기록'}`;
  }

  if (task.status === 'DONE') {
    const span = task.started_at
      ? `${fmtDateTime(task.started_at)}~${task.finished_at ? fmtDateTime(task.finished_at) : ''}`
      : '';
    let count = '';
    if (detail) {
      if (isCondition) {
        const polls = detail.attempts.reduce((sum, a) => sum + (a.check?.call_count ?? 0), 0);
        if (polls > 0) count = `폴 ${polls}회`;
      } else if (detail.attempts.length > 0) {
        count = `시도 ${detail.attempts.length}회`;
      }
    }
    return [span, count].filter(Boolean).join(' · ') || '완료';
  }

  if (task.status === 'IN_PROGRESS') {
    const start = task.started_at ? fmtDateTime(task.started_at) : '';
    const retry = task.fail_count > 0 ? ` · 재시도 ${task.fail_count}/${maxFail}` : '';
    return `${start} 시작${retry}`.trim();
  }

  if (task.status === 'CANCELLED') {
    return task.started_at
      ? `취소됨 · ${fmtDateTime(task.started_at)}~${task.finished_at ? fmtDateTime(task.finished_at) : ''}`
      : '취소됨';
  }

  // READY / BLOCKED — execution-contract summary (detail-only).
  if (!detail) return '';
  if (isCondition) {
    return `주기 ${fmtDuration(detail.effective_polling_interval)} · 한도 ${detail.effective_max_fail_count}회`;
  }
  return `타임아웃 ${fmtDuration(detail.effective_execution_timeout)} · 한도 ${detail.effective_max_fail_count}회`;
}

// ---------------------------------------------------------------------------
// Derivations (design-inventory §6)
// ---------------------------------------------------------------------------

/** Cancellable = non-terminal (RUNNING|PENDING) and no pending cancel request. */
export function canCancel(status: PipelineStatus, cancelRequested: boolean): boolean {
  return (status === 'RUNNING' || status === 'PENDING') && !cancelRequested;
}

/** Live = still moving on the server (R23 — the detail page polls only these).
 *  cancel_requested stays live: the cancellation itself lands via a later poll. */
export function isLivePipeline(status: PipelineStatus): boolean {
  return status === 'RUNNING' || status === 'PENDING';
}

const CURRENT_TASK_STATUSES: readonly TaskStatus[] = ['READY', 'IN_PROGRESS', 'FAILED'];

/** Lowest-sequence task in {READY, IN_PROGRESS, FAILED}, else null. */
export function currentTask(tasks: readonly TaskSummary[]): TaskSummary | null {
  const candidates = tasks
    .filter((t) => CURRENT_TASK_STATUSES.includes(t.status))
    .sort((a, b) => a.sequence - b.sequence);
  return candidates[0] ?? null;
}

/** Short "where are we" label: PENDING→시작 대기; current→진행 중; terminal→상태. */
export function currentTaskLabel(status: PipelineStatus, tasks: readonly TaskSummary[]): string {
  if (status === 'PENDING') return '시작 대기';
  const cur = currentTask(tasks);
  if (cur) return '진행 중';
  if (status === 'CANCELLED') return '취소됨';
  if (status === 'FAILED') return '실패';
  return '완료';
}

/** Progress counts from a task list (N = DONE, M = total; CANCELLED/BLOCKED in M). */
export function progressCount(tasks: readonly TaskSummary[]): { done: number; total: number } {
  return {
    done: tasks.filter((t) => t.status === 'DONE').length,
    total: tasks.length,
  };
}

// ---------------------------------------------------------------------------
// Detail exec band (design-benchmark 2026-08-09 — 시안 1·2·5)
// ---------------------------------------------------------------------------

/** 한글 상태 라벨 한 벌 — 파이프라인·태스크 공용. PENDING/READY/BLOCKED는 모두
 *  '대기'로 접힌다(구분은 노드 위치·설명 라인이 이미 나른다). enum 원문은 데이터
 *  표기(정의·계약 탭, 오류 코드)에만 남긴다. */
const STATUS_KO: Record<PipelineStatus | TaskStatus, string> = {
  PENDING: '대기',
  READY: '대기',
  BLOCKED: '대기',
  RUNNING: '실행 중',
  IN_PROGRESS: '실행 중',
  DONE: '완료',
  FAILED: '실패',
  CANCELLED: '중단',
};

export function statusKo(status: PipelineStatus | TaskStatus): string {
  return STATUS_KO[status];
}

/** 실행 종류 접미사 — 카탈로그 이름이 '… 테라폼 Apply'처럼 끝난다. */
const ACTION_SUFFIX: Record<TerraformAction, string> = {
  PLAN: ' plan',
  APPLY: ' apply',
  DESTROY: ' destroy',
};

/**
 * 카드 제목에서 후행 실행 종류(Plan/Apply/Destroy)를 뗀다 — 바로 위 JobKindTag가
 * 이미 같은 말을 하고 있어 이름에서는 중복이고, 그 자리를 실행 시각이 쓴다(오너).
 * 접미사가 없거나(조건 확인 태스크, 다르게 명명된 카탈로그) 떼면 빈 이름이 되는
 * 경우에는 원문을 그대로 돌려준다.
 */
export function stripTerraformAction(name: string, action: TerraformAction | null): string {
  if (!action) return name;
  const trimmed = name.trimEnd();
  const suffix = ACTION_SUFFIX[action];
  if (!trimmed.toLowerCase().endsWith(suffix)) return name;
  return trimmed.slice(0, trimmed.length - suffix.length).trimEnd() || name;
}

/**
 * 흐름 카드의 실행 요약 — 시작·완료 시각과 소요를 태스크 타임스탬프에서 유도한다
 * (design-benchmark 2026-08-14 시안 F). 판정은 담지 않는다: 카드 테두리와 코너
 * 배지가 이미 상태를 말하고 있어 '완료/실행 중'을 글자로 되풀이하지 않는다(오너).
 * 소요는 양끝이 다 있을 때만 확정된다 — 진행 중인 태스크의 경과는 실행 밴드가
 * 라이브로 담당하므로 카드에 두 번째 시계를 두지 않는다. 시각은 fmtDateTime이
 * 그대로 '-'를 돌려주므로 빈 갈래를 따로 두지 않는다.
 */
export function taskRunLine(task: TaskSummary): {
  startedAt: string;
  finishedAt: string;
  elapsed: string | null;
} {
  const elapsed =
    task.started_at && task.finished_at
      ? fmtElapsedMs(Date.parse(task.finished_at) - Date.parse(task.started_at))
      : '-';
  return {
    startedAt: fmtDateTime(task.started_at),
    finishedAt: fmtDateTime(task.finished_at),
    elapsed: elapsed === '-' ? null : elapsed,
  };
}

/** 한글 작업 유형 라벨 한 벌 (오너 2026-08-15). 상태와 같은 규칙: 사람이 읽는
 *  자리는 한글, enum 원문은 데이터 표기(TypePill)에만 남긴다. CUSTOM이 '커스텀'인
 *  것은 이 라벨이 attributive로도 쓰이기 때문 — '설치/삭제'와 나란히 서고
 *  ('설치·삭제·커스텀'), 앞에 provider가 붙고('AWS 커스텀'), 뒤에 명사가 붙는다
 *  ('커스텀 작업'). '직접 구성'·'사용자 정의'는 이 세 자리를 다 견디지 못한다. */
const TYPE_KO: Record<PipelineType, string> = {
  INSTALL: '설치',
  DELETE: '삭제',
  CUSTOM: '커스텀',
};

export function typeKo(type: PipelineType): string {
  return TYPE_KO[type];
}

/**
 * 진행 문구 — 완료 개수("1 / 4")가 아니라 현재 단계의 서수로 말한다. 2번째
 * 태스크가 도는 동안 "1 / 4"로 읽히던 라벨-값 불일치의 교정.
 */
export function progressPhrase(status: PipelineStatus, tasks: readonly TaskSummary[]): string {
  const { done, total } = progressCount(tasks);
  const cur = currentTask(tasks);
  const ordinal = cur ? tasks.filter((t) => t.sequence <= cur.sequence).length : null;
  if (status === 'RUNNING' && ordinal != null) return `${ordinal}/${total}단계 실행 중`;
  if (status === 'FAILED' && ordinal != null) return `${ordinal}/${total}단계에서 실패`;
  if (status === 'DONE') return `${total}단계 완료`;
  // CANCELLED gets no suffix — the adjacent status pill already says 중단.
  return `${done}/${total}단계 완료`;
}

/**
 * 실행 구간 — 파이프라인 계약에는 시작/종료 필드가 없어 태스크 타임스탬프에서
 * 유도한다. start = 가장 이른 started_at(없으면 아직 미시작 → 둘 다 null);
 * end = 라이브면 null(호출측이 now로 경과 계산), 종료 상태면 가장 늦은
 * finished_at, 그것도 없으면 last_activity_at(시작 전 취소 등).
 */
export function runWindow(
  status: PipelineStatus,
  tasks: readonly TaskSummary[],
  lastActivityAt: string,
): { start: string | null; end: string | null } {
  let start: string | null = null;
  let end: string | null = null;
  for (const t of tasks) {
    if (t.started_at && (start === null || Date.parse(t.started_at) < Date.parse(start))) {
      start = t.started_at;
    }
    if (t.finished_at && (end === null || Date.parse(t.finished_at) > Date.parse(end))) {
      end = t.finished_at;
    }
  }
  if (start === null) return { start: null, end: null };
  if (isLivePipeline(status)) return { start, end: null };
  // 종료 시각 = max(finished_at)과 last_activity_at 중 늦은 쪽. 실패로 끝난
  // 태스크는 finished_at이 비어 올 수 있어 max(finished_at)만으로는 마지막
  // 성공 태스크에서 멈춘다(과소 보고) — 종료 상태의 last_activity_at은
  // 터미널 전이 시각이라 그 하한을 보장한다.
  const endsBeforeLastActivity = end === null || Date.parse(end) < Date.parse(lastActivityAt);
  return { start, end: endsBeforeLastActivity ? lastActivityAt : end };
}

/**
 * 생성 이후 경과(ms) — 목록 계약에 실행 시간 필드가 없어 created_at 하나로 유도한다.
 *
 * 종단 행은 last_activity_at에서 멈춘다. orchestrator가 그 컬럼을 쓰는 곳은 생성
 * (PipelineInserter)과 종단 전이(StepReporter.terminalize · cancelIfIdle)뿐이라,
 * 종단 행에서만 "끝난 시각"이다. 실행 중에는 claim도 스텝 write-back도 그 값을
 * 건드리지 않아 created_at에 고정돼 있으므로, 라이브 행에 쓰면 항상 0이 된다 —
 * 그래서 라이브 행만 now로 잰다.
 *
 * 기준이 created_at이라 첫 dispatch 전 대기(start-delay)를 포함한다. "소요"가 아니라
 * "경과"인 이유이고, 실행 시작 시각인 태스크 started_at은 목록 응답에 없다.
 *
 * `now`의 기본값이 여기 있는 것은 `fmtRelativeTime`과 같은 이유다 — 시계 읽기를 이
 * 경계에 두면 파생은 순수하게 주입 테스트할 수 있고, 호출측(렌더)은 impure 호출을
 * 직접 들고 있지 않아도 된다. 같은 행의 생성시간 열이 이미 같은 모양이다.
 */
export function elapsedMs(
  status: PipelineStatus,
  createdAt: string,
  lastActivityAt: string,
  now: number = Date.now(),
): number {
  const end = isLivePipeline(status) ? now : Date.parse(lastActivityAt);
  return end - Date.parse(createdAt);
}

/** 경과/소요 표시: 60초 미만 'N초', 60분 미만 'N분', 이후 'H시간 M분'. 음수/NaN → '-'. */
export function fmtElapsedMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}
