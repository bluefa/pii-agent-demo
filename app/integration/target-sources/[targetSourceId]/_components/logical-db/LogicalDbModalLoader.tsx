'use client';

import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, statusColors, textColors } from '@/lib/theme';
import { LogicalDbModal } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModal';
import { useLogicalDatabases } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';
import type { LogicalDbModalDraft } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

interface LogicalDbModalLoaderProps {
  open: boolean;
  resourceId: string;
  resourceName: string;
  onSave: (draft: LogicalDbModalDraft) => void;
  onClose: () => void;
}

/**
 * Thin wrapper that calls the data hook and feeds the result into
 * LogicalDbModal. Loading and error states are rendered as the Modal
 * frame so the open/close transition stays consistent.
 */
export const LogicalDbModalLoader = ({
  open,
  resourceId,
  resourceName,
  onSave,
  onClose,
}: LogicalDbModalLoaderProps) => {
  const { state, retry } = useLogicalDatabases(resourceId);

  if (state.status === 'ready') {
    return (
      <LogicalDbModal
        open={open}
        resourceName={resourceName}
        databases={state.databases}
        onSave={onSave}
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
