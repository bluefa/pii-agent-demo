'use client';

import { useCallback, useState } from 'react';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, statusColors, textColors } from '@/lib/theme';
import { LogicalDbModal } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModal';
import { useLogicalDatabases } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';
import { draftToExcludedItems } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-deny';
import { updateExcludedLogicalDatabases } from '@/app/lib/api/logical-db';
import type { LogicalDatabase, LogicalDbModalDraft } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

interface LogicalDbModalLoaderProps {
  open: boolean;
  targetSourceId: number;
  resourceId: string;
  resourceName: string;
  /** Called after the skip policy is persisted (success toast + refetch + close). */
  onSaved: () => void;
  /** Called when the PUT fails (failure toast). */
  onError: () => void;
  onClose: () => void;
}

/**
 * Wrapper that loads the modal data and owns the save: it holds the adapted
 * `databases` + the target/resource keys, so it serializes the draft to the
 * snake skip-set (full replace) and PUTs it, then hands control back to the
 * parent via `onSaved`/`onError`. Loading/error states render inside the Modal
 * frame so the open/close transition stays consistent.
 */
export const LogicalDbModalLoader = ({
  open,
  targetSourceId,
  resourceId,
  resourceName,
  onSaved,
  onError,
  onClose,
}: LogicalDbModalLoaderProps) => {
  const { state, retry } = useLogicalDatabases(targetSourceId, resourceId);
  const [saving, setSaving] = useState(false);

  const databases: LogicalDatabase[] =
    state.status === 'ready' ? state.databases : [];

  const handleSave = useCallback(
    async (draft: LogicalDbModalDraft) => {
      if (saving) return;
      setSaving(true);
      try {
        const items = draftToExcludedItems(databases, draft);
        await updateExcludedLogicalDatabases(targetSourceId, resourceId, items);
        onSaved();
      } catch {
        onError();
      } finally {
        setSaving(false);
      }
    },
    [saving, databases, targetSourceId, resourceId, onSaved, onError],
  );

  if (state.status === 'ready') {
    return (
      <LogicalDbModal
        open={open}
        resourceName={resourceName}
        databases={state.databases}
        initialDraft={state.initialDraft}
        onSave={handleSave}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="2xl"
      title={`논리 DB 확인 · ${resourceName}`}
    >
      {state.status === 'loading' ? (
        <div className="flex items-center justify-center gap-2 py-12">
          <LoadingSpinner />
          <span className={cn('text-sm', textColors.tertiary)}>
            불러오는 중...
          </span>
        </div>
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
