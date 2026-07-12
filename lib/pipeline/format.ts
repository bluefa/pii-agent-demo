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
  TaskDetail,
  TaskKind,
  TaskStatus,
  TaskSummary,
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
  hour12: false,
});

/**
 * ISO-8601 UTC instant → 'YYYY-MM-DD HH:mm' in Asia/Seoul. `null`/invalid → '-'.
 * Assembled from `formatToParts` so the output shape is stable across engines
 * (some emit 'YYYY-MM-DD, HH:mm'); midnight's '24' hour is normalized to '00'.
 */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const parts = SEOUL_DATETIME.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute')}`;
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
