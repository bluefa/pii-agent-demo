'use client';

import { cn } from '@/lib/theme';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { useLocale } from '@/app/components/LocaleProvider';
import { STATUS_COPY } from '@/app/components/features/process-status/status-copy';

interface CredentialMissingNoticeProps {
  /** Rows that still need a credential. 0 draws nothing — that is the normal state. */
  count: number;
  /** True while the table is filtered down to the missing rows. */
  filterOn: boolean;
  onToggleFilter: () => void;
  /** Spacing against the caller's own stack; the box itself owns no outer margin. */
  className?: string;
}

/**
 * Credential 미설정 알림 — the one notice three surfaces share (admin 연결 테스트 card,
 * cloud Step 5, IDC Step 5).
 *
 * It is a boxed notice, not a bare line (owner 2026-08-30, 시안 A). The earlier shape was a
 * single line reasoning that a card inside a card is two boxes of the same weight; the owner's
 * call is that this notice is not a footnote to the card but the reason its primary action is
 * closed, and a wash box is what says that at a glance. The err wash notice already standing in
 * the admin card (triggerFailed) is the weight it matches.
 *
 * One component on purpose: the copy is the same step in every CSP, so the three surfaces must
 * not be able to drift into three sentences. The toggle is the caller's — the box states the
 * fact and hands over the one action that reaches it, which is the caller's own table filter.
 */
export const CredentialMissingNotice = ({
  count,
  filterOn,
  onToggleFilter,
  className,
}: CredentialMissingNoticeProps) => {
  const { locale } = useLocale();
  const t = STATUS_COPY[locale].credential;

  if (count <= 0) return null;

  return (
    <div
      className={cn(
        'rounded-[12px] border border-[var(--pl-warn-border)] bg-[var(--pl-warn-bg)] px-3.5 py-3',
        className,
      )}
    >
      {/* 경고를 색만으로 말하지 않는다(WCAG 1.4.1) — 마크가 색 없이도 같은 뜻을 진다. */}
      <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--pl-warn-text)]">
        <StatusWarningIcon className="h-4 w-4 shrink-0" />
        {t.title}
      </div>
      {/* 제목의 글리프 열(16px + gap-2)에 본문을 맞춘다 — 상자 안에서 두 줄이 한 글 열에 선다. */}
      <p className="mt-1.5 break-keep pl-6 text-[14px] leading-[1.5] text-[var(--pl-warn-text)]">
        <b className="font-bold tabular-nums">{t.count(count)}</b>
        {t.body}
      </p>
      <button
        type="button"
        onClick={onToggleFilter}
        aria-pressed={filterOn}
        className="mt-2 ml-6 cursor-pointer whitespace-nowrap text-[14px] font-semibold text-[var(--pl-warn-text)] underline underline-offset-2"
      >
        {filterOn ? t.showAll : t.showMissingOnly}
      </button>
    </div>
  );
};
