'use client';

import { useState, useEffect } from 'react';
import type { SecretKey } from '@/lib/types';
import type { ConfirmedResource } from '@/lib/types/resources';
import { updateResourceCredential } from '@/app/lib/api';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Modal } from '@/app/components/ui/Modal';
import { useToast } from '@/app/components/ui/toast';
import { statusColors, primaryColors, textColors, getButtonClass, cn } from '@/lib/theme';
import { getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';

interface CredentialSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingResources: readonly ConfirmedResource[];
  credentials: SecretKey[];
  targetSourceId: number;
  onComplete: () => void;
  reviewMode?: boolean;
}

export const CredentialSetupModal = ({
  isOpen,
  onClose,
  missingResources,
  credentials,
  targetSourceId,
  onComplete,
  reviewMode = false,
}: CredentialSetupModalProps) => {
  const toast = useToast();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // reviewMode: 기존 credential 값으로 초기화
  useEffect(() => {
    if (!isOpen) return;
    if (reviewMode) {
      const initial: Record<string, string> = {};
      missingResources.forEach((r) => {
        if (r.credentialId) initial[r.resourceId] = r.credentialId;
      });
      setSelections(initial);
    } else {
      setSelections({});
    }
  }, [isOpen, reviewMode, missingResources]);

  const allSelected = missingResources.every((r) => selections[r.resourceId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      for (const resource of missingResources) {
        const credentialId = selections[resource.resourceId];
        if (credentialId) {
          await updateResourceCredential(targetSourceId, resource.resourceId, credentialId);
        }
      }
      onComplete();
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
      title={reviewMode ? 'DB Credential 확인' : 'Credential 설정 필요'}
      subtitle={reviewMode
        ? '마지막 Test Connection이 실패하였습니다. DB Credential을 변경할 부분이 있는지 확인 부탁드리겠습니다.'
        : '연결 테스트를 실행하려면 아래 리소스에 Credential을 설정해주세요.'}
      size="lg"
      icon={
        reviewMode ? (
          <svg className={cn('w-5 h-5', statusColors.warning.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : (
          <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        )
      }
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
            {reviewMode ? '테스트 실행' : '설정 완료 후 테스트 실행'}
          </button>
        </>
      }
    >
      {/* 상태 요약 메시지 */}
      <div className={cn(
        'mb-4 px-3 py-2 rounded-lg text-sm flex items-center gap-2',
        allSelected
          ? cn(statusColors.success.bg, 'border', statusColors.success.border)
          : 'bg-gray-50 border border-gray-200',
      )}>
        <span className={cn(
          'w-2 h-2 rounded-full',
          allSelected ? statusColors.success.dot : 'bg-gray-300',
        )} />
        <span className={allSelected ? statusColors.success.text : textColors.quaternary}>
          {allSelected
            ? `DB Credential 선택 완료되었습니다 (${missingResources.length}건)`
            : `아직 DB Credential이 미선택되었습니다 (${Object.keys(selections).filter((k) => selections[k]).length}/${missingResources.length})`}
        </span>
      </div>

      {/* 리소스 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className={cn('px-4 py-2 text-left text-xs font-medium', textColors.tertiary)}>리소스</th>
              <th className={cn('px-4 py-2 text-left text-xs font-medium', textColors.tertiary)}>DB 유형</th>
              <th className={cn('px-4 py-2 text-left text-xs font-medium', textColors.tertiary)}>Credential</th>
              <th className={cn('px-4 py-2 text-center text-xs font-medium w-20', textColors.tertiary)}>상태</th>
            </tr>
          </thead>
          <tbody>
            {missingResources.map((resource) => {
              const isSelected = !!selections[resource.resourceId];
              return (
                <tr key={resource.resourceId} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium uppercase', textColors.quaternary)}>{resource.type}</span>
                      <span className={cn('text-sm font-mono truncate', textColors.secondary)}>{resource.resourceId}</span>
                    </div>
                  </td>
                  <td className={cn('px-4 py-3 text-sm', textColors.secondary)}>
                    {resource.databaseType ? getDatabaseLabel(resource.databaseType) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selections[resource.resourceId] || ''}
                      onChange={(e) =>
                        setSelections((prev) => ({ ...prev, [resource.resourceId]: e.target.value }))
                      }
                      className={cn(
                        'w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2',
                        primaryColors.focusRing,
                        isSelected
                          ? cn(statusColors.success.border, statusColors.success.bg, textColors.primary)
                          : cn(statusColors.pending.border, textColors.primary),
                      )}
                    >
                      <option value="">선택하세요</option>
                      {credentials.map((cred) => (
                        <option key={cred.name} value={cred.name}>
                          {cred.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSelected ? (
                      <span className={cn('text-xs font-medium', statusColors.success.text)}>선택 완료</span>
                    ) : (
                      <span className={cn('text-xs', textColors.quaternary)}>미선택</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};
