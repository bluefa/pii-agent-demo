'use client';

import { useMemo } from 'react';
import { useLocale } from '@/app/components/LocaleProvider';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { useLogicalDatabases } from '@/app/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';
import { isParentDeny } from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-deny';
import type { LogicalDatabase } from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';
import type { SkipReason } from '@/app/lib/api/logical-db';
import type { TcScope } from '@/app/lib/api/tc-scope';
import { CANDIDATE_COPY } from '@/app/target-sources/[targetSourceId]/_components/candidate/copy';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

interface LogicalDbSummaryModalProps {
  open: boolean;
  targetSourceId: number;
  resourceId: string;
  resourceName: string;
  /**
   * Which connection-test run to read. The renderer decides: the cloud Steps 6·7 table passes
   * `latestSuccess`, the IDC panel hands down whatever its own step gave it.
   */
  scope: TcScope;
  onClose: () => void;
}

/**
 * Step 6 — read-only view of what the Step 5 connection test found: the logical DBs
 * being integrated, and the ones the skip policy excludes.
 *
 * Read-only on purpose. The Step 5 modal (LogicalDbModal) moves rows between the two
 * panels and PUTs the policy; by Step 6 the completion-approval request is already
 * filed, so editing here would leave the screen disagreeing with what was requested.
 * The way to change it is 연결 테스트 재실행, which rewinds to Step 5 — stated in the footer.
 *
 * Same data hook as the Step 5 modal, so both screens read one source.
 */
export const LogicalDbSummaryModal = ({
  open,
  targetSourceId,
  resourceId,
  resourceName,
  scope,
  onClose,
}: LogicalDbSummaryModalProps) => {
  const { locale } = useLocale();
  const t = CANDIDATE_COPY[locale].logicalDb;
  const { state, retry } = useLogicalDatabases(targetSourceId, resourceId, scope);

  // `databases` already merges the policy-only names (excluded but not discovered), so the
  // split is by membership in the skip set. A SCHEMA under an excluded parent DATABASE is
  // dropped from both panels — the parent deny already covers it, which is how Step 5's
  // right panel and the PUT payload (`isParentDeny`) treat it.
  const { included, excluded, reasons } = useMemo(() => {
    if (state.status !== 'ready') {
      return { included: [], excluded: [], reasons: {} as Record<string, SkipReason> };
    }
    const excludedIds = state.initialDraft.excludedIds;
    const rows = state.databases.filter((db) => !isParentDeny(db, excludedIds));
    return {
      included: rows.filter((db) => !excludedIds.has(db.id)),
      excluded: rows.filter((db) => excludedIds.has(db.id)),
      reasons: state.initialDraft.reasons,
    };
  }, [state]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="logical"
      // Mirrors the Step 5 modal: no shared header, the title block below is the first
      // element so the two screens read as the same object in two modes.
      chrome="bare"
      // The bare chrome renders no header, so the dialog carries its name directly.
      ariaLabel={t.summaryLabel(resourceName)}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className={cn('text-[12px] leading-[1.5]', textColors.tertiary)}>
            {t.summaryFooterLead}
            <strong className="font-semibold">{t.summaryFooterEmphasis}</strong>
            {t.summaryFooterTail}
          </span>
          <Button variant="secondary" onClick={onClose}>
            {t.summaryClose}
          </Button>
        </div>
      }
    >
      <h2
        className={cn(
          'mb-2 text-[20px] font-bold leading-[1.2] tracking-[-0.02em]',
          textColors.primary,
        )}
      >
        {t.summaryTitle}
      </h2>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'shrink-0 text-[12px] font-bold uppercase tracking-[0.06em]',
            textColors.tertiary,
          )}
        >
          Resource
        </span>
        <span className={cn('font-mono text-[12px] font-semibold', primaryColors.text)}>
          {resourceName}
        </span>
      </div>
      <p className={cn('mb-3.5 text-[12px] font-medium leading-[1.5]', textColors.tertiary)}>
        {t.summaryNote}
      </p>

      {state.status === 'loading' && <ResourceTableSkeleton />}
      {state.status === 'error' && (
        <div className="space-y-3 py-8 text-center">
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>{state.message}</p>
          <Button variant="secondary" onClick={retry}>
            {t.retry}
          </Button>
        </div>
      )}
      {state.status === 'ready' && (
        <div className="grid grid-cols-2 gap-3">
          <Panel
            label={t.summaryIncluded}
            items={included}
            emptyMessage={t.summaryIncludedEmpty}
            countLabel={t.summaryCount}
          />
          <Panel
            label={t.summaryExcluded}
            items={excluded}
            reasons={reasons}
            emptyMessage={t.summaryExcludedEmpty}
            countLabel={t.summaryCount}
          />
        </div>
      )}
    </Modal>
  );
};

interface PanelProps {
  label: string;
  items: ReadonlyArray<LogicalDatabase>;
  /** Excluded panel only — the skip reason rendered per row. */
  reasons?: Readonly<Record<string, SkipReason>>;
  emptyMessage: string;
  /** Korean counts with a unit and English does not, so the caller's dictionary owns the badge. */
  countLabel: (count: number) => string;
}

const Panel = ({ label, items, reasons, emptyMessage, countLabel }: PanelProps) => (
  <div
    className={cn(
      'flex max-h-[400px] min-h-[280px] flex-col overflow-hidden rounded-lg border',
      bgColors.surface,
      borderColors.default,
    )}
  >
    <header
      className={cn('flex items-center justify-between border-b px-3 py-2', borderColors.light)}
    >
      <span className={cn('text-[13px] font-bold', textColors.primary)}>{label}</span>
      <span
        className={cn(
          'rounded-full px-[7px] py-px text-[11px] font-bold tabular-nums',
          bgColors.panel,
          textColors.secondary,
        )}
      >
        {countLabel(items.length)}
      </span>
    </header>
    <div className="flex-1 overflow-y-auto">
      {items.length === 0 ? (
        <p className={cn('px-3 py-12 text-center text-[12.5px]', textColors.tertiary)}>
          {emptyMessage}
        </p>
      ) : (
        <ul>
          {items.map((db) => (
            <li
              key={db.id}
              className={cn(
                'flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0',
                borderColors.light,
              )}
            >
              <span className={cn('truncate font-mono text-[12.5px]', textColors.primary)}>
                {db.name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-[5px] px-1.5 py-px text-[10.5px] font-bold',
                    bgColors.panel,
                    textColors.tertiary,
                  )}
                >
                  {db.type === 'schema' ? 'SCHEMA' : 'DATABASE'}
                </span>
                {reasons?.[db.id] && (
                  <span
                    className={cn(
                      'rounded-[5px] px-1.5 py-px text-[10.5px] font-bold',
                      statusColors.warning.bg,
                      statusColors.warning.textDark,
                    )}
                  >
                    {reasons[db.id]}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);
