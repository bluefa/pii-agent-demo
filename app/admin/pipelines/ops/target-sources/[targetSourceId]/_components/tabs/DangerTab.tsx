'use client';

/**
 * 연동 초기화 tab — the only admin entrance to the reset action (swagger
 * `resetTargetSource`), which forces this target source back to 1단계 (IDLE).
 *
 * The card wears no red edge. A tinted rule around a whole panel is the grammar this
 * console uses for a STATE the target is in, and 초기화 is an action nobody has taken;
 * the caution rides on the title and on the one filled button instead, which is what
 * an operator actually presses.
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles, statusColors } from '@/lib/theme';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { resetTargetSource } from '@/app/lib/api';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** swagger TargetSourceResetRequestDto.reason maxLength — the field stops before the
 *  server truncates what an operator wrote into the audit log. */
const REASON_MAXLEN = 1000;

/** What the reset does, what it does NOT require, and when to reach for it. */
const NOTES = [
  '초기화하면 이 Target Source는 1단계로 돌아가, 연동 대상 DB 선택부터 다시 진행합니다.',
  '확정 정보 삭제나 Terraform 제거 같은 사전 작업은 필요하지 않습니다.',
  '서비스 담당자의 요청이 있거나, 연동을 반드시 처음부터 다시 해야 하는 경우에만 수행하세요.',
];

/** opsStyles.cardTitle at the warning tone. Written out rather than `cn`-ed onto that
 *  token: `cn` is a plain join, so two text colours on one element are decided by the
 *  order Tailwind emits them, not by the order they are listed here. */
const dangerTitle = cn('text-[20px] font-semibold', statusColors.warning.textDark);

export interface DangerTabProps {
  targetSourceId: number;
  /** Re-read the screen once the reset lands — every other panel now describes 1단계. */
  onReset: () => void;
}

export function DangerTab({ targetSourceId, onReset }: DangerTabProps): ReactElement {
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toast = usePlToast();
  const trimmedReason = reason.trim();

  const { mutate, loading } = useApiMutation<string, { success: boolean }>(
    (value) => resetTargetSource(targetSourceId, value),
    {
      onSuccess: () => {
        setReason('');
        setConfirmOpen(false);
        toast.show('연동 상태를 초기화했습니다.');
        onReset();
      },
      // Both sentences belong to this screen (ADR-008) — the upstream message is not UI copy.
      onError: () => toast.show('연동 상태 초기화에 실패했습니다.'),
    },
  );

  return (
    <section className={pipelineStyles.card.base} aria-label="연동 상태 초기화">
      <h2 className={dangerTitle}>연동 상태 초기화</h2>
      {NOTES.map((note) => (
        <p key={note} className={opsStyles.cardDesc}>
          {note}
        </p>
      ))}

      {/* Same reason field as the 반려 사유 one (RejectModal): same label tier, same textarea,
          same counter — one input written twice in two grammars is two inputs. */}
      <div className="mt-6 max-w-[560px]">
        <label className={tqStyles.modal.label} htmlFor="ops-reset-reason">
          초기화 사유
        </label>
        <textarea
          id="ops-reset-reason"
          value={reason}
          maxLength={REASON_MAXLEN}
          disabled={loading}
          onChange={(event) => setReason(event.target.value)}
          placeholder="예: 운영 DB를 신규 VPC로 이전해 연동 대상 구성을 다시 잡아야 합니다."
          className={tqStyles.modal.textarea}
        />
        {/* Two tones: the number that moves is the strong one, the fixed limit recedes, and
            at the ceiling the count turns error-toned so it says why nothing more types. */}
        <div className={tqStyles.modal.count}>
          <span
            className={cn(
              'font-semibold',
              reason.length >= REASON_MAXLEN
                ? statusColors.error.textDark
                : 'text-[var(--pl-text-strong)]',
            )}
          >
            {reason.length.toLocaleString()}
          </span>
          /{REASON_MAXLEN.toLocaleString()}
        </div>
      </div>

      <div className="mt-4">
        <PlButton
          variant="dangerSolid"
          disabled={trimmedReason === '' || loading}
          onClick={() => setConfirmOpen(true)}
        >
          연동 상태 초기화
        </PlButton>
      </div>

      <ConfirmStepModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void mutate(trimmedReason)}
        title="연동 상태를 초기화할까요?"
        description="이 Target Source는 1단계로 돌아가고, 이미 끝난 설치와 승인은 모두 사라집니다."
        confirmLabel="초기화"
        tone="warning"
        isPending={loading}
      />
    </section>
  );
}
