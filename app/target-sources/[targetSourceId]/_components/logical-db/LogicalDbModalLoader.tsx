'use client';

import { useCallback, useRef, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, statusColors } from '@/lib/theme';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { LogicalDbModal } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModal';
import { useLogicalDatabases } from '@/app/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';
import { draftToExcludedItems } from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-deny';
import { updateExcludedLogicalDatabases } from '@/app/lib/api/logical-db';
import { AppError } from '@/lib/errors';
import type {
  LogicalDatabase,
  LogicalDbModalDraft,
  LogicalDbSaveResult,
} from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';
import type { TcScope } from '@/app/lib/api/tc-scope';

/**
 * What `partial` says above the table: the run's list is missing, the policy is not. Names
 * both halves, because the operator has to know which of the two they are looking at.
 */
const PARTIAL_NOTICE =
  '최근 연결 테스트의 논리 DB 조회가 안 되나, 논리 DB 제외 목록은 편집하고 수정할 수 있어요.';

interface LogicalDbModalLoaderProps {
  open: boolean;
  targetSourceId: number;
  resourceId: string;
  resourceName: string;
  /** Engine badge for the header — 운영자 화면만 넘긴다. 없으면 배지가 없다. */
  databaseType?: string | null;
  /** Completion instant of that run (`latestJob.completed_at`), shown as the header's provenance line. */
  completedAt: string | null;
  /** Which connection-test run the discovered list comes from — Step 5 owns this modal, so `latest`. */
  scope: TcScope;
  /**
   * This caller may add exclusions by hand (운영자 화면). Absent = the requester's screen,
   * which edits only what the connection test discovered.
   */
  manualEntry?: boolean;
  /**
   * Called once the SAVED result frame has been dismissed — the caller refetches then.
   *
   * ⛔ NOT when the PUT lands. A refresh at that moment can replace the card this modal
   * lives in, and the frame the user is meant to read is unmounted before it is seen (the
   * bug `useConfirmSubmit` carries the same warning about). The frame is the hold; this is
   * the settle.
   */
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Wrapper that loads the modal data and owns the save: it holds the adapted
 * `databases` + the target/resource keys, so it serializes the draft to the
 * snake skip-set (full replace) and PUTs it, then reports the outcome back INTO
 * the modal (`saving` / `result`) rather than to a toast behind it. Loading/error
 * states render inside the Modal frame so the open/close transition stays consistent.
 */
export const LogicalDbModalLoader = ({
  open,
  targetSourceId,
  resourceId,
  resourceName,
  databaseType,
  completedAt,
  scope,
  manualEntry,
  onSaved,
  onClose,
}: LogicalDbModalLoaderProps) => {
  const { state, retry } = useLogicalDatabases(targetSourceId, resourceId, scope);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<LogicalDbSaveResult | null>(null);
  /**
   * What 다시 저장하기 re-sends: the draft that just failed, not whatever the table holds now —
   * WITH the rows it was made against. `draftToExcludedItems` drops any id it has no row for,
   * so a hand-typed exclusion would vanish from the body if the fetched list were used here.
   */
  const lastSubmitRef = useRef<{
    draft: LogicalDbModalDraft;
    rows: ReadonlyArray<LogicalDatabase>;
  } | null>(null);

  const submit = useCallback(
    async (draft: LogicalDbModalDraft, rows: ReadonlyArray<LogicalDatabase>) => {
      setSaving(true);
      try {
        const items = draftToExcludedItems(rows, draft);
        // `null` = the PUT landed and only the read-back failed. Two outcomes of ONE write,
        // and only the rejection below means the policy is untouched.
        const refreshed = await updateExcludedLogicalDatabases(targetSourceId, resourceId, items);
        setResult(refreshed === null ? { kind: 'stale' } : { kind: 'success' });
      } catch (err) {
        // The CODE, never the message — the frame picks its copy from it (ADR-008/ADR-013 §D2).
        setResult({ kind: 'error', code: err instanceof AppError ? err.code : 'UNKNOWN' });
      } finally {
        setSaving(false);
      }
    },
    [targetSourceId, resourceId],
  );

  const handleSave = useCallback(
    (draft: LogicalDbModalDraft, rows: ReadonlyArray<LogicalDatabase>) => {
      if (saving) return;
      lastSubmitRef.current = { draft, rows };
      void submit(draft, rows);
    },
    [saving, submit],
  );

  const handleRetry = useCallback(() => {
    const last = lastSubmitRef.current;
    if (saving || !last) return;
    void submit(last.draft, last.rows);
  }, [saving, submit]);

  const handleClose = useCallback(() => {
    // The refetch rides the dismissal, so the table behind is repainted the moment the
    // frame goes — and never while it stands. `stale` counts: the write landed, so the
    // caller's copy is the stale one and the refetch is exactly what it needs.
    const saved = result?.kind === 'success' || result?.kind === 'stale';
    setResult(null);
    onClose();
    if (saved) onSaved();
  }, [result, onClose, onSaved]);

  // `partial` opens the same modal: the tested list is missing, but the skip policy — the
  // thing the PUT replaces — is in hand, so editing and saving are safe. Only `error` (the
  // policy itself unread) keeps the table shut.
  if (state.status === 'ready' || state.status === 'partial') {
    return (
      <LogicalDbModal
        open={open}
        resourceId={resourceId}
        resourceName={resourceName}
        databaseType={databaseType}
        completedAt={completedAt}
        databases={state.databases}
        initialDraft={state.initialDraft}
        notice={state.status === 'partial' ? PARTIAL_NOTICE : undefined}
        manualEntry={manualEntry}
        onSave={handleSave}
        saving={saving}
        result={result}
        onRetry={handleRetry}
        onClose={handleClose}
      />
    );
  }

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      // 준비된 모달과 같은 폭이다 — 스켈레톤 672 에서 표 920 으로 벌어지면, 열릴 때마다
      // 상자가 한 번 튄다. 로딩·오류·준비가 한 폭 안에서 갈아입는다.
      size="wide"
      title={`논리 DB 관리 · ${resourceName}`}
    >
      {state.status === 'loading' ? (
        <ResourceTableSkeleton />
      ) : (
        <div className={cn('space-y-3 py-8 text-center')}>
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>
            {state.message}
          </p>
          <Button variant="secondary" onClick={retry}>
            다시 시도
          </Button>
        </div>
      )}
    </Modal>
  );
};
