'use client';

/**
 * Credential 변경 modal — PUT …/resources/credential for one confirmed resource.
 *
 * Free-text id entry: no GET contract for a credential list exists in
 * install-v1.yaml, so there is nothing to populate a picker with (a list endpoint
 * is NOT invented here). `credentialId: string | null` in the contract means an
 * empty input is a real "unassign", which the helper text states.
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { updateResourceCredential } from '@/app/lib/api';

const TITLE_ID = 'ops-credential-title';
const INPUT_ID = 'ops-credential-input';

export interface CredentialModalProps {
  targetSourceId: number;
  resourceId: string;
  /** Current credential id — empty when unassigned. */
  currentCredentialId: string | null;
  onClose: () => void;
  /** Fired after a successful PUT so the caller can refetch 확정 정보. */
  onSaved: () => void;
}

export function CredentialModal({
  targetSourceId,
  resourceId,
  currentCredentialId,
  onClose,
  onSaved,
}: CredentialModalProps): ReactElement {
  const [value, setValue] = useState(currentCredentialId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const unchanged = trimmed === (currentCredentialId ?? '');

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await updateResourceCredential(targetSourceId, resourceId, trimmed || null);
      onSaved();
      onClose();
    } catch {
      setError('Credential 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        Credential 변경
      </h3>
      <p className={pipelineStyles.modal.desc}>
        이 리소스에 연결된 DB Credential을 변경합니다.
      </p>
      <div className="mb-3 flex items-center gap-2 text-[12px]">
        <span className="text-[var(--pl-text-faint)]">Resource ID</span>
        <span className={cn(pipelineStyles.text.mono, 'break-all')}>{resourceId}</span>
      </div>

      <label htmlFor={INPUT_ID} className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
        Credential ID
      </label>
      <input
        id={INPUT_ID}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        placeholder="credential-id"
        autoComplete="off"
        spellCheck={false}
        aria-describedby="ops-credential-helper"
        className={cn(pipelineStyles.input, 'mt-2 w-full [font-family:var(--pl-font-mono)]')}
      />
      <p id="ops-credential-helper" className={cn(pipelineStyles.text.meta, 'mt-1')}>
        비우고 저장하면 Credential 연결을 해제합니다.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[var(--pl-err-text)]">
          {error}
        </p>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={saving}>
          취소
        </PlButton>
        <PlButton variant="primary" onClick={() => void save()} disabled={saving || unchanged}>
          {saving ? '저장 중…' : '저장'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
