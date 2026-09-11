'use client';

/**
 * 확정 정보 tab — 연동 요청 확인 → 확정 두 축을 한 화면에서 확인하는 워크벤치.
 *
 * 설치(Terraform) 축은 여기 없다. 2026-08-30 오너 지시 — "확정 정보 탭에서 테라폼 설치
 * 정보 조회하는 건 없앤다". 같은 릴리스에서 인프라 작업 탭이 연동 정보 카드 + Terraform
 * task 행으로 그 상태를 소유했고, 여기 셋째 축은 같은 사실을 더 나쁜 자리에서 한 번 더
 * 말하는 것이었다.
 *
 * 골격은 표면 하나다 — 테두리 있는 컨테이너 한 개, 그 안에 pane 하나. 예전에는 그 머리를
 * 두 칸 밴드(연동 요청 확인 | 확정 정보)가 차지하고 pane 이 번갈아 바뀌었다. 밴드는
 * 오너 채택안(B1)에서 걷혔다: 두 축을 **번갈아** 보여 주는 화면은 "승인에는 있는데 확정에
 * 없다"에 답하지 못한다 — 사람이 두 화면을 기억으로 맞대야 했다. 지금은 두 기록이 요약
 * 카드 둘로 동시에 서고, 리소스는 그 질문의 단위이므로 **한 표**로 합쳐 행마다 판정이 붙는다
 * (`ReconcilePane`).
 *
 * 화면이 말하는 것은 계약이 주는 것뿐이다:
 *   - 확정이 어느 승인에 근거하는지는 계약에 없다 → "근거 승인"을 추정해 적지 않는다.
 *     대조도 **계보가 아니라 두 목록의 비교**다: 최신 승인과 현재 확정을 맞댈 뿐이다.
 *   - 헤드라인의 상태는 **낱말**이다: 미등록 · 등록됨 · 다시 입력 필요. 색만으로 말하던
 *     점은 사라졌다(오너 2026-09-11) — 같은 사실이 확정 카드의 「상태」 kv 에도 서 있어서
 *     규칙은 `confirmedStateTag` 한 곳에 둔다.
 *
 * 판정 문장의 규칙은 verdict.ts 한 곳에 있다. 대조 건수는 그 문장의 입력이지만 태그를
 * 바꾸지는 않는다 — 차이는 결함이 아니다.
 *
 * 로드는 진입 3콜(요청·확정·terraform)이고 서로 독립이라 하나가 실패해도 나머지
 * 칸은 그대로 그린다. 이 탭이 Terraform 을 하나도 그리지 않는데 terraform-status 를
 * 계속 부르는 이유는 **소비자가 둘 남아서**다:
 *   - `latest_confirmed_at`(확정 시각) — 확정 카드의 「등록」 줄과 `ConfirmPane` 이 쓴다.
 *     확정 계약 `BffConfirmedIntegration` 은 `{ resource_infos }` 뿐이라 자기 시각이
 *     없고, 이 화면의 확정 시각은 그 응답에만 있다.
 *   - `overall_state` — 응답 객체째로 `ConfirmDeleteModal` 에 넘어가 그 모달의 **경고
 *     카드**를 정한다(`APPLIED` 면 인프라가 이미 올라가 있다는 카드 한 장이 선다).
 *     모달은 제 조회를 하지 않으므로, 이 값이 그 카드의 유일한 출처다.
 * 이 콜을 "날짜 하나짜리 헬퍼"로 줄이려면 삭제 모달의 경고 카드를 먼저 옮겨야 한다.
 *
 * 대신 이 콜의 실패는 오류 배너를 올리지 않는다 — 잃는 것이 날짜 한 칸이라 배너의
 * 크기가 아니다. 그래도 침묵하지는 않는다: 확정 정보 자리가 그 자리에서
 * `확정 시각 불러오지 못함` 이라고 말한다(빈 슬롯이 왜 비었는지는 말해야 한다). 두 pane
 * 다 `confirmedAtFailed` 로 그 말을 지므로, 문구는 화면에 한 번만 선다.
 *
 * **SDU 에는 요청 카드도 대조도 없다.** 승인 단계가 없어(계약 §0, 제출이 곧 1 → 4) 요청이
 * 만들어지지 않으므로 그 축은 비어 있는 것이 아니라 **존재하지 않는다** — 맞댈 목록이
 * 없으니 대조는 계산되지 않고, 확정 pane 이 곧 탭 본문이다.
 *
 * 쓰기 경로는 조회와 이름이 다르다: 확정 정보의 등록·삭제는 `confirmed-integration`
 * 이 아니라 CSP 별 `…/{aws|gcp|azure|idc}-resources` 의 POST·DELETE 다(swagger
 * `create/delete{Csp}ConfirmedResource`). SDU 에는 그 path 가 없어 액션이 내려가지 않는다.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import { normalizeCloudProvider } from '@/lib/types';
import {
  getConfirmedIntegration,
  getTerraformStatus,
  type ConfirmedIntegrationResponse,
  type TerraformStatusResponse,
} from '@/app/lib/api';
import {
  getApprovalRequestLatest,
  type ApprovalRequestDetail,
} from '@/app/lib/api/task-queue-requests';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { useModal } from '@/app/hooks/useModal';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { resolveWriteProvider } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/writeProvider';
import {
  deriveConfirmVerdict,
  type RequestFacet,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/verdict';
import {
  CONFIRMED_STATE_TONE,
  confirmTagStyles,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedStateTag';
import { ConfirmPane } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/panes';
import { ReconcilePane } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ReconcilePane';
import {
  buildReconcileTable,
  type ReconcileTable,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/reconcileRows';
import { ConfirmEditorModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmEditorModal';
import { ConfirmDeleteModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmDeleteModal';

/** `data: null` = 스냅샷이 아직 없다(404). 실패가 아니다. */
type Load<T> = { state: 'loading' } | { state: 'ready'; data: T | null } | { state: 'failed' };

/**
 * 요청 축의 상태. `absent` 는 조회의 결과가 아니라 **축의 부재**다 — 부르지 않았고, 부를
 * 것도 없다. 로딩으로 두면 `booting` 이 끝나지 않아 탭이 영영 스켈레톤이고, 실패로 두면
 * 없는 것을 못 불러왔다고 말한다. 가짜 ready 데이터로 덮는 것도 같은 거짓말이다.
 */
type RequestLoad = Load<ApprovalRequestDetail> | { state: 'absent' };

/** 설치가 끝난 뒤의 상태 — 판정 문장에서 다른 모든 입력을 이기는 유일한 기준. */
const INSTALLED: ReadonlySet<string> = new Set<ProcessStatus>(['INSTALLED', 'CONNECTED', 'COMPLETED']);

const APPROVED_STATUSES: ReadonlySet<string> = new Set(['APPROVED', 'AUTO_APPROVED']);

/**
 * 승인이 없을 때 두 쓰기 문이 각자 대는 사유. 같은 사실을 말하지만 문장은 문마다 다르다 —
 * 사유는 그 문이 무엇을 못 하게 됐는지를 말해야 한다.
 */
const APPROVAL_GATE = {
  reconfirm: '연동 요청이 승인되어야 재확정할 수 있습니다',
  edit: '연동 요청이 승인되어야 확정 정보를 입력할 수 있습니다',
} as const;

const styles = {
  verdict: 'flex items-start gap-2',
  /** 20px 헤드라인의 첫 줄 한가운데에 태그를 맞춘다 — 머리가 두 줄이 되어도 첫 줄 기준. */
  verdictTag: 'mt-[3px]',
  verdictHead: 'text-[20px] font-bold leading-[1.34] tracking-[-0.028em] text-[var(--pl-text-strong)]',
  /** 판정 아래 한 줄 — 카드가 아니라 바닥 위에 선다. 바닥(gray-200)에서 weak 는 4.01 로
      AA 아래라 한 칸 내려간 gray-600(6.20)이 진다. 태그는 폭이 낱말마다 달라 머리 글자에
      들여 맞출 수 없으므로, 이 줄은 태그와 같은 왼쪽 끝에서 시작한다. */
  verdictSub: 'mt-1 max-w-[76ch] text-[14px] text-[var(--pl-gray-600)]',
  /** 화면에서 테두리를 가진 유일한 표면. */
  shell:
    'mt-5 overflow-hidden rounded-[12px] border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-sm)]',
} as const;

/**
 * 요청 축의 결말 색 — 반려만 빨강, 대기는 콘솔 관례대로 warn, 요청 없음은 무채색.
 *
 * 채운 배지가 아니라 **글자**다: 이 결말은 카드 머리의 태그가 아니라 「결과」 kv 의 값으로
 * 한 번만 선다. 같은 낱말이 한 카드 안에 두 번 서면 어느 쪽이 사실인지 묻게 된다.
 */
const TONE_TEXT = {
  ok: 'text-[var(--pl-ok-text)]',
  err: 'text-[var(--pl-err-text)]',
  warn: 'text-[var(--pl-warn-text)]',
  off: 'text-[var(--pl-text-weak)]',
} as const;

/**
 * 요청 상태 → 이 탭의 어휘. **허용 목록이다** — "반려도 승인도 아니면 대기" 라는 부정형은
 * 계약 enum 8종 중 절반을 틀리게 말한다(`CANCELLED`·`UNAVAILABLE`·
 * `UNAVAILABLE_ACKNOWLEDGED`·`RESET` 이 전부 "승인 대기" 로 떨어진다). 라벨은 큐의
 * `ConfirmStatusPill` 이 같은 enum 에 대해 이미 선언한 것을 그대로 쓴다.
 *
 * `closed` = 승인 없이 끝난 요청. 그 경우 확정의 기준이 될 승인이 없다는 것이 판정에서
 * 유일하게 말할 수 있는 사실이다. `RESET` 은 계약에는 있지만 이 레포에 어휘가 없어서
 * 목록에 없다 — 모르는 값은 상태 문자열만 중립 톤으로 보여 주고(`RequestVerdictNotice`
 * 와 같은 규칙) 판정 문장에서는 요청에 대해 아무 말도 하지 않는다.
 */
const REQUEST_STATUS: Readonly<
  Record<string, { label: string; tone: keyof typeof TONE_TEXT; closed: boolean }>
> = {
  PENDING: { label: '승인 대기', tone: 'warn', closed: false },
  APPROVED: { label: '승인', tone: 'ok', closed: false },
  AUTO_APPROVED: { label: '승인', tone: 'ok', closed: false },
  REJECTED: { label: '반려', tone: 'err', closed: true },
  CANCELLED: { label: '요청 취소', tone: 'off', closed: true },
  UNAVAILABLE: { label: '연동 불가', tone: 'off', closed: true },
  UNAVAILABLE_ACKNOWLEDGED: { label: '연동 불가', tone: 'off', closed: true },
};

/**
 * 요청 상태 → 판정 문장의 입력. **순수 함수로 빼 둔 이유는 이 매핑이 한 번 틀렸기 때문이다** —
 * "반려도 승인도 아니면 대기" 라는 부정형이 계약 enum 8종 중 넷을 "승인 대기" 로 만들었다.
 *
 * 규칙은 셋뿐이다: 모르면 `unknown`(로드 전·실패), 계약이 대기라고 한 것만 `pending`,
 * 승인 없이 끝난 것은 `closed`. 어휘가 없는 값은 `closed` 이면서 label 이 없고, 그러면
 * 판정 문장이 요청에 대해 아무 말도 하지 않는다.
 *
 * 반려는 자기 headline 과 빨강 점을 가지므로 `closed` 와 따로 남긴다.
 */
export function requestFacetOf(input: {
  loaded: boolean;
  present: boolean;
  status: string | null;
  requestId: number | null;
  selectedCount: number;
}): RequestFacet {
  const { loaded, present, status, requestId, selectedCount } = input;
  if (!loaded) return { kind: 'unknown' };
  if (!present) return { kind: 'none' };
  if (status === 'REJECTED') return { kind: 'rejected' };
  if (status != null && APPROVED_STATUSES.has(status)) {
    return { kind: 'approved', requestId, count: selectedCount };
  }
  const spec = status != null ? REQUEST_STATUS[status] : undefined;
  if (spec == null) return { kind: 'closed', label: null };
  return spec.closed ? { kind: 'closed', label: spec.label } : { kind: 'pending', requestId };
}

export interface ConfirmTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** 판정 문장의 두 입력 중 하나 (다른 하나는 "확정 데이터가 있는가"). */
  processStatus: ProcessStatus | null;
  /**
   * 요청 축이 있는가. 화면이 이미 내린 판정을 받는다 — 탭이 `detail` 에서 다시 세우면
   * 안 된다: `normalizeCloudProvider('SDU')` 는 'AWS' 라, provider 비교로는 SDU 가
   * 잡히지 않는다.
   */
  isSdu: boolean;
  /**
   * 확정 삭제 모달의 경고 카드가 여는 **지름길** — 게이트의 출구가 아니다(09-04 이후
   * 삭제는 막히지 않는다). 철거는 여전히 인프라 작업 탭이 소유하므로, 그리로 한 번에
   * 가는 길만 준다.
   */
  onOpenInfra: () => void;
}

export function ConfirmTab({
  targetSourceId,
  detail,
  processStatus,
  isSdu,
  onOpenInfra,
}: ConfirmTabProps): ReactElement {
  const [fetched, setFetched] = useState<Load<ApprovalRequestDetail>>({ state: 'loading' });
  const [confirmed, setConfirmed] = useState<Load<ConfirmedIntegrationResponse>>({ state: 'loading' });
  const [terraform, setTerraform] = useState<Load<TerraformStatusResponse>>({ state: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);
  // 편집과 삭제는 pane 머리의 두 문이고, 모달도 둘이다 — 삭제는 편집기의 크롬(파라미터·
  // 요청 본문·응답 칸)을 쓸 일이 없고, 이 콘솔의 다른 파괴적 동작과 같은 문법으로 묻는다.
  const editorModal = useModal();
  const deleteModal = useModal();

  useEffect(() => {
    const controller = new AbortController();
    const alive = (): boolean => !controller.signal.aborted;

    // 없는 축은 부르지 않는다 — 그리지 않을 답을 받자고 요청을 보낼 이유가 없고, 404 를
    // 실패로 그릴 위험만 남는다.
    if (!isSdu) {
      void (async () => {
        setFetched({ state: 'loading' });
        try {
          const loaded = await getApprovalRequestLatest(targetSourceId, {
            signal: controller.signal,
          });
          if (alive()) setFetched({ state: 'ready', data: loaded });
        } catch (error) {
          if (!alive()) return;
          const absent = error instanceof AppError && error.code === 'NOT_FOUND';
          setFetched(absent ? { state: 'ready', data: null } : { state: 'failed' });
        }
      })();
    }

    void (async () => {
      setConfirmed({ state: 'loading' });
      try {
        const data = await getConfirmedIntegration(targetSourceId, { signal: controller.signal });
        if (!alive()) return;
        setConfirmed({ state: 'ready', data });
      } catch (error) {
        if (!alive()) return;
        setConfirmed(
          isMissingConfirmedIntegrationError(error) ? { state: 'ready', data: null } : { state: 'failed' },
        );
      }
    })();

    void (async () => {
      setTerraform({ state: 'loading' });
      try {
        const data = await getTerraformStatus(targetSourceId);
        if (alive()) setTerraform({ state: 'ready', data });
      } catch {
        if (alive()) setTerraform({ state: 'failed' });
      }
    })();

    return () => controller.abort();
  }, [targetSourceId, reloadKey, isSdu]);

  /**
   * 요청 축의 상태. 축이 없는 대상에서는 조회 상태를 **읽지 않는다** — 부르지 않았으므로
   * 그 값(`loading` 초기값)은 이 대상에 대해 아무 뜻도 없다. 파생값이라 효과 안에서 상태를
   * 되돌릴 일도 없고, 첫 렌더부터 밴드가 없다.
   */
  const request: RequestLoad = isSdu ? { state: 'absent' } : fetched;

  // 세 로드 중 하나라도 도는 동안은 스켈레톤이다 — 로딩 중의 확정 0건이 "미등록" 판정과
  // 빈 pane 으로 그려지는 거짓 프레임을 막는다. 진입·재시도·대상 전환 모두 loading 을
  // 지나므로 이 게이트 하나로 덮인다. terraform 이 이 셋에 남아 있는 것도 같은 이유다 —
  // 확정 시각이 프레임이 정착한 뒤에 뒤늦게 튀어나오지 않게 한다.
  const booting =
    request.state === 'loading' || confirmed.state === 'loading' || terraform.state === 'loading';
  if (booting) {
    // 스켈레톤은 정착 프레임의 컨테이너 클래스를 그대로 쓴다 — 판정 줄·밴드·pane 머리의
    // y 가 도착 시 움직이지 않게. 표 본문은 행 수가 데이터라 블록 하나로만 잡는다.
    return (
      <div className="relative" aria-busy>
        <span className="sr-only">불러오는 중</span>
        {/* 태그는 서지 않는다 — 상태를 모르는 동안 「미등록」을 보이면 그 프레임이 거짓이다. */}
        <p className={styles.verdict}>
          <span className={cn(opsStyles.skeletonWash, 'h-[27px] w-[340px]')} />
        </p>
        {/* 이 둘은 흰 `styles.shell` **앞**이라 바닥 위에 선다 — 카드 안의 `skeletonBar`
            (gray-100)가 아니라 바닥용 `skeletonWash` 가 진다. */}
        <div className={cn(opsStyles.skeletonWash, 'mt-1 h-[21px] w-[430px] max-w-[76ch]')} />
        <div className={styles.shell}>
          <div className="px-[22px] pb-6 pt-5">
            {/* 승인 축이 있는 대상은 카드 둘로 열린다. 축이 없는 대상(SDU)은 pane 머리
                한 줄이라, 도착하는 순간 아래가 통째로 뛰지 않게 각자의 프레임을 잡는다. */}
            {isSdu ? (
              <div className="flex items-center justify-between">
                <span className={cn(opsStyles.skeletonBar, 'h-[22px] w-[150px]')} />
                <span className={cn(opsStyles.skeleton, 'h-8 w-[110px]')} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <span className={cn(opsStyles.skeleton, 'block h-[148px]')} />
                <span className={cn(opsStyles.skeleton, 'block h-[148px]')} />
              </div>
            )}
            <div className={cn(opsStyles.skeleton, 'mt-6 h-[240px]')} />
          </div>
        </div>
      </div>
    );
  }

  const requestData = request.state === 'ready' ? request.data : null;
  const confirmedWire = confirmed.state === 'ready' ? confirmed.data : null;
  const confirmedRows = confirmedWire?.resource_infos ?? [];
  // SDU·미지원 provider 에는 확정 리소스 쓰기 path 가 없다 — 액션을 내리지 않으면
  // pane 이 읽기 전용으로 그려진다. 판정 규칙은 writeProvider.ts 한 곳에 있다.
  const writeProvider = resolveWriteProvider(detail);
  const terraformData = terraform.state === 'ready' ? terraform.data : null;
  // 이 탭이 직접 읽는 필드는 이것 하나다 — 확정 계약에 시각이 없어서 남은 콜이다.
  // 다만 응답 객체는 통째로 ConfirmDeleteModal 에도 넘어가고 거기서 overall_state 가
  // 삭제 모달의 경고 카드를 정한다(파일 머리 주석 참조). tasks 만 아무도 안 읽는다 —
  // 그건 인프라 작업 탭이 그린다.
  const confirmedAt = terraformData?.latest_confirmed_at || null;
  // 정규화해서 비교한다 — RequestTab·OpsTargetView 와 같은 규칙이다. 원문 비교가 casing
  // 하나에 뒤집히면 IDC 행이 클라우드용 표로 떨어진다(요청 pane 은 NLB 조회까지 잃는다).
  const isIdc = normalizeCloudProvider(detail.cloud_provider) === 'IDC';

  const requestVerdict = requestData?.verdict ?? null;
  const requestStatus = requestVerdict?.status ?? requestData?.request.status ?? null;
  const requestApproved = requestStatus != null && APPROVED_STATUSES.has(requestStatus);
  /** 선언된 상태면 그 어휘, 아니면 `undefined` — 모르는 값을 대기로 읽지 않기 위한 갈림길. */
  const requestSpec = requestStatus != null ? REQUEST_STATUS[requestStatus] : undefined;
  const selectedCount = requestData?.resources.filter((row) => row.selected).length ?? 0;

  // 축이 없으면 요청에 대한 사실도 없다 — `unknown`(아직 모름)도 `none`(요청이 없음)도
  // 이 대상에서는 참이 아니라, 판정 문장이 승인 얘기를 꺼내지 않게 만드는 제 값이 있다.
  const requestFacet: RequestFacet = request.state === 'absent'
    ? { kind: 'absent' }
    : requestFacetOf({
    loaded: request.state === 'ready',
    present: requestData != null,
    status: requestStatus,
    requestId: requestData?.request.requestId ?? null,
    selectedCount,
  });

  const installed = processStatus != null && INSTALLED.has(processStatus);
  const hasConfirmed = confirmedRows.length > 0;
  /**
   * 진행 상태가 아직 3단계(반영 중)인데 확정 정보가 이미 등록돼 있다. 등록됐다는 사실만
   * 말하면 화면은 끝난 것처럼 읽히지만, 그 확정으로는 다음 단계로 넘어가지 않는다 —
   * 다시 입력해야 한다(RECONFIRM).
   */
  const reconfirmNeeded = processStatus === 'CONFIRMING' && hasConfirmed;

  /**
   * 대조는 **승인된 요청이 있을 때만** 가능하다. 없으면(요청 없음·대기·반려·조회 실패)
   * 맞댈 목록 하나가 없는 것이고, 그때의 「일치」는 화면이 벌지 않은 주장이다.
   *
   * 확정이 404(=`data: null`)인 것은 실패가 아니라 **빈 목록**이므로 대조가 가능하다 —
   * 승인 행 전부가 「확정 없음」인, 이 표의 첫 칸이다.
   */
  const reconcile: ReconcileTable | null =
    requestApproved && requestData != null && confirmed.state === 'ready'
      ? buildReconcileTable({
          isIdc,
          approved: requestData.resources,
          confirmed: confirmedWire ?? { resource_infos: [] },
        })
      : null;

  const verdict = deriveConfirmVerdict({
    installed,
    confirmedCount: confirmedRows.length,
    request: requestFacet,
    reconfirmNeeded,
    diffCount: reconcile?.diffCount ?? null,
  });

  /**
   * 요청 카드의 「결과」 — **어휘로** 말한다. 계약 enum(`APPROVED`)을 그대로 찍으면 화면이
   * 제 언어를 버리는 것이고, 이 탭에서 원문 enum 은 이미 한 번 기각됐다.
   *
   * 승인일 때만 건수를 덧붙인다: 그때의 확정은 그 건수를 기준으로 만들어진다.
   */
  const requestOutcome: { toneClass: string; label: string; note?: string } | null =
    request.state !== 'ready' ? null
      : requestData == null ? { toneClass: TONE_TEXT.off, label: '요청 없음' }
        : requestSpec != null
          ? {
              toneClass: TONE_TEXT[requestSpec.tone],
              label: requestSpec.label,
              ...(requestApproved ? { note: `${selectedCount}건` } : {}),
            }
          // 계약에 있으나 어휘가 없는 값(`RESET`)은 상태 문자열을 그대로 중립 톤으로 —
          // 지어낸 라벨보다 원문이 정확하다.
          : { toneClass: TONE_TEXT.off, label: requestStatus ?? '요청 없음' };

  /**
   * Both write doors hang on the approval, and the rule is three-way, not two-way (owner
   * 2026-09-11). An approved request known to exist opens them; a request axis known to hold no
   * approval (absent · PENDING · REJECTED · CANCELLED …) closes them with their own reason; a
   * FAILED fetch closes nothing — we do not lock a door on the strength of a value we could not
   * read (same rule as startGate / pipelineTypeGate). One source, so the two doors cannot drift.
   */
  const approvalMissing = request.state === 'ready' && !requestApproved;
  const reconfirmBlocked: string | null = approvalMissing ? APPROVAL_GATE.reconfirm : null;
  const editBlocked: string | null = approvalMissing ? APPROVAL_GATE.edit : null;

  // terraform 은 빠진다 — 이 화면이 그리는 것 중 그 응답에 달린 것은 확정 시각 한 칸뿐이라
  // 조회 실패가 탭 전체의 오류 배너를 올릴 값이 아니다.
  const anyFailed = request.state === 'failed' || confirmed.state === 'failed';

  return (
    <div>
      <p className={styles.verdict}>
        <span
          className={cn(
            confirmTagStyles.tag,
            confirmTagStyles[CONFIRMED_STATE_TONE[verdict.tag]],
            styles.verdictTag,
          )}
        >
          {verdict.tag}
        </span>
        <span className={styles.verdictHead}>{verdict.head}</span>
      </p>
      <p className={styles.verdictSub}>{verdict.sub}</p>

      {anyFailed && (
        <div className={cn(pipelineStyles.empty.base, 'mt-4 py-3 text-left')}>
          <span>일부 정보를 불러오지 못했습니다.</span>
          <PlButton variant="secondary" size="sm" className="ml-3" onClick={retry}>
            다시 시도
          </PlButton>
        </div>
      )}

      <div className={styles.shell}>
        {/* 승인 축이 없는 대상(SDU)에는 맞댈 기록이 없다 — 대조도, 요청 카드도 세울 수
            없으므로 확정 pane 이 곧 탭 본문이다(계약 §0: 제출이 곧 1 → 4). */}
        {isSdu ? (
          <ConfirmPane
            wire={confirmedWire}
            confirmedAt={confirmedAt}
            isIdc={isIdc}
            hasApproval={false}
            // 확정은 읽혔는데 시각만 없는 상태를 pane 머리가 그 자리에서 말한다.
            confirmedAtFailed={terraform.state === 'failed'}
            onEdit={writeProvider ? editorModal.open : undefined}
            // 지울 것이 있을 때만 문이 선다 — 미등록 pane 에는 삭제할 확정이 없다.
            onDelete={writeProvider && hasConfirmed ? deleteModal.open : undefined}
          />
        ) : (
          <ReconcilePane
            request={requestData}
            requestFailed={request.state === 'failed'}
            requestOutcome={requestOutcome}
            confirmed={confirmedWire}
            confirmedAt={confirmedAt}
            confirmedAtFailed={terraform.state === 'failed'}
            isIdc={isIdc}
            reconcile={reconcile}
            reconfirmNeeded={reconfirmNeeded}
            // 재확정의 자리는 인프라 작업 탭이다 — 이 탭은 그리로 가는 길만 준다. 쓰기
            // 경로가 있으면 언제나 준다(오너 2026-09-11): 「다시 입력 필요」는 이 문을
            // 여는 조건이 아니라 pane 이 따로 말하는 상태다.
            onReconfirm={writeProvider ? onOpenInfra : undefined}
            reconfirmBlocked={reconfirmBlocked}
            editBlocked={editBlocked}
            onEdit={writeProvider ? editorModal.open : undefined}
            onDelete={writeProvider && hasConfirmed ? deleteModal.open : undefined}
          />
        )}
      </div>

      {/* 마운트가 곧 열림이다 — 열릴 때마다 초기화하는 효과 대신 새 인스턴스를 만든다. */}
      {writeProvider && editorModal.isOpen && (
        <ConfirmEditorModal
          onClose={editorModal.close}
          targetSourceId={targetSourceId}
          provider={writeProvider}
          onDone={retry}
        />
      )}

      {writeProvider && confirmedWire && hasConfirmed && deleteModal.isOpen && (
        <ConfirmDeleteModal
          targetSourceId={targetSourceId}
          provider={writeProvider}
          current={confirmedWire}
          terraform={terraformData}
          onOpenInfra={onOpenInfra}
          onClose={deleteModal.close}
          onDone={retry}
        />
      )}
    </div>
  );
}
