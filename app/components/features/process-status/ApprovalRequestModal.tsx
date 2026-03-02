'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { AthenaRuleBuilder } from '@/app/components/features/process-status/AthenaRuleBuilder';
import type { AthenaSelectionRule } from '@/app/lib/api';
import { cn, statusColors, tableStyles, textColors, getInputClass } from '@/lib/theme';
import type { Resource, IntegrationCategory } from '@/lib/types';

// ===== Types =====

export interface ApprovalRequestFormData {
  exclusion_reason_default?: string;
  athena_rules?: AthenaSelectionRule[];
}

interface ApprovalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ApprovalRequestFormData) => void;
  targetSourceId: number;
  resources: Resource[];
  athenaRules?: AthenaSelectionRule[];
  onAthenaRulesChange?: (rules: AthenaSelectionRule[]) => void;
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

const isAthenaResource = (resource: Resource): boolean =>
  resource.awsType === 'ATHENA' ||
  resource.type === 'ATHENA' ||
  resource.type === 'ATHENA_REGION' ||
  resource.databaseType === 'ATHENA';

const parseAthenaResourceId = (
  resourceId: string,
): { accountId: string; region: string; database?: string; table?: string } | null => {
  const matched = /^athena:([^/]+)\/([^/]+)(?:\/([^/]+)(?:\/([^/]+))?)?$/.exec(resourceId);
  if (!matched) return null;
  return {
    accountId: matched[1],
    region: matched[2],
    database: matched[3],
    table: matched[4],
  };
};

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
  targetSourceId,
  resources,
  athenaRules: controlledAthenaRules,
  onAthenaRulesChange,
  loading,
  error,
}: ApprovalRequestModalProps) => {
  const [defaultReason, setDefaultReason] = useState('');

  const includedResources = useMemo(
    () => resources.filter((r) => !isAthenaResource(r) && r.isSelected),
    [resources],
  );

  const excludedResources = useMemo(
    () => resources.filter((r) => !isAthenaResource(r) && !r.isSelected),
    [resources],
  );

  const hasExcluded = excludedResources.length > 0;

  const athenaRegions = useMemo(() => {
    const grouped = new Map<string, { resource_id: string; athena_region: string; total_table_count: number }>();
    for (const resource of resources) {
      if (!isAthenaResource(resource)) continue;
      const parsed = parseAthenaResourceId(resource.resourceId);
      if (!parsed) continue;
      const regionResourceId = `athena:${parsed.accountId}/${parsed.region}`;
      const current = grouped.get(regionResourceId);
      if (current) {
        if (parsed.database && parsed.table) {
          current.total_table_count += 1;
        }
        continue;
      }
      grouped.set(regionResourceId, {
        resource_id: regionResourceId,
        athena_region: parsed.region,
        total_table_count: parsed.database && parsed.table ? 1 : 0,
      });
    }
    return Array.from(grouped.values()).sort((a, b) => a.athena_region.localeCompare(b.athena_region));
  }, [resources]);

  const initialAthenaRules = useMemo(() => {
    const selectedRules: AthenaSelectionRule[] = [];
    for (const resource of resources) {
      if (!isAthenaResource(resource) || !resource.isSelected) continue;
      const parsed = parseAthenaResourceId(resource.resourceId);
      if (!parsed) continue;
      if (parsed.database && parsed.table) {
        selectedRules.push({
          scope: 'TABLE',
          resource_id: resource.resourceId,
          selected: true,
        });
        continue;
      }
      if (parsed.region && !parsed.database) {
        selectedRules.push({
          scope: 'REGION',
          resource_id: resource.resourceId,
          selected: true,
          include_all_tables: false,
        });
      }
    }
    return selectedRules;
  }, [resources]);

  const [internalAthenaRules, setInternalAthenaRules] = useState<AthenaSelectionRule[]>(initialAthenaRules);
  const currentAthenaRules = controlledAthenaRules ?? internalAthenaRules;
  const setCurrentAthenaRules = onAthenaRulesChange ?? setInternalAthenaRules;

  const hasSelectedAthena = useMemo(
    () => currentAthenaRules.some((rule) =>
      rule.scope === 'TABLE'
        ? rule.selected
        : rule.selected && rule.include_all_tables === true
    ),
    [currentAthenaRules],
  );

  // Validation: TARGET excluded resources must have individual or default reason
  const canSubmit = useMemo(() => {
    if (includedResources.length === 0 && !hasSelectedAthena) return false;
    if (loading) return false;

    const hasTargetExcluded = excludedResources.some((r) => isReasonRequired(r.integrationCategory));
    if (!hasTargetExcluded) return true;

    return defaultReason.trim().length > 0;
  }, [includedResources, excludedResources, defaultReason, hasSelectedAthena, loading]);

  const handleSubmit = () => {
    const rules = currentAthenaRules.filter((rule) =>
      rule.scope === 'TABLE' ||
      (rule.selected && rule.include_all_tables === true)
    );
    onSubmit({
      exclusion_reason_default: defaultReason.trim() || undefined,
      athena_rules: rules.length > 0 ? rules : undefined,
    });
  };

  const handleClose = () => {
    if (loading) return;
    setDefaultReason('');
    if (!onAthenaRulesChange) {
      setInternalAthenaRules(initialAthenaRules);
    }
    onClose();
  };

  const subtitle = `포함 ${includedResources.length + (hasSelectedAthena ? 1 : 0)}건${hasExcluded ? `, 제외 ${excludedResources.length}건` : ''}`;

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
        {includedResources.length === 0 && !hasSelectedAthena && (
          <div className={cn('p-3 rounded-lg border', statusColors.warning.bg, statusColors.warning.border)}>
            <p className={cn('text-sm', statusColors.warning.textDark)}>
              포함할 리소스(일반 리소스 또는 Athena 선택 규칙)를 1개 이상 선택하세요
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

        {athenaRegions.length > 0 && (
          <div>
            <h3 className={cn('text-sm font-semibold mb-2', textColors.primary)}>
              Athena 선택 ({athenaRegions.length}개 Region)
            </h3>
            <div className="border border-gray-200 rounded-lg p-3">
              <AthenaRuleBuilder
                targetSourceId={targetSourceId}
                regions={athenaRegions}
                rules={currentAthenaRules}
                onChange={setCurrentAthenaRules}
              />
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
                  </tr>
                </thead>
                <tbody className={tableStyles.body}>
                  {excludedResources.map((r) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Default exclusion reason */}
            <div className="mt-4">
              <label className={cn('block text-sm font-medium mb-1.5', textColors.secondary)}>
                제외 사유
              </label>
              <textarea
                value={defaultReason}
                onChange={(e) => setDefaultReason(e.target.value)}
                placeholder="제외 사유를 입력하세요"
                rows={2}
                className={cn(getInputClass(), 'resize-none')}
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
