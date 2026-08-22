'use client';

import { cn, idcStyles, numericFeatures, textColors } from '@/lib/theme';

/**
 * A logical-DB count (step 6). Non-zero opens the read-only list, so it renders as the
 * underlined text action the app uses for in-context links — a filled button per row would
 * turn the table into a toolbar. Zero has nothing to open, so it stays plain text rather
 * than a link that answers with an empty panel; a missing summary row renders —.
 *
 * No `onOpen` means the number is not drillable — a caller whose count is an aggregate over
 * several resources has no single id to open. It renders as plain text rather than a control
 * that does nothing when pressed.
 *
 * Neutral in both columns: the header says which is 연동 and which is 제외, so tinting the
 * numbers repeats that in a louder channel once per row.
 *
 * Shared by the cloud (WaitingApprovalTable) and IDC (IdcResourceTable) step-6 tables.
 */
export const LogicalDbCountCell = ({
  count,
  label,
  onOpen,
}: {
  count: number | null | undefined;
  label: string;
  onOpen?: () => void;
}) => {
  if (count == null) return <span className={textColors.tertiary}>—</span>;
  if (count === 0 || !onOpen) {
    // tertiary, not the quaternary used for the — placeholder: a reported count is content, and
    // normal text needs 4.5:1 (gray-400 is 2.8:1 on white). Quieter than a link, still
    // readable — which is what a number nobody can click should be.
    //
    // 14px — 이 셀이 앉는 행의 눈금이다. 13px 은 v16 에서 넘어온 홀수 값이라 디자인 가드가
    // 지금은 받지 않고, 확인 모달의 14px 행 안에서 이 열만 한 칸 작았다. 드릴다운되는 쪽은
    // 공용 `triggerBtn.linkNeutral`(13px)을 그대로 쓴다 — 그 토큰은 카드의 링크들도 함께
    // 든다. 승인 모달은 두 열 다 평문이라 이 갈래만 지난다.
    return (
      <span className={cn('text-[14px] font-medium', numericFeatures.tabular, textColors.tertiary)}>
        {count}
        <span className="ml-px text-[12px]">개</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn(idcStyles.triggerBtn.linkNeutral, numericFeatures.tabular)}
    >
      {count}
      <span className="text-[12px] font-medium">개</span>
    </button>
  );
};
