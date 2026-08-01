'use client';

import { useMemo } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { useLogicalDatabases } from '@/app/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';
import type { LogicalDatabase } from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';
import type { SkipReason } from '@/app/lib/api/logical-db';
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
  onClose: () => void;
}

/**
 * Step 6 — read-only view of what the Step 5 connection test found: the logical DBs
 * being integrated, and the ones the skip policy excludes.
 *
 * Read-only on purpose. The Step 5 modal (LogicalDbModal) moves rows between the two
 * panels and PUTs the policy; by Step 6 the completion-approval request is already
 * filed, so editing here would leave the screen disagreeing with what was requested.
 * The way to change it is 연결 재확인, which rewinds to Step 5 — stated in the footer.
 *
 * Same data hook as the Step 5 modal, so both screens read one source.
 */
export const LogicalDbSummaryModal = ({
  open,
  targetSourceId,
  resourceId,
  resourceName,
  onClose,
}: LogicalDbSummaryModalProps) => {
  const { state, retry } = useLogicalDatabases(targetSourceId, resourceId);

  const { included, excluded, reasons } = useMemo(() => {
    if (state.status !== 'ready') {
      return { included: [], excluded: [], reasons: {} as Record<string, SkipReason> };
    }
    const excludedIds = state.initialDraft.excludedIds;
    return {
      included: state.databases.filter((db) => !excludedIds.has(db.id)),
      excluded: state.databases.filter((db) => excludedIds.has(db.id)),
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
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className={cn('text-[12px] leading-[1.5]', textColors.tertiary)}>
            제외 대상을 바꾸려면 <strong className="font-semibold">연결 재확인</strong>으로 5단계에서
            수정해주세요.
          </span>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <h2 className="mb-2 text-[20px] font-bold leading-[1.2] tracking-[-0.02em] text-[#191F28]">
        논리 DB 연동 현황
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
      <p className="mb-3.5 text-[12px] font-medium leading-[1.5] text-[#8B95A1]">
        5단계 연결 테스트가 확인한 결과예요. 제외 대상은 관리자가 설정한 정책이라, 이번 테스트에서
        발견되지 않은 이름이 포함될 수 있어요.
      </p>

      {state.status === 'loading' && <ResourceTableSkeleton />}
      {state.status === 'error' && (
        <div className="space-y-3 py-8 text-center">
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>{state.message}</p>
          <Button variant="secondary" onClick={retry}>
            다시 시도
          </Button>
        </div>
      )}
      {state.status === 'ready' && (
        <div className="grid grid-cols-2 gap-3">
          <Panel
            label="연동 논리 DB"
            items={included}
            emptyMessage="연동 대상 논리 DB가 없어요."
          />
          <Panel
            label="연동 제외 대상"
            items={excluded}
            reasons={reasons}
            emptyMessage="연동 제외 대상이 없어요."
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
}

const Panel = ({ label, items, reasons, emptyMessage }: PanelProps) => (
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
          'rounded-full bg-[#F3F4F6] px-[7px] py-px text-[11px] font-bold tabular-nums',
          textColors.secondary,
        )}
      >
        {items.length}개
      </span>
    </header>
    <div className="flex-1 overflow-y-auto">
      {items.length === 0 ? (
        <p className={cn('px-3 py-12 text-center text-[12.5px]', textColors.quaternary)}>
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
                    'rounded-[5px] bg-[#F1F3F5] px-1.5 py-px text-[10.5px] font-bold',
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
