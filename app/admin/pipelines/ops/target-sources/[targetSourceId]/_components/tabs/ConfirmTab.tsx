'use client';

/**
 * 확정 정보 tab — 연동 요청 확인 → 확정 → 설치 세 축을 한 화면에서 확인하는 워크벤치.
 *
 * 골격은 표면 하나다. 테두리 있는 컨테이너 한 개, 그 머리를 세 칸 밴드가 차지하고,
 * 아래 pane 이 고정된 슬롯 문법으로 내용을 채운다 — 카드 셋을 나란히 놓으면 등급을
 * 아무리 매겨도 형제 셋일 뿐이라 계층이 생기지 않는다(계층 = 포함).
 *
 * 화면이 말하는 것은 계약이 주는 것뿐이다:
 *   - 확정이 어느 승인에 근거하는지는 계약에 없다 → "근거 승인"을 추정해 적지 않는다.
 *   - 상태 점: 초록 = 그 단계가 끝남 · 회색 = 아직 · 빨강 = API 가 실패라고 말한 것.
 *
 * 판정 문장은 확정 축의 결말만 말한다(등록 여부·설치 여부) — 규칙은 verdict.ts 한
 * 곳에 있다. 승인 스냅샷과의 대조(비교 렌즈)는 라이브 리뷰에서 제거됐다: "뭘
 * 비교한다는 건지"가 전달되지 않았고, 확정 pane 은 현재 확정 정보만 보여 준다.
 *
 * 로드는 진입 3콜(요청·확정·terraform)이고 서로 독립이라 하나가 실패해도 나머지
 * 칸은 그대로 그린다.
 *
 * 쓰기 경로는 조회와 이름이 다르다: 확정 정보의 등록·삭제는 `confirmed-integration`
 * 이 아니라 CSP 별 `…/{aws|gcp|azure|idc}-resources` 의 POST·DELETE 다(swagger
 * `create/delete{Csp}ConfirmedResource`). SDU 에는 그 path 가 없어 액션이 내려가지 않는다.
 */
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import { fmtDateTime } from '@/lib/pipeline/format';
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
import { metaOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import {
  ConfirmPane,
  InstallPane,
  RequestPane,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/panes';
import { ConfirmEditorModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmEditorModal';

/** `data: null` = 스냅샷이 아직 없다(404). 실패가 아니다. */
type Load<T> = { state: 'loading' } | { state: 'ready'; data: T | null } | { state: 'failed' };

type CellKey = 'request' | 'confirm' | 'install';
/** 초록 = 단계 끝남 · 회색 = 아직 · 빨강 = API 가 실패라고 말한 것. 경고색은 없다. */
type Dot = 'done' | 'idle' | 'failed';

/** 설치가 끝난 뒤의 상태 — 판정 문장에서 다른 모든 입력을 이기는 유일한 기준. */
const INSTALLED: ReadonlySet<string> = new Set<ProcessStatus>(['INSTALLED', 'CONNECTED', 'COMPLETED']);

const APPROVED_STATUSES: ReadonlySet<string> = new Set(['APPROVED', 'AUTO_APPROVED']);

const styles = {
  verdict: 'flex items-start gap-2.5',
  verdictDot: 'mt-[9px] h-2 w-2 flex-none rounded-full',
  verdictHead: 'text-[20px] font-bold leading-[1.34] tracking-[-0.028em] text-[var(--pl-text-strong)]',
  verdictSub: 'ml-[18px] mt-1 max-w-[76ch] text-[14px] text-[var(--pl-text-weak)]',
  /** 화면에서 테두리를 가진 유일한 표면. */
  shell:
    'mt-5 overflow-hidden rounded-[12px] border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-sm)]',
  /** 밴드가 컨테이너의 머리다 — 탭 스트립과 내용은 붙어 있어야 소속을 말한다. */
  band: 'grid grid-cols-3 bg-[var(--pl-gray-50)]',
  cell:
    'relative min-w-0 cursor-pointer border-b border-l border-[var(--pl-border)] px-[18px] pb-[15px] pt-3.5 text-left first:border-l-0',
  cellOn:
    'bg-[var(--pl-bg-card)] border-b-transparent after:absolute after:inset-x-0 after:top-0 after:h-0.5 after:bg-[var(--pl-primary)] after:content-[""]',
  cellTitle: 'flex items-center gap-2 text-[14px] font-semibold leading-[1.4]',
  cellSub: 'ml-[15px] mt-1 truncate text-[12px] text-[var(--pl-text-weak)]',
  dot: 'h-[7px] w-[7px] flex-none rounded-full',
  /** 밴드 부제의 상태 태그 — RequestTab 의 상태 pill 과 같은 tone 토큰(fill+text 쌍)을 쓴다. */
  tag: 'inline-flex flex-none items-center rounded-[6px] px-1.5 py-0.5 text-[12px] font-semibold leading-[1.34]',
} as const;

const DOT_FILL: Record<Dot, string> = {
  done: 'bg-[var(--pl-ok)]',
  idle: 'bg-[var(--pl-gray-300)]',
  failed: 'bg-[var(--pl-err)]',
};

/** 요청 축의 결말 태그 — 반려만 빨강, 대기는 콘솔 관례대로 warn, 요청 없음은 무채색. */
const TAG_TONE = {
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
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
  Record<string, { label: string; tone: keyof typeof TAG_TONE; closed: boolean }>
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

/**
 * 'YYYY-MM-DD HH:mm' 에서 'MM-DD' 만 — 밴드 부제는 한 줄이라 날짜만 붙인다.
 * 자체 파싱을 하지 않고 fmtDateTime(Asia/Seoul, 형태 고정) 위에 얹는다.
 */
const shortDate = (iso: string | null | undefined): string | null => {
  const formatted = fmtDateTime(iso);
  return formatted === '-' ? null : formatted.slice(5, 10);
};

const joinDots = (...parts: ReadonlyArray<string | null | undefined>): string =>
  parts.filter((part): part is string => !!part).join(' · ');

export interface ConfirmTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** 판정 문장의 두 입력 중 하나 (다른 하나는 "확정 데이터가 있는가"). */
  processStatus: ProcessStatus | null;
  /** 설치 pane 의 유일한 액션 — 실행은 인프라 작업 탭이 소유한다. */
  onOpenInfra: () => void;
}

export function ConfirmTab({
  targetSourceId,
  detail,
  processStatus,
  onOpenInfra,
}: ConfirmTabProps): ReactElement {
  const [request, setRequest] = useState<Load<ApprovalRequestDetail>>({ state: 'loading' });
  const [confirmed, setConfirmed] = useState<Load<ConfirmedIntegrationResponse>>({ state: 'loading' });
  const [terraform, setTerraform] = useState<Load<TerraformStatusResponse>>({ state: 'loading' });
  // 기본 선택은 주제(확정 정보), 칸의 순서는 생성 흐름. 비활성 칸은 두지 않는다.
  const [cell, setCell] = useState<CellKey>('confirm');
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);
  // 입력·수정·삭제가 한 모달이다 — 삭제는 그 안의 영역 교체이므로 두 번째 모달을 두지 않는다.
  const editorModal = useModal();

  useEffect(() => {
    const controller = new AbortController();
    const alive = (): boolean => !controller.signal.aborted;

    void (async () => {
      setRequest({ state: 'loading' });
      try {
        const loaded = await getApprovalRequestLatest(targetSourceId, { signal: controller.signal });
        if (alive()) setRequest({ state: 'ready', data: loaded });
      } catch (error) {
        if (!alive()) return;
        const absent = error instanceof AppError && error.code === 'NOT_FOUND';
        setRequest(absent ? { state: 'ready', data: null } : { state: 'failed' });
      }
    })();

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
  }, [targetSourceId, reloadKey]);

  // 세 로드 중 하나라도 도는 동안은 스켈레톤이다 — 로딩 중의 확정 0건이 "미등록" 판정과
  // 빈 pane 으로 그려지는 거짓 프레임을 막는다. 진입·재시도·대상 전환 모두 loading 을
  // 지나므로 이 게이트 하나로 덮인다.
  const booting =
    request.state === 'loading' || confirmed.state === 'loading' || terraform.state === 'loading';
  if (booting) {
    // 스켈레톤은 정착 프레임의 컨테이너 클래스를 그대로 쓴다 — 판정 줄·밴드·pane 머리의
    // y 가 도착 시 움직이지 않게. 표 본문은 행 수가 데이터라 블록 하나로만 잡는다.
    return (
      <div className="relative" aria-busy>
        <span className="sr-only">불러오는 중</span>
        <p className={styles.verdict}>
          <span className={cn(styles.verdictDot, DOT_FILL.idle)} />
          <span className={cn(opsStyles.skeletonBar, 'h-[27px] w-[340px]')} />
        </p>
        <div className={cn(opsStyles.skeletonBar, 'ml-[18px] mt-1 h-[21px] w-[430px] max-w-[76ch]')} />
        <div className={styles.shell}>
          <div className={cn(styles.band, 'pointer-events-none')}>
            {(['request', 'confirm', 'install'] as const).map((key, index) => (
              <div key={key} className={styles.cell}>
                <span className={styles.cellTitle}>
                  <span className={cn(styles.dot, DOT_FILL.idle)} />
                  <span className={cn(opsStyles.skeletonBar, 'h-5 w-[120px]')} />
                </span>
                <span className={cn(styles.cellSub, 'block')}>
                  {/* 첫 칸 부제는 상태 태그(20px 줄)라 옆 칸(18px 줄)보다 한 뼘 높다. */}
                  <span
                    className={cn(
                      opsStyles.skeletonBar,
                      'block',
                      index === 0 ? 'h-5 w-[180px]' : 'h-[18px] w-[130px]',
                    )}
                  />
                </span>
              </div>
            ))}
          </div>
          <div className="px-[22px] pb-6 pt-5">
            <div className="flex items-center justify-between">
              <span className={cn(opsStyles.skeletonBar, 'h-[22px] w-[150px]')} />
              <span className={cn(opsStyles.skeleton, 'h-8 w-[110px]')} />
            </div>
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

  const requestFacet: RequestFacet = requestFacetOf({
    loaded: request.state === 'ready',
    present: requestData != null,
    status: requestStatus,
    requestId: requestData?.request.requestId ?? null,
    selectedCount,
  });

  const installed = processStatus != null && INSTALLED.has(processStatus);
  const hasConfirmed = confirmedRows.length > 0;
  const verdict = deriveConfirmVerdict({
    installed,
    confirmedCount: confirmedRows.length,
    request: requestFacet,
  });

  // ── 밴드 세 칸 — 각 칸은 그 축의 결말만 말한다.
  const requestDot: Dot =
    requestStatus == null ? 'idle'
      : requestStatus === 'REJECTED' ? 'failed'
        : APPROVED_STATUSES.has(requestStatus) ? 'done'
          : 'idle';

  const overall = metaOf(terraformData?.overall_state);
  const tasks = terraformData?.tasks ?? [];
  const installDot: Dot =
    terraformData == null ? 'idle'
      : overall.tone === 'err' ? 'failed'
        : terraformData.overall_state === 'APPLIED' ? 'done'
          : 'idle';

  // 요청 칸의 부제 — 현재 상태는 태그로, 신원(#id·건수·처리자·날짜)은 그 옆의 텍스트로.
  const requestTag: { tone: keyof typeof TAG_TONE; label: string } | null =
    request.state !== 'ready' ? null
      : requestData == null ? { tone: 'off', label: '요청 없음' }
        : requestSpec != null ? { tone: requestSpec.tone, label: requestSpec.label }
          // 계약에 있으나 어휘가 없는 값(`RESET`)은 상태 문자열을 그대로 중립 톤으로 —
          // 지어낸 라벨보다 원문이 정확하다.
          : { tone: 'off', label: requestStatus ?? '요청 없음' };
  const requestMeta =
    requestData == null
      ? null
      : joinDots(
          requestData.request.requestId != null ? `#${requestData.request.requestId}` : null,
          requestApproved ? `${selectedCount}건` : null,
          requestVerdict?.processedBy,
          shortDate(requestVerdict?.processedAt ?? requestData.request.requestedAt),
        );

  const cells: ReadonlyArray<{ key: CellKey; title: string; sub: ReactNode; dot: Dot }> = [
    {
      key: 'request',
      title: '연동 요청 확인 (1,2단계)',
      dot: requestDot,
      sub:
        request.state === 'failed'
          ? '불러오지 못함'
          : requestTag && (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={cn(styles.tag, TAG_TONE[requestTag.tone])}>{requestTag.label}</span>
                {requestMeta && <span className="truncate">{requestMeta}</span>}
              </span>
            ),
    },
    {
      key: 'confirm',
      title: '확정 정보',
      dot: hasConfirmed ? 'done' : 'idle',
      sub:
        confirmed.state === 'failed' ? '불러오지 못함'
          : hasConfirmed
            ? joinDots(`리소스 ${confirmedRows.length}건`, shortDate(confirmedAt))
            : '미등록',
    },
    {
      key: 'install',
      title: '설치 (Terraform)',
      dot: installDot,
      sub:
        terraform.state === 'failed'
          ? '불러오지 못함'
          : joinDots(
              overall.label,
              tasks.length > 0
                ? `task ${tasks.filter((task) => task.state === 'APPLIED').length}/${tasks.length}`
                : null,
            ),
    },
  ];

  const anyFailed =
    request.state === 'failed' || confirmed.state === 'failed' || terraform.state === 'failed';

  return (
    <div>
      <p className={styles.verdict}>
        <span className={cn(styles.verdictDot, DOT_FILL[verdict.dot])} />
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
        <div className={styles.band} role="tablist" aria-label="확정 정보 축">
          {cells.map((item) => {
            const active = item.key === cell;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCell(item.key)}
                className={cn(styles.cell, active && styles.cellOn)}
              >
                <span
                  className={cn(
                    styles.cellTitle,
                    active ? 'text-[var(--pl-text-strong)]' : 'text-[var(--pl-text-medium)]',
                  )}
                >
                  <span className={cn(styles.dot, DOT_FILL[item.dot])} />
                  {item.title}
                </span>
                <span className={cn(styles.cellSub, 'block')}>{item.sub}</span>
              </button>
            );
          })}
        </div>

        {cell === 'request' && (
          <RequestPane
            detail={requestData}
            wire={requestData?.wire ?? null}
            isIdc={isIdc}
            targetSourceId={targetSourceId}
          />
        )}
        {cell === 'confirm' && (
          <ConfirmPane
            wire={confirmedWire}
            confirmedAt={confirmedAt}
            isIdc={isIdc}
            onEdit={writeProvider ? editorModal.open : undefined}
          />
        )}
        {cell === 'install' && <InstallPane status={terraformData} onOpenInfra={onOpenInfra} />}
      </div>

      {/* 마운트가 곧 열림이다 — 열릴 때마다 초기화하는 효과 대신 새 인스턴스를 만든다. */}
      {writeProvider && editorModal.isOpen && (
        <ConfirmEditorModal
          onClose={editorModal.close}
          targetSourceId={targetSourceId}
          provider={writeProvider}
          current={confirmedRows.length > 0 ? confirmedWire : null}
          terraform={terraformData}
          onOpenInfra={onOpenInfra}
          onDone={retry}
        />
      )}
    </div>
  );
}
