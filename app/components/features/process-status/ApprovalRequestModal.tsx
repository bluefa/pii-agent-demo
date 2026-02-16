'use client';

import { useState, useMemo } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { cn, statusColors, tableStyles, textColors } from '@/lib/theme';
import type { Resource, IntegrationCategory } from '@/lib/types';

// ===== Types =====

export interface ApprovalRequestFormData {
  resource_inputs: ResourceInput[];
  exclusion_reason_default?: string;
}

interface ResourceInput {
  resource_id: string;
  selected: boolean;
  exclusion_reason?: string;
}

interface ApprovalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ApprovalRequestFormData) => void;
  resources: Resource[];
  loading: boolean;
  error?: string | null;
}

// ===== Helpers =====

const getCategoryLabel = (category: IntegrationCategory): string => {
  switch (category) {
    case 'TARGET': return '연동 대상';
    case 'NO_INSTALL_NEEDED': return '설치 불필요';
    case 'INSTALL_INELIGIBLE': return '연동 불가';
  }
};

const getCategoryBadgeClass = (category: IntegrationCategory): string => {
  switch (category) {
    case 'TARGET': return cn('text-xs px-2 py-0.5 rounded-full', statusColors.info.bg, statusColors.info.textDark);
    case 'NO_INSTALL_NEEDED': return cn('text-xs px-2 py-0.5 rounded-full', statusColors.pending.bg, statusColors.pending.textDark);
    case 'INSTALL_INELIGIBLE': return cn('text-xs px-2 py-0.5 rounded-full', statusColors.error.bg, statusColors.error.textDark);
  }
};

const isReasonRequired = (category: IntegrationCategory): boolean =>
  category === 'TARGET';

const isReasonOptional = (category: IntegrationCategory): boolean =>
  category === 'NO_INSTALL_NEEDED';

const isAutoExcluded = (category: IntegrationCategory): boolean =>
  category === 'INSTALL_INELIGIBLE';

const getEndpointSummary = (resource: Resource): string => {
  if (resource.vmDatabaseConfig) {
    const { host, port, databaseType } = resource.vmDatabaseConfig;
    return `${databaseType} ${host ?? ''}:${port}`;
  }
  return '-';
};

// ===== Component =====

export const ApprovalRequestModal = ({
  isOpen,
  onClose,
  onSubmit,
  resources,
  loading,
  error,
}: ApprovalRequestModalProps) => {
  const [exclusionReasons, setExclusionReasons] = useState<Record<string, string>>({});
  const [defaultReason, setDefaultReason] = useState('');

  const includedResources = useMemo(
    () => resources.filter((r) => r.isSelected),
    [resources],
  );

  const excludedResources = useMemo(
    () => resources.filter((r) => !r.isSelected),
    [resources],
  );

  const hasExcluded = excludedResources.length > 0;

  // Validation: TARGET excluded resources must have individual or default reason
  const canSubmit = useMemo(() => {
    if (includedResources.length === 0) return false;
    if (loading) return false;

    const targetExcluded = excludedResources.filter((r) => isReasonRequired(r.integrationCategory));
    if (targetExcluded.length === 0) return true;

    // Every TARGET excluded must have individual reason OR default reason must be filled
    const allHaveReason = targetExcluded.every(
      (r) => (exclusionReasons[r.id] ?? '').trim().length > 0,
    );
    if (allHaveReason) return true;

    return defaultReason.trim().length > 0;
  }, [includedResources, excludedResources, exclusionReasons, defaultReason, loading]);

  const handleReasonChange = (resourceId: string, reason: string) => {
    setExclusionReasons((prev) => ({ ...prev, [resourceId]: reason }));
  };

  const handleSubmit = () => {
    const resourceInputs: ResourceInput[] = resources.map((r) => {
      if (r.isSelected) {
        return { resource_id: r.id, selected: true };
      }
      return {
        resource_id: r.id,
        selected: false,
        exclusion_reason: (exclusionReasons[r.id] ?? '').trim() || undefined,
      };
    });

    onSubmit({
      resource_inputs: resourceInputs,
      exclusion_reason_default: defaultReason.trim() || undefined,
    });
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const subtitle = `포함 ${includedResources.length}건${hasExcluded ? `, 제외 ${excludedResources.length}건` : ''}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="승인 요청"
      subtitle={subtitle}
      size="2xl"
      closeOnBackdropClick={!loading}
      closeOnEscape={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading && <LoadingSpinner size="sm" />}
            승인 요청
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] overflow-y-auto space-y-6">
        {/* No included resources warning */}
        {includedResources.length === 0 && (
          <div className={cn('p-3 rounded-lg border', statusColors.warning.bg, statusColors.warning.border)}>
            <p className={cn('text-sm', statusColors.warning.textDark)}>
              포함할 리소스를 1개 이상 선택하세요
            </p>
          </div>
        )}

        {/* Included Resources Section */}
        {includedResources.length > 0 && (
          <div>
            <h3 className={cn('text-sm font-semibold mb-2', textColors.primary)}>
              포함 리소스 ({includedResources.length}건)
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableStyles.header}>
                    <th className={tableStyles.headerCell}>리소스 ID</th>
                    <th className={tableStyles.headerCell}>타입</th>
                    <th className={tableStyles.headerCell}>엔드포인트</th>
                  </tr>
                </thead>
                <tbody className={tableStyles.body}>
                  {includedResources.map((r) => (
                    <tr key={r.id} className={tableStyles.row}>
                      <td className={cn(tableStyles.cell, textColors.primary, 'font-mono text-xs')}>
                        {r.resourceId}
                      </td>
                      <td className={cn(tableStyles.cell, textColors.secondary)}>
                        {r.type}
                      </td>
                      <td className={cn(tableStyles.cell, textColors.tertiary)}>
                        {getEndpointSummary(r)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Excluded Resources Section */}
        {hasExcluded && (
          <div>
            <h3 className={cn('text-sm font-semibold mb-2', textColors.primary)}>
              제외 리소스 ({excludedResources.length}건)
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableStyles.header}>
                    <th className={tableStyles.headerCell}>리소스 ID</th>
                    <th className={tableStyles.headerCell}>타입</th>
                    <th className={tableStyles.headerCell}>분류</th>
                    <th className={cn(tableStyles.headerCell, 'w-1/3')}>제외 사유</th>
                  </tr>
                </thead>
                <tbody className={tableStyles.body}>
                  {excludedResources.map((r) => {
                    const required = isReasonRequired(r.integrationCategory);
                    const optional = isReasonOptional(r.integrationCategory);
                    const autoEx = isAutoExcluded(r.integrationCategory);
                    const individualReason = (exclusionReasons[r.id] ?? '').trim();
                    const showDefaultPlaceholder = required && !individualReason && defaultReason.trim();

                    return (
                      <tr key={r.id} className={tableStyles.row}>
                        <td className={cn(tableStyles.cell, textColors.primary, 'font-mono text-xs')}>
                          {r.resourceId}
                        </td>
                        <td className={cn(tableStyles.cell, textColors.secondary)}>
                          {r.type}
                        </td>
                        <td className={tableStyles.cell}>
                          <span className={getCategoryBadgeClass(r.integrationCategory)}>
                            {getCategoryLabel(r.integrationCategory)}
                          </span>
                        </td>
                        <td className={tableStyles.cell}>
                          {autoEx ? (
                            <span className={textColors.quaternary}>자동 제외</span>
                          ) : (
                            <textarea
                              value={exclusionReasons[r.id] ?? ''}
                              onChange={(e) => handleReasonChange(r.id, e.target.value)}
                              placeholder={
                                showDefaultPlaceholder
                                  ? '(기본 사유 적용)'
                                  : required
                                    ? '제외 사유 입력 (필수)'
                                    : '제외 사유 입력 (선택)'
                              }
                              rows={2}
                              className={cn(
                                'w-full px-2 py-1.5 text-xs border rounded-md resize-none',
                                'border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                                textColors.primary,
                              )}
                            />
                          )}
                          {required && !optional && !autoEx && (
                            <span className={cn('text-xs mt-0.5 block', statusColors.error.text)}>
                              * 필수
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Default exclusion reason */}
            <div className="mt-4">
              <label className={cn('block text-sm font-medium mb-1.5', textColors.secondary)}>
                기본 제외 사유
              </label>
              <p className={cn('text-xs mb-2', textColors.tertiary)}>
                개별 사유 미입력 시 적용됩니다
              </p>
              <textarea
                value={defaultReason}
                onChange={(e) => setDefaultReason(e.target.value)}
                placeholder="기본 제외 사유를 입력하세요"
                rows={2}
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-lg resize-none',
                  'border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  textColors.primary,
                )}
              />
            </div>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div className={cn('p-3 rounded-lg border', statusColors.error.bg, statusColors.error.border)}>
            <p className={cn('text-sm', statusColors.error.textDark)}>{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
