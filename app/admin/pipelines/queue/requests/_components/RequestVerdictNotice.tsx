/**
 * RequestVerdictNotice — P3 상단, 이미 결정된 요청의 처리 결과.
 *
 * Step 2 의 RejectionVerdict (app/target-sources/[targetSourceId]/_components/
 * layout/RejectionVerdict.tsx) 문법을 그대로 가져온다: 채운 박스가 아니라
 * 3px 좌측 룰에 매단 인용 — 12px 라벨(자기 payload 보다 작게) → 14px medium
 * 사유 → 라벨 붙은 메타 쌍. 서비스 담당자가 Step 2 에서
 * 읽는 것과 운영자가 여기서 읽는 것이 같은 문장이어야 하므로, 표현도 같게
 * 맞춘다. 색만 admin 토큰(--pl-*)으로 바꿨다.
 *
 * 사유가 없는 결정(승인 등)도 같은 블록이 처리한다 — 그때는 인용할 말이 없어
 * 한 줄 문장이 판정을 대신한다.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import type { ApprovalVerdict } from '@/app/lib/api/task-queue-requests';

/** 결정 상태 → 라벨·톤. 모르는 값은 상태 문자열을 그대로 들고 중립 톤으로. */
const VERDICT_LABEL: Record<string, string> = {
  REJECTED: '반려 사유',
  APPROVED: '승인 의견',
  AUTO_APPROVED: '자동 승인',
  CANCELLED: '취소 사유',
  UNAVAILABLE: '연동 불가 사유',
};

const VERDICT_SENTENCE: Record<string, string> = {
  REJECTED: '이 연동 요청은 반려됐어요. 서비스 담당자가 대상을 다시 선택해 재요청할 수 있어요.',
  APPROVED: '이 연동 요청은 승인됐어요. 연동 대상 반영이 진행돼요.',
  AUTO_APPROVED: '이 연동 요청은 자동 승인됐어요.',
  CANCELLED: '이 연동 요청은 취소됐어요.',
  UNAVAILABLE: '이 연동 요청은 연동 불가로 처리됐어요.',
};

const isRejection = (status: string | null): boolean =>
  status === 'REJECTED' || status === 'CANCELLED' || status === 'UNAVAILABLE';

export interface RequestVerdictNoticeProps {
  verdict: ApprovalVerdict;
}

export function RequestVerdictNotice({ verdict }: RequestVerdictNoticeProps): ReactElement {
  const { status, reason, processedAt, processedBy } = verdict;
  const label = (status && VERDICT_LABEL[status]) ?? '처리 결과';
  const sentence =
    (status && VERDICT_SENTENCE[status]) ?? '이 연동 요청은 이미 처리됐어요.';
  // 반려 계열만 warn 룰 — 승인은 사고가 아니므로 중립 룰로 인용한다.
  const rule = isRejection(status) ? 'border-[var(--pl-warn)]' : 'border-[var(--pl-border-strong)]';
  const tagTone = isRejection(status) ? 'text-[var(--pl-warn-text)]' : 'text-[var(--pl-text-weak)]';

  // Step 2 와 같은 라벨·순서(일시 → 사람). 반려면 '반려일시'라고 부른다 —
  // 이 화면엔 요청일시도 함께 있어서 '처리 일시'로는 어느 날짜인지 되묻게 된다.
  const meta = (
    <div className="mt-3 flex flex-wrap gap-8">
      {processedAt && (
        <MetaPair
          label={status === 'REJECTED' ? '반려일시' : '처리일시'}
          value={fmtDateTime(processedAt)}
        />
      )}
      {processedBy && (
        <MetaPair label={status === 'REJECTED' ? '반려자' : '처리자'} value={processedBy} />
      )}
    </div>
  );

  // role=status — 판정은 fetch 이후에야 확정된다.
  return (
    <div className="mb-6" role="status">
      {reason ? (
        <div className={cn('border-l-[3px] pl-4', rule)}>
          <p className={cn('text-[12px] font-bold tracking-[0.02em]', tagTone)}>{label}</p>
          <p className="mt-1.5 text-[14px] font-medium leading-[1.5] text-[var(--pl-text-strong)]">
            {reason}
          </p>
          {meta}
        </div>
      ) : (
        <div className={cn('border-l-[3px] pl-4', rule)}>
          <p className="text-[14px] font-medium leading-[1.55] text-[var(--pl-text-medium)]">
            {sentence}
          </p>
          {meta}
        </div>
      )}
    </div>
  );
}

/** 라벨 위·값 아래 12px 쌍 — 헤더의 요청 시각/요청자와 같은 문법. */
function MetaPair({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="text-[12px] font-normal text-[var(--pl-text-weak)]">{label}</span>
      <span className="min-w-0 truncate text-[12px] font-semibold leading-[1.3] tabular-nums text-[var(--pl-text-medium)]">
        {value}
      </span>
    </span>
  );
}
