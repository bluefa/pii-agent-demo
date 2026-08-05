'use client';

/**
 * 설치 모드 변경 modal (Figma 51:5) — radio-card pair. auto ↔
 * grant_service_terraform_execution_permission (assumed contract §2).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { updateInstallationMode } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-install-mode-title';

const OPTIONS = [
  { grant: true, title: '자동 설치', desc: 'Agent를 자동으로 설치하고 구성합니다. Terraform 실행 권한을 위임합니다.' },
  { grant: false, title: '수동 설치', desc: '직접 Agent를 설치하고 구성합니다. 설치 스크립트를 직접 실행합니다.' },
] as const;

export interface InstallModeModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  currentGrant: boolean;
  onSaved: (grant: boolean) => void;
}

export function InstallModeModal({
  open,
  onClose,
  targetSourceId,
  currentGrant,
  onSaved,
}: InstallModeModalProps): ReactElement | null {
  const [selected, setSelected] = useState(currentGrant);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(currentGrant);
      setError(null);
    }
  }, [open, currentGrant]);

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateInstallationMode(targetSourceId, selected);
      onSaved(result.grant_service_terraform_execution_permission);
      onClose();
    } catch {
      setError('변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>설치 모드 변경</h3>
      <div role="radiogroup" aria-labelledby={TITLE_ID} className="mt-4 flex flex-col gap-3">
        {OPTIONS.map((option) => {
          const active = selected === option.grant;
          return (
            <button
              key={option.title}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(option.grant)}
              className={cn(
                'flex items-start gap-3 rounded-lg p-4 text-left transition-colors',
                active
                  ? 'border-[1.5px] border-[var(--pl-primary)] bg-[var(--pl-primary-bg)]'
                  : 'border border-[var(--pl-border)] bg-[var(--pl-bg-card)] hover:bg-[var(--pl-gray-50)]',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2',
                  active ? 'border-[var(--pl-primary)]' : 'border-[var(--pl-gray-300)]',
                )}
              >
                {active && <span className="h-2 w-2 rounded-full bg-[var(--pl-primary)]" />}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[16px] font-semibold text-[var(--pl-text-strong)]">{option.title}</span>
                <span className="text-[14px] leading-[1.4] text-[var(--pl-text-weak)]">{option.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[12px] font-medium text-[var(--pl-err-text)]">
          {error}
        </p>
      )}
      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={saving}>
          취소
        </PlButton>
        <PlButton
          variant="primary"
          onClick={() => void save()}
          disabled={saving || selected === currentGrant}
        >
          {saving ? '변경 중…' : '변경'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
