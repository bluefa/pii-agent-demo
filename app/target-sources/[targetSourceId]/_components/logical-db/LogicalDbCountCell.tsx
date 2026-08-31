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
  const { locale } = useLocale();
  const t = CANDIDATE_COPY[locale].logicalDb;

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
