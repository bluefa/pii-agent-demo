'use client';

import { useLocale } from '@/app/components/LocaleProvider';
import { CANDIDATE_COPY } from '@/app/target-sources/[targetSourceId]/_components/candidate/copy';
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
 * 단위(`개`)는 자기 크기를 갖지 않는다 — 수에서 물려받아 14px 로 선다 (오너 2026-08-27:
 * IDC 표의 행은 글자 크기 하나로 읽는다). 전에는 12px 이라 한 칸 안에서 수와 단위가 두
 * 눈금으로 갈렸고, 그 12 는 이 컴포넌트를 함께 쓰는 클라우드 표에도 같이 서 있었다.
 *
 * `loading` is not the same absence as `—`. The dash is a settled fact — this round answered,
 * and it said nothing about this row. `loading` is "this round's counts are not known yet",
 * which a dash would state as a verdict and then flip a moment later. Same distinction
 * `TcStatusTag` draws in the 연결 상태 칸 next door, drawn the same way: a bar the size of
 * this cell's content, no text.
 *
 * Shared by the cloud (WaitingApprovalTable) and IDC (IdcResourceTable) step-6 tables.
 */
export const LogicalDbCountCell = ({
  count,
  label,
  onOpen,
  loading = false,
}: {
  count: number | null | undefined;
  label: string;
  onOpen?: () => void;
  /** 이번 회차의 건수를 아직 모른다 — 수도 `—` 도 아닌 스켈레톤. */
  loading?: boolean;
}) => {
  const { locale } = useLocale();
  const t = CANDIDATE_COPY[locale].logicalDb;

  if (loading) {
    // 14px 수 + `개` 한 글자의 크기다 — 옆 칸 판정 알약(26×52)이 아니라 이 칸이 들일 내용에 맞춘다.
    return (
      <span
        className={cn(idcStyles.skeletonBar, 'block h-[18px] w-[34px] rounded')}
        aria-hidden="true"
      />
    );
  }
  if (count == null) return <span className={textColors.tertiary}>—</span>;
  if (count === 0 || !onOpen) {
    // tertiary, not the quaternary used for the — placeholder: a reported count is content, and
    // normal text needs 4.5:1 (gray-400 is 2.8:1 on white). Quieter than a link, still
    // readable — which is what a number nobody can click should be.
    //
    // 14px — 이 셀이 앉는 행의 눈금이다. 13px 은 v16 에서 넘어온 홀수 값이라 디자인 가드가
    // 지금은 받지 않고, 확인 모달의 14px 행 안에서 이 열만 한 칸 작았다. 아래 드릴다운
    // 갈래도 같은 14px(`linkNeutralMd`) 이다 — 한 열이 두 눈금으로 갈리면 안 된다.
    return (
      <span className={cn('text-[14px] font-medium', numericFeatures.tabular, textColors.tertiary)}>
        {count}
        {t.countUnit ? <span className="ml-px">{t.countUnit}</span> : null}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn(idcStyles.triggerBtn.linkNeutralMd, numericFeatures.tabular)}
    >
      {count}
      {t.countUnit ? <span className="font-medium">{t.countUnit}</span> : null}
    </button>
  );
};
