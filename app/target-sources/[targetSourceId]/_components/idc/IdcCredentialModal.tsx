'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useToast } from '@/app/components/ui/toast';
import { updateResourceCredential } from '@/app/lib/api';
import {
  bgColors,
  borderColors,
  cn,
  getButtonClass,
  idcStyles,
  statusColors,
  textColors,
} from '@/lib/theme';
import {
  IdcCredSelectCell,
  IdcDbTypeCell,
  IdcEndpointCell,
} from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import type { IdcResourceView } from '@/app/lib/api/idc';

interface IdcCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Live integration targets — every one needs a credential before Run Test. */
  resources: readonly IdcResourceView[];
  /** Target-source secrets from `GET .../secrets` (names), not a hardcoded list. */
  credOptions: readonly string[];
  targetSourceId: number;
  /** Called after every changed credential is persisted, with the full picks. */
  onComplete: (credentials: Record<string, string>) => void;
}

/**
 * IDC Step 5 DB Credential picker. The selects used to live in the resource table; the
 * table now carries the Step-5 logical-DB result instead, so the credential decision
 * moved into its own modal — the same shape the cloud connection test uses
 * (CredentialSetupModal), but over IDC rows so a target reads as its host, not its
 * opaque resource id.
 *
 * Writes happen here (PUT per changed row) and the step is told the result, so a
 * half-saved set can never reach Run Test.
 */
export const IdcCredentialModal = ({
  isOpen,
  onClose,
  resources,
  credOptions,
  targetSourceId,
  onComplete,
}: IdcCredentialModalProps) => {
  const toast = useToast();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Seed from what is already stored on each row. `resources` is memoized by the step, so
  // this does not stamp over the user's picks on an unrelated re-render.
  useEffect(() => {
    if (!isOpen) return;
    setSelections(Object.fromEntries(resources.map((r) => [r.resourceId, r.credentialId ?? ''])));
  }, [isOpen, resources]);

  const selectedCount = resources.filter((r) => !!selections[r.resourceId]).length;
  const allSelected = resources.length > 0 && selectedCount === resources.length;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only the rows whose credential actually changed — re-PUTting an unchanged pick
      // would be a write with nothing to write.
      const changed = resources.filter(
        (r) => selections[r.resourceId] && selections[r.resourceId] !== r.credentialId,
      );
      for (const resource of changed) {
        await updateResourceCredential(targetSourceId, resource.resourceId, selections[resource.resourceId]);
      }
      onComplete(selections);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 설정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DB Credential 설정"
      subtitle="연결 테스트를 실행하려면 모든 연동 대상에 자격 증명이 설정되어 있어야 해요."
      // 2xl, not lg: four columns plus a 190px select overflow the lg frame and clip the
      // select's chevron at the right edge.
      size="2xl"
      footer={
        <>
          <button onClick={onClose} className={getButtonClass('secondary')}>
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!allSelected || saving}
            className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
          >
            {saving && <LoadingSpinner />}
            설정 완료 후 테스트 실행
          </button>
        </>
      }
    >
      <div
        className={cn(
          'mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
          'border',
          allSelected
            ? cn(statusColors.success.bg, statusColors.success.border)
            : cn(borderColors.default, bgColors.muted),
        )}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            allSelected ? statusColors.success.dot : statusColors.pending.dot,
          )}
        />
        <span className={allSelected ? statusColors.success.text : textColors.tertiary}>
          {allSelected
            ? `DB Credential 선택 완료되었습니다 (${resources.length}건)`
            : `아직 DB Credential이 미선택되었습니다 (${selectedCount}/${resources.length})`}
        </span>
      </div>

      <div className={idcStyles.table.frame}>
        <table className="w-full">
          <thead className={idcStyles.table.header}>
            <tr>
              <th className={idcStyles.table.headerCell}>연동 대상</th>
              <th className={cn(idcStyles.table.headerCell, 'w-[72px]')}>Port</th>
              <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Database Type</th>
              <th className={cn(idcStyles.table.headerCell, 'w-[190px]')}>DB Credential</th>
            </tr>
          </thead>
          <tbody className={idcStyles.table.body}>
            {resources.map((resource) => (
              <tr key={resource.resourceId} className={idcStyles.table.row}>
                <td className={idcStyles.table.cell}>
                  <IdcEndpointCell resource={resource} />
                </td>
                <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                  {resource.port || <span className={textColors.tertiary}>—</span>}
                </td>
                <td className={idcStyles.table.cell}>
                  <IdcDbTypeCell resource={resource} />
                </td>
                <td className={idcStyles.table.cell}>
                  <IdcCredSelectCell
                    value={selections[resource.resourceId] ?? ''}
                    onChange={(cred) =>
                      setSelections((prev) => ({ ...prev, [resource.resourceId]: cred }))
                    }
                    options={[...credOptions]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};
