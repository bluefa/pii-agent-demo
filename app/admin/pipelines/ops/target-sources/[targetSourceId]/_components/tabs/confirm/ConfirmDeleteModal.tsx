'use client';

/**
 * 확정 정보 삭제 확인 — 편집기와 **별개의 문**이다.
 *
 * 삭제는 오래 편집기 안의 모드였다(같은 평면의 영역 교체). 그 배치는 지우려는 사람에게
 * 편집기를 먼저 열게 했고, 지우는 화면이 편집 화면의 크롬(Parameters · Request body ·
 * 응답 칸)을 그대로 물려받았다 — 삭제에는 보낼 본문도, 정할 파라미터도 없다.
 *
 * 그래서 문법을 이 콘솔이 이미 쓰는 파괴적 동작의 것으로 맞춘다: 연동 초기화(`DangerTab`)
 * 와 같은 `ConfirmStepModal` 이다.
 *
 * **이 화면은 건수만 말한다**(오너 지시 09-04). 지워질 것의 목록도, 막힌 화면의 kv 칸도
 * 없앴다 — 확인 모달의 질문은 "이 N건을 지울 것인가" 하나이고, 그 답에 필요한 사실은
 * 제목의 건수뿐이다. 성공 프레임도 같은 이유로 없앴다: 뒤 화면이 이 동작의 기록이므로
 * 성공하면 모달은 저 혼자 닫히고 탭이 다시 읽는다. 결과 프레임은 실패만 받는다.
 *
 * 화면은 게이트 하나로 넷으로 갈린다(`deleteVariant.ts`): 조회 중 · 막힘 · 허용 · 모름.
 * **막는 상태는 `APPLIED` 하나뿐**이고, 막혔을 때의 유일한 출구는 인프라 작업 탭이다 —
 * 철거는 이 화면이 소유하지 않는다.
 *
 * 마운트가 곧 열림이다(편집기와 같은 규칙): 부모는 열려 있는 동안만 이것을 렌더한다.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { useApiAction } from '@/app/hooks/useApiMutation';
import {
  ConfirmStepModal,
  type ConfirmStepResult,
} from '@/app/components/ui/ConfirmStepModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import {
  deleteVariantOf,
  terraformSentence,
  type GateState,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/deleteVariant';
import {
  deleteConfirmedResources,
  getTerraformStatus,
  type ConfirmedIntegrationResponse,
  type ConfirmedResourceProvider,
  type TerraformStatusResponse,
} from '@/app/lib/api';

const styles = {
  /** `block` — 라벨과 입력은 두 줄이다. inline 이면 입력이 라벨 옆에 붙어 한 줄이 된다. */
  label: 'block text-[12px] font-semibold text-[var(--pl-text-medium)]',
  check: 'mt-4 flex cursor-pointer items-center gap-2 text-[12px] text-[var(--pl-text-medium)]',
} as const;

export interface ConfirmDeleteModalProps {
  targetSourceId: number;
  provider: ConfirmedResourceProvider;
  /** 지워질 확정 정보 — 부모가 이미 들고 있다. 이 화면이 쓰는 것은 그 **건수**뿐이다. */
  current: ConfirmedIntegrationResponse;
  /** 게이트의 초기값. 마운트 시 한 번 다시 조회한다(모달이 오래 열려 있을 수 있다). */
  terraform: TerraformStatusResponse | null;
  /** 게이트에 걸렸을 때의 유일한 출구 — 철거는 인프라 작업 탭이 소유한다. */
  onOpenInfra: () => void;
  onClose: () => void;
  /** 삭제가 성공했을 때만 — 뒤 화면을 다시 읽는다. */
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
   * 첫 프레임이 늘 `checking`(입력)이라, `ConfirmStepModal` 이 그 높이로 상자를 고정한 뒤
   * 짧은 `blocked` 본문이 도착해 빈 칸이 남는다.
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

  // AGENTS §6 — mutation 흐름은 useApiMutation/useApiAction. 실패만 이 모달의 결과
  // 프레임이 받으므로 전역 토스트로 흘리지 않는다. 성공은 프레임 없이 그대로 닫는다 —
  // 뒤 화면이 이 동작의 기록이라, 성공을 한 번 더 말하는 칸은 닫기를 한 번 더 시키는 일이다.
  const removeAction = useApiAction(() => deleteConfirmedResources(targetSourceId, provider), {
    onSuccess: () => {
      onDone();
      onClose();
    },
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

  // 확인 중이라는 것도 말한다 — 입력이 꺼져 있는 이유가 화면에 없으면 고장으로 읽힌다.
  // `checking`(부모가 값을 못 준 경우)과 `allowed` 인데 재조회가 아직 안 온 경우가 같은 자리다.
  const stillChecking =
    !fresh && (variant === 'checking' || variant === 'allowed')
      ? ' Terraform 상태를 확인하는 중입니다.'
      : '';
  const description = blocked
    ? terraformSentence(gate)
    : variant === 'unknown'
      ? '인프라가 올라가 있으면 확정 정보만 지우는 것이 고아 리소스를 만듭니다. 상태를 다시 확인하거나, 확인하고 진행하세요.'
      : `삭제하면 재승인 절차를 처음부터 다시 진행해야 합니다.${stillChecking}`;

  const typedInput = (
    <div className={variant === 'unknown' ? 'mt-4' : undefined}>
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
      size="sm"
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
      onConfirm={confirm}
      onClose={onClose}
    >
      {/* 막힌 화면에는 본문이 없다 — 지울 수 없는 화면에서 준비시킬 동작이 없다.
          제목과 Terraform 문장, 그리고 출구 하나가 전부다. */}
      {blocked ? undefined : variant === 'unknown' ? (
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
        typedInput
      )}
    </ConfirmStepModal>
  );
}
