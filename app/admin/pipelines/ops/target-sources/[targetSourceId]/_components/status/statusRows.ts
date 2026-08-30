/**
 * 연동 현황 다섯 행 — wire 응답을 화면이 그릴 사실로 접는다. React 도 I/O 도 없어서
 * 판정만 따로 단위 테스트한다 (`statusRows.test.ts`).
 *
 * 행 순서는 오너 지시다 (2026-08-30): 스캔 · 연결 테스트 · 인프라 작업 · 확정 정보 ·
 * Airflow. 파이프라인 의존 순서(스캔 → 확정 → 인프라 → 연결 테스트)와 다르고,
 * 그 순서로 바꾸자는 제안은 이미 한 번 거절됐다 — ⛔ 재제안 금지.
 *
 * 세 규칙이 이 파일 전체를 지배한다.
 *
 * 1. **조회 실패는 실패가 아니다.** 요청이 거절된 행은 `unknown` + `failed` 이고,
 *    「실행 없음」이나 ✕ 로 접히지 않는다. 못 읽은 것을 읽은 척하면 멀쩡한 대상이
 *    고장 난 것으로 읽힌다 — `tcRunGate` 가 NOT_FOUND(미실행)와 그 밖의 거절을
 *    가르는 것과 같은 이유다.
 * 2. **미도달은 실패가 아니다.** 1단계 대상은 다섯 행이 전부 「아직」이다. 그 자리에
 *    빨간 ✕ 다섯 개가 서면 안 된다 — `idle` 이 그 자리의 마크다.
 * 3. **Airflow 는 §10 을 부르지 않는다.** 한 대상의 dag-status 응답이 MB 단위까지
 *    가므로(논리 DB 1만 행) 이 카드는 그것을 조회하지 않고 `processStatus` 만 읽어
 *    「어디까지 왔는가」를 적는다. 판정 전부는 Airflow 확인 탭의 것이다.
 */
import type { z } from 'zod';

import type { schemas } from '@/lib/generated/install-v1';
import { OPS_TAB_SLUGS, type OpsTargetTabLabel } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { runStatus } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import { metaOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import { SCAN_STATE } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanState';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;
type TcLatest = z.infer<typeof schemas.TestConnectionVersionResult>;
type TerraformStatus = z.infer<typeof schemas.TerraformStatusResponse>;

/**
 * 한 조회의 결말. `ok:false` 는 **거절**이고, `ok:true` + `value:null` 은 **없음**이다
 * (404). 이 둘을 하나로 접으면 규칙 1이 무너진다.
 */
export type Settled<T> = { ok: true; value: T } | { ok: false };

/** 행 왼쪽 마크 — 색과 글리프는 카드가 고른다. */
export type RowMark = 'ok' | 'err' | 'warn' | 'run' | 'idle' | 'unknown';

export interface StatusRow {
  /** 행 이름이자 목적지 탭 — 링크의 접근명이 이걸 쓴다. */
  name: string;
  tab: OpsTargetTabLabel;
  mark: RowMark;
  /** 한 낱말짜리 판정. */
  value: string;
  /** 값을 한정하는 회색 한 줄 — 시각·수. 없으면 null. */
  sub: string | null;
  /** 조회가 거절됐다 — 「다시 시도」가 붙는 행. */
  failed: boolean;
}

export interface StatusInputs {
  scan: Settled<ScanJob | null>;
  tc: Settled<TcLatest | null>;
  terraform: Settled<TerraformStatus>;
  processStatus: ProcessStatus | null;
  /** IDC 는 스캔 탭이 없다 (`OpsTargetView` 의 `isIdc`) — 행도 서지 않는다. */
  isIdc: boolean;
}

/** 규칙 1의 모양 — 거절된 조회는 어느 행에서나 같은 문장을 쓴다. */
const rejected = (name: string, tab: OpsTargetTabLabel): StatusRow => ({
  name,
  tab,
  mark: 'unknown',
  value: '조회 실패',
  sub: null,
  failed: true,
});

/**
 * SUCCESS 인데 건수 맵이 아직 없으면 마무리 중이다 — `useScanPolling.isScanFinalizing`
 * 과 같은 판정. 계약 상태가 아니라 UI 의 이름이라 wire 값 대신 여기서 만든다.
 */
const scanStateKey = (job: ScanJob): string =>
  job.scan_status === 'SUCCESS' && job.resource_count_by_resource_type == null
    ? 'FINALIZING'
    : (job.scan_status ?? '');

const SCAN_MARK: Record<string, RowMark> = { ok: 'ok', info: 'run', err: 'err', off: 'idle' };

const scanRow = (scan: Settled<ScanJob | null>): StatusRow => {
  if (!scan.ok) return rejected(OPS_TAB_SLUGS.scan, OPS_TAB_SLUGS.scan);
  const job = scan.value;
  if (!job) {
    return { name: OPS_TAB_SLUGS.scan, tab: OPS_TAB_SLUGS.scan, mark: 'idle', value: '실행 없음', sub: null, failed: false };
  }
  const key = scanStateKey(job);
  const state = SCAN_STATE[key];
  // 리소스 합계는 성공한 스캔에만 있다 — 없으면 그 조각이 빠질 뿐 시각은 남는다.
  const counts = job.resource_count_by_resource_type;
  const total = counts ? Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0) : null;
  const at = fmtDateTime(job.updated_at ?? job.created_at);
  return {
    name: OPS_TAB_SLUGS.scan,
    tab: OPS_TAB_SLUGS.scan,
    // enum 밖의 값은 성공으로도 실패로도 세지 않는다.
    mark: state ? SCAN_MARK[state.tone] : 'unknown',
    value: state?.label ?? '알 수 없음',
    sub: [at, total === null ? null : `리소스 ${total}개`].filter(Boolean).join(' · ') || null,
    failed: false,
  };
};

const tcRow = (tc: Settled<TcLatest | null>): StatusRow => {
  if (!tc.ok) return rejected(OPS_TAB_SLUGS.tc, OPS_TAB_SLUGS.tc);
  const latest = tc.value;
  if (!latest) {
    return { name: OPS_TAB_SLUGS.tc, tab: OPS_TAB_SLUGS.tc, mark: 'idle', value: '실행 없음', sub: null, failed: false };
  }
  // 실행 한 건의 상태 — 어휘는 실행 기록 표와 한 벌이다 (`runStatus`).
  const status = runStatus(latest);
  const spec: Record<ReturnType<typeof runStatus>, { mark: RowMark; value: string }> = {
    SUCCESS: { mark: 'ok', value: '성공' },
    FAIL: { mark: 'err', value: '실패' },
    RUNNING: { mark: 'run', value: '진행 중' },
    PENDING: { mark: 'run', value: '대기 중' },
    UNKNOWN: { mark: 'unknown', value: '알 수 없음' },
  };
  const at = fmtDateTime(latest.completed_at ?? latest.requested_at);
  const version = latest.test_connection_version;
  return {
    name: OPS_TAB_SLUGS.tc,
    tab: OPS_TAB_SLUGS.tc,
    ...spec[status],
    sub: [at, version == null ? null : `${version}회차`].filter(Boolean).join(' · ') || null,
    failed: false,
  };
};

const infraRow = (terraform: Settled<TerraformStatus>): StatusRow => {
  if (!terraform.ok) return rejected(OPS_TAB_SLUGS.infra, OPS_TAB_SLUGS.infra);
  const tasks = terraform.value.tasks ?? [];
  const sub = terraform.value.checked_at ? `조회 ${fmtDateTime(terraform.value.checked_at)}` : null;
  const base = { name: OPS_TAB_SLUGS.infra, tab: OPS_TAB_SLUGS.infra, sub, failed: false };
  if (tasks.length === 0) return { ...base, mark: 'idle', value: '작업 없음' };
  // 조합 상태(`overall_state`)는 쓰지 않는다 — 어느 작업이 걸렸는지 못 말하기 때문에
  // 인프라 작업 탭이 이미 그것을 버렸다 (InfraStatusHead). 여기서는 세기만 한다.
  const tones = tasks.map((task) => metaOf(task.state).tone);
  const failed = tones.filter((tone) => tone === 'err').length;
  const running = tones.filter((tone) => tone === 'info').length;
  const applied = tones.filter((tone) => tone === 'ok').length;
  if (failed > 0) return { ...base, mark: 'err', value: `${failed}개 실패` };
  if (running > 0) return { ...base, mark: 'run', value: `${running}개 작업 중` };
  if (applied > 0) return { ...base, mark: 'ok', value: `${applied}개 적용 완료` };
  return { ...base, mark: 'idle', value: '미적용' };
};

const confirmRow = (
  terraform: Settled<TerraformStatus>,
  processStatus: ProcessStatus | null,
): StatusRow => {
  if (!terraform.ok) return rejected(OPS_TAB_SLUGS.confirm, OPS_TAB_SLUGS.confirm);
  const base = { name: OPS_TAB_SLUGS.confirm, tab: OPS_TAB_SLUGS.confirm, failed: false };
  const confirmed = terraform.value.has_confirmed_infra;
  if (confirmed === true) {
    return { ...base, mark: 'ok', value: '확정됨', sub: fmtDateTime(terraform.value.latest_confirmed_at) || null };
  }
  // 계약은 LOOSE 라 필드가 통째로 빠질 수 있다. **아는 false 만** 미확정이다 —
  // 없는 값을 false 로 접으면 모르는 것을 사실로 바꿔 말하게 된다.
  if (confirmed !== false) return { ...base, mark: 'unknown', value: '알 수 없음', sub: null };
  const step = processStatus ? STEP[processStatus] : null;
  // 미확정은 정상 흐름의 한 단계다 — 어디까지 왔는지를 대신 적는다 (InfraStatusHead 판례).
  return { ...base, mark: 'warn', value: '미확정', sub: step ? `${step.n}단계 · ${step.label}` : null };
};

/** 모니터링이 존재하기 시작하는 지점 — 6단계에 닿아야 DAG 가 돈다. */
const AIRFLOW_REACHED: ReadonlySet<ProcessStatus> = new Set<ProcessStatus>(['CONNECTED', 'COMPLETED']);

const airflowRow = (processStatus: ProcessStatus | null): StatusRow => {
  const base = { name: 'Airflow', tab: OPS_TAB_SLUGS.airflow, failed: false };
  // ponytail: 판정(healthVerdict)을 여기 싣지 않는 것은 §10 응답이 MB 단위여서다.
  // 그 응답이 요약되거나 페이지화되면 이 행이 판정을 지면 된다 — 그때까지는 위치만.
  if (processStatus && AIRFLOW_REACHED.has(processStatus)) {
    return { ...base, mark: 'idle', value: '확인 가능', sub: null };
  }
  return { ...base, mark: 'idle', value: '아직 도달하지 않음', sub: '6단계 완료 확인 후' };
};

export function statusRows(input: StatusInputs): StatusRow[] {
  const rows = [
    scanRow(input.scan),
    tcRow(input.tc),
    infraRow(input.terraform),
    confirmRow(input.terraform, input.processStatus),
    airflowRow(input.processStatus),
  ];
  // IDC 는 손으로 등록하는 대상이라 훑을 계정이 없다 — 탭 줄이 「스캔」을 빼는 것과
  // 같은 술어로 행도 뺀다. 남기면 영영 「실행 없음」인 행이 하나 선다.
  return input.isIdc ? rows.filter((row) => row.tab !== OPS_TAB_SLUGS.scan) : rows;
}
