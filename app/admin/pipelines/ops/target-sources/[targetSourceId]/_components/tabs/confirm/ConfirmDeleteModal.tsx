'use client';

/**
 * 확정 정보 삭제 확인 — 편집기와 **별개의 문**이다.
 *
 * 삭제는 오래 편집기 안의 모드였다(같은 평면의 영역 교체). 그 배치는 지우려는 사람에게
 * 편집기를 먼저 열게 했고, 지우는 화면이 편집 화면의 크롬(Parameters · Request body ·
 * 응답 칸)을 그대로 물려받았다 — 삭제에는 보낼 본문도, 정할 파라미터도 없다.
 *
 * 그래서 문법을 이 콘솔이 이미 쓰는 파괴적 동작의 것으로 맞춘다: 연동 초기화(`DangerTab`)
 * 와 같은 `ConfirmStepModal` 이다. 묻고, 결과 프레임으로 답하고, 닫기는 사용자가 누른다
 * (`explicitDismiss`) — 뒤 화면이 이 동작의 기록이라 결과가 저 혼자 사라지면 안 된다.
 *
 * 화면은 게이트 하나로 넷으로 갈린다(`deleteVariant.ts`): 조회 중 · 막힘 · 허용 · 모름.
 * **막는 상태는 `APPLIED` 하나뿐**이고, 막혔을 때의 유일한 출구는 인프라 작업 탭이다 —
 * 철거는 이 화면이 소유하지 않는다.
 *
 * 마운트가 곧 열림이다(편집기와 같은 규칙): 부모는 열려 있는 동안만 이것을 렌더한다.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { useApiAction } from '@/app/hooks/useApiMutation';
import {
  ConfirmStepModal,
  type ConfirmStepResult,
} from '@/app/components/ui/ConfirmStepModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { metaOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import { paneStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/panes';
import { confirmedToIdcRows } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedIdcRows';
import {
  deleteVariantOf,
  terraformSentence,
  type GateState,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/deleteVariant';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';
import {
  deleteConfirmedResources,
  getTerraformStatus,
  type ConfirmedIntegrationResponse,
  type ConfirmedResourceProvider,
  type TerraformStatusResponse,
} from '@/app/lib/api';

/** 목록은 최대 열 줄이다 — 그 아래는 건수 한 줄. */
const MAX_ROWS = 10;

const styles = {
  /** 목록 — 검색도 필터도 페이지도 없다. 지워질 것이 무엇인지 보이면 되는 자리다. */
  row: 'flex items-center gap-3 border-b border-[var(--pl-border)] py-[7px] text-[12px]',
  rowName: 'min-w-0 flex-1 truncate text-[var(--pl-text-strong)]',
  rowMono:
    'min-w-0 max-w-[180px] flex-none truncate text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]',
  rowTail: 'flex-none text-[var(--pl-text-weak)]',
  more: 'pt-2 text-[12px] text-[var(--pl-text-weak)]',
  /** 막힌 화면의 2칸 kv — pane 의 정체 슬롯과 같은 문법(`paneStyles.kvKey/kvValue`). */
  kvGrid: 'grid grid-cols-2 gap-x-8',
  /** ConfirmTab.tsx 의 `styles.tag` + `TAG_TONE.ok` 와 같은 문자열. */
  tag: 'inline-flex flex-none items-center rounded-[6px] px-1.5 py-0.5 text-[12px] font-semibold leading-[1.34] bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  /** `block` — 라벨과 입력은 두 줄이다. inline 이면 입력이 라벨 옆에 붙어 한 줄이 된다. */
  label: 'block text-[12px] font-semibold text-[var(--pl-text-medium)]',
  check: 'mt-4 flex cursor-pointer items-center gap-2 text-[12px] text-[var(--pl-text-medium)]',
} as const;

/** 한 줄이 말하는 것 — 정체(이름·주소) · 식별자 · 종류. provider 로 재료만 갈린다. */
interface DeleteRow {
  key: string;
  name: string;
  mono: string | null;
  tail: string | null;
}

function rowsOf(current: ConfirmedIntegrationResponse, isIdc: boolean): DeleteRow[] {
  if (isIdc) {
    // IDC 의 정체는 이름이 아니라 접속 주소다 — 요청 표와 같은 매퍼가 그 주소를 만든다.
    return confirmedToIdcRows(current.resource_infos).map((row, index) => {
      const host = row.connectTargets[0] ?? null;
      const address = host == null ? '—' : row.port != null ? `${host}:${row.port}` : host;
      return {
        key: row.resourceId ?? `idc-${index}`,
        name: address,
        mono: null,
        tail: row.resourceName,
      };
    });
  }
  return confirmedIntegrationToConfirmed(current).map((resource, index) => ({
    key: resource.resourceId || `res-${index}`,
    name: resource.resourceName || '—',
    mono: resource.resourceId || null,
    // 엔진 이름은 pane 의 표가 쓰는 그 함수로 접는다 — 같은 사실이 두 자리에서
    // `MYSQL` 과 `MySQL` 로 갈리면 목록이 다른 데이터를 보여 주는 것처럼 읽힌다.
    tail: resource.databaseType ? getDatabaseShortLabel(resource.databaseType) : null,
  }));
}

function DeleteList({
  current,
  isIdc,
}: {
  current: ConfirmedIntegrationResponse;
  isIdc: boolean;
}): ReactElement {
  const rows = useMemo(() => rowsOf(current, isIdc), [current, isIdc]);
  const hidden = rows.length - MAX_ROWS;

  return (
    <div>
      {rows.slice(0, MAX_ROWS).map((row) => (
        <div key={row.key} className={styles.row}>
          <span className={styles.rowName}>{row.name}</span>
          {row.mono && <span className={styles.rowMono}>{row.mono}</span>}
          {row.tail && <span className={styles.rowTail}>{row.tail}</span>}
        </div>
      ))}
      {hidden > 0 && <p className={styles.more}>외 {hidden}건</p>}
    </div>
  );
}

export interface ConfirmDeleteModalProps {
  targetSourceId: number;
  provider: ConfirmedResourceProvider;
  /** 지워질 확정 정보 — 부모가 이미 들고 있다. */
  current: ConfirmedIntegrationResponse;
  /** 게이트의 초기값. 마운트 시 한 번 다시 조회한다(모달이 오래 열려 있을 수 있다). */
  terraform: TerraformStatusResponse | null;
  /** 게이트에 걸렸을 때의 유일한 출구 — 철거는 인프라 작업 탭이 소유한다. */
  onOpenInfra: () => void;
  onClose: () => void;
  /** 삭제가 성공한 뒤 닫을 때만 — 뒤 화면을 다시 읽는다. */
  onDone: () => void;
}

export function ConfirmDeleteModal({
  targetSourceId,
  provider,
  current,
  terraform,
  onOpenInfra,
  onClose,
  onDone,
}: ConfirmDeleteModalProps): ReactElement {
  /**
   * **아는 상태로 먼저 선다.** 부모 탭은 진입 3콜 중 하나로 terraform-status 를 이미 읽어
   * 두었고(`overall_state`), 마운트의 재조회는 그것을 **확인**할 뿐이다. 조회부터 기다리면
   * 첫 프레임이 늘 `checking`(목록 + 입력)이라, `ConfirmStepModal` 이 그 높이로 상자를
   * 고정한 뒤(minHeight) 짧은 `blocked` 본문이 도착해 270px 짜리 빈 칸이 남는다.
   *
   * 대신 확인이 끝나기 전에는 **파괴적인 것이 하나도 열리지 않는다**(`fresh`): 입력도
   * 실행 버튼도 꺼져 있고, 열려 있는 것은 막힌 화면의 이동 버튼뿐이다. 부모가 값을 주지
   * 못했으면(SDU·조회 실패) 아는 것이 없으므로 그대로 조회부터 기다린다.
   */
  const [gate, setGate] = useState<GateState>(
    terraform
      ? { state: 'ready', overallState: terraform.overall_state ?? null }
      : { state: 'loading', overallState: null },
  );
  /** 이 화면의 게이트가 **이 모달이 직접 읽은** 값인가. 부모의 값은 아직 참고일 뿐이다. */
  const [fresh, setFresh] = useState(false);
  const [checkKey, setCheckKey] = useState(0);
  const [typed, setTyped] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<ConfirmStepResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // **이 효과는 로딩 상태를 세우지 않는다.** 첫 조회는 부모가 아는 상태를 그대로 보여
  // 주면서 `fresh` 만 false 로 두고(그래서 파괴적인 것이 하나도 열리지 않는다), 다시
  // 확인은 `recheck` 가 그 자리에서 loading 을 세운 뒤 키를 올린다. 효과 안의 setState 는
  // 그 한 줄을 위해 렌더를 한 번 더 돌리는 일이다.
  useEffect(() => {
    let alive = true;
    void getTerraformStatus(targetSourceId)
      .then((status) => {
        if (!alive) return;
        setGate({ state: 'ready', overallState: status.overall_state ?? null });
        setFresh(true);
      })
      .catch(() => {
        if (!alive) return;
        setGate({ state: 'failed', overallState: null });
        // 실패도 확인이 끝난 것이다 — 그 뒤는 `unknown` 화면이 제 게이트(체크박스)를 진다.
        setFresh(true);
      });
    return () => {
      alive = false;
    };
  }, [targetSourceId, checkKey]);

  // AGENTS §6 — mutation 흐름은 useApiMutation/useApiAction. 결과는 이 모달의 결과
  // 프레임이 받으므로 전역 토스트로 흘리지 않는다.
  const removeAction = useApiAction(() => deleteConfirmedResources(targetSourceId, provider), {
    onSuccess: () =>
      setResult({
        kind: 'success',
        title: '확정 정보를 삭제했습니다',
        description: '재승인 절차를 처음부터 다시 진행할 수 있습니다.',
      }),
    onError: (error) =>
      setResult({
        kind: 'error',
        title: '삭제하지 못했습니다',
        description: '잠시 후 다시 시도하세요.',
        reason: error instanceof Error ? error.message : undefined,
      }),
  });

  const recheck = (): void => {
    setGate((prev) => ({ ...prev, state: 'loading' }));
    setFresh(false);
    setCheckKey((key) => key + 1);
  };

  const variant = deleteVariantOf(gate);
  const count = current.resource_infos.length;
  const blocked = variant === 'blocked';
  const typedOk = typed.trim() === String(targetSourceId);

  /** 성공한 뒤에 닫는 것만 뒤 화면을 다시 읽는다 — 실패·취소는 서버를 바꾸지 않았다. */
  const close = (): void => {
    if (result?.kind === 'success') onDone();
    onClose();
  };

  const confirm = (): void => {
    if (blocked) {
      onClose();
      onOpenInfra();
      return;
    }
    void removeAction.execute();
  };

  // 막힌 화면의 CTA 는 이동이라 확인 전에도 열려 있다 — 그것 말고는 아무것도 열리지 않는다.
  const confirmDisabled = blocked
    ? false
    : !fresh
      ? true
      : variant === 'unknown'
        ? !(acknowledged && typedOk)
        : !typedOk;

  const title = blocked
    ? '지금은 삭제할 수 없습니다'
    : variant === 'unknown'
      ? 'Terraform 상태를 확인하지 못했습니다'
      : `확정 정보 ${count}건을 삭제할까요?`;

  // 아는 상태를 말하면서 확인 중이라는 것도 말한다 — 게이트에 가짜 loading 을 먹여
  // 문장을 만들지 않는다(그러면 아는 사실이 화면에서 사라진다). 두 문장을 잇는다.
  const stillChecking = !fresh && variant === 'allowed' ? ' Terraform 상태를 확인하는 중입니다.' : '';
  const description = blocked
    ? terraformSentence(gate)
    : variant === 'unknown'
      ? '인프라가 올라가 있으면 확정 정보만 지우는 것이 고아 리소스를 만듭니다. 상태를 다시 확인하거나, 확인하고 진행하세요.'
      : `삭제하면 재승인 절차를 처음부터 다시 진행해야 합니다. ${terraformSentence(gate)}${stillChecking}`;

  const typedInput = (
    <div className={variant === 'unknown' ? 'mt-4' : 'mt-5'}>
      <label className={styles.label} htmlFor="confirm-delete-typed">
        확인을 위해 <b>{targetSourceId}</b> 를 입력하세요
      </label>
      <input
        ref={inputRef}
        id="confirm-delete-typed"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        disabled={!fresh || (variant === 'unknown' && !acknowledged)}
        placeholder="Target Source ID"
        className={cn(pipelineStyles.input, 'mt-2 w-full max-w-[280px]')}
      />
    </div>
  );

  return (
    <ConfirmStepModal
      open
      size="md"
      // 막힌 화면은 파괴적이지 않다 — 여기서 누를 수 있는 것은 이동뿐이다.
      tone={blocked ? 'default' : 'warning'}
      title={title}
      description={description}
      confirmLabel={blocked ? '인프라 작업 탭으로' : '삭제'}
      cancelLabel={blocked ? '닫기' : undefined}
      confirmDisabled={confirmDisabled}
      isPending={removeAction.loading}
      // 허용 화면에서만, 그것도 확인이 끝난 뒤에 입력이 초점을 받는다 — 그 전에는 꺼져
      // 있어 `focus()` 가 아무 일도 하지 않는다.
      initialFocus={variant === 'allowed' && fresh ? inputRef : undefined}
      result={result}
      onRetry={() => void removeAction.execute()}
      explicitDismiss
      onConfirm={confirm}
      onClose={close}
    >
      {blocked ? (
        /* 목록도 입력도 없다 — 지울 수 없는 화면에서 지워질 것을 세는 일은 할 수 없는
           동작을 준비시키는 것이다. 남는 사실 둘만 pane 과 같은 kv 문법으로 적는다. */
        <div className={styles.kvGrid}>
          <div className="min-w-0">
            <p className={paneStyles.kvKey}>Terraform</p>
            <p className={cn(paneStyles.kvValue, 'flex')}>
              <span className={styles.tag}>{metaOf(gate.overallState).label}</span>
            </p>
          </div>
          <div className="min-w-0">
            <p className={paneStyles.kvKey}>확정 리소스</p>
            <p className={paneStyles.kvValue}>{count}건</p>
          </div>
        </div>
      ) : variant === 'unknown' ? (
        <>
          <div>
            <PlButton variant="secondary" size="sm" onClick={recheck}>
              다시 확인
            </PlButton>
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            인프라가 없음을 직접 확인했습니다
          </label>
          {typedInput}
        </>
      ) : (
        <>
          <DeleteList current={current} isIdc={provider === 'IDC'} />
          {typedInput}
        </>
      )}
    </ConfirmStepModal>
  );
}
