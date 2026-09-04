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
 * **Terraform 게이트는 없다**(오너 결정 09-04). `APPLIED` 에서 삭제를 막던 것은 계약이
 * 아니라 프론트가 지어낸 안전장치였다 — swagger 의 DELETE 에는 그런 거부 응답이 없다.
 * 막는 대신 말한다: `APPLIED` 면 설명에 문장 하나가 붙고, 삭제는 언제나 시도할 수 있다.
 * 그 문장은 부모 탭이 이미 들고 있는 상태로 쓰므로 **이 모달은 제 조회를 하지 않는다**.
 *
 * 마운트가 곧 열림이다(편집기와 같은 규칙): 부모는 열려 있는 동안만 이것을 렌더한다.
 */
import { useRef, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { useApiAction } from '@/app/hooks/useApiMutation';
import {
  ConfirmStepModal,
  type ConfirmStepResult,
} from '@/app/components/ui/ConfirmStepModal';
import {
  deleteConfirmedResources,
  type ConfirmedIntegrationResponse,
  type ConfirmedResourceProvider,
  type TerraformStatusResponse,
} from '@/app/lib/api';

const styles = {
  /** `block` — 라벨과 입력은 두 줄이다. inline 이면 입력이 라벨 옆에 붙어 한 줄이 된다. */
  label: 'block text-[12px] font-semibold text-[var(--pl-text-medium)]',
} as const;

export interface ConfirmDeleteModalProps {
  targetSourceId: number;
  provider: ConfirmedResourceProvider;
  /** 지워질 확정 정보 — 부모가 이미 들고 있다. 이 화면이 쓰는 것은 그 **건수**뿐이다. */
  current: ConfirmedIntegrationResponse;
  /** 부모 탭이 이미 읽어 둔 상태. `APPLIED` 일 때 경고 한 문장을 더할 뿐이다. */
  terraform: TerraformStatusResponse | null;
  onClose: () => void;
  /** 삭제가 성공했을 때만 — 뒤 화면을 다시 읽는다. */
  onDone: () => void;
}

export function ConfirmDeleteModal({
  targetSourceId,
  provider,
  current,
  terraform,
  onClose,
  onDone,
}: ConfirmDeleteModalProps): ReactElement {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<ConfirmStepResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const count = current.resource_infos.length;
  const typedOk = typed.trim() === String(targetSourceId);

  // 인프라가 올라가 있다는 사실만 말한다 — 그 밖의 상태에서 같은 말을 하면 계약에 없는
  // 것을 단정하는 일이 된다. 철거는 여전히 인프라 작업 탭이 소유한다.
  const applied = terraform?.overall_state === 'APPLIED';
  const description =
    '삭제하면 재승인 절차를 처음부터 다시 진행해야 합니다.' +
    (applied
      ? ' Terraform 이 이 확정 정보로 인프라를 올린 상태입니다. 삭제해도 인프라는 남습니다.'
      : '');

  return (
    <ConfirmStepModal
      open
      size="sm"
      tone="warning"
      title={`확정 정보 ${count}건을 삭제할까요?`}
      description={description}
      confirmLabel="삭제"
      confirmDisabled={!typedOk}
      isPending={removeAction.loading}
      initialFocus={inputRef}
      result={result}
      onRetry={() => void removeAction.execute()}
      onConfirm={() => void removeAction.execute()}
      onClose={onClose}
    >
      <div>
        <label className={styles.label} htmlFor="confirm-delete-typed">
          확인을 위해 <b>{targetSourceId}</b> 를 입력하세요
        </label>
        <input
          ref={inputRef}
          id="confirm-delete-typed"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Target Source ID"
          className={cn(pipelineStyles.input, 'mt-2 w-full max-w-[280px]')}
        />
      </div>
    </ConfirmStepModal>
  );
}
