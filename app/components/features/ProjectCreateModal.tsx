'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { createProject } from '@/app/lib/api';
import {
  cn,
  modalStyles,
  textColors,
  bgColors,
  borderColors,
  statusColors,
  interactiveColors,
} from '@/lib/theme';
import type { DbType } from '@/lib/constants/db-types';
import {
  PROVIDER_CHIP_BY_KEY,
  getProviderChipDisplayLabel,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';
import {
  DbTypeMultiSelect,
  ProviderChipGrid,
  ProviderCredentialForm,
  StagedInfraTable,
  validateCredentials,
  type StagedInfra,
} from './project-create';

interface ProjectCreateModalProps {
  selectedServiceCode: string;
  serviceName: string;
  onClose: () => void;
  onCreated: () => void;
}

const makeTempId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toCreateDto = (
  infra: StagedInfra,
  serviceCode: string,
): Parameters<typeof createProject>[0] => {
  const base = {
    serviceCode,
    cloudProvider: infra.cloudProvider,
  } as Parameters<typeof createProject>[0];

  if (infra.cloudProvider === 'AWS') {
    return {
      ...base,
      awsAccountId: infra.credentials.payerAccount,
      awsRegionType: infra.awsRegionType,
    };
  }
  if (infra.cloudProvider === 'Azure') {
    return {
      ...base,
      tenantId: infra.credentials.tenantId,
      subscriptionId: infra.credentials.subscriptionId,
    };
  }
  if (infra.cloudProvider === 'GCP') {
    return {
      ...base,
      gcpProjectId: infra.credentials.projectId,
    };
  }
  return base;
};

export const ProjectCreateModal = ({
  selectedServiceCode,
  serviceName,
  onClose,
  onCreated,
}: ProjectCreateModalProps) => {
  const [currentChip, setCurrentChip] = useState<ProviderChipKey>('aws-global');
  const [currentFields, setCurrentFields] = useState<Record<string, string>>({});
  const [currentDbTypes, setCurrentDbTypes] = useState<DbType[]>([]);
  const [staged, setStaged] = useState<StagedInfra[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeChip = PROVIDER_CHIP_BY_KEY[currentChip];

  const resetInputs = () => {
    setCurrentFields({});
    setCurrentDbTypes([]);
    setAddError(null);
  };

  const handleChipChange = (key: ProviderChipKey) => {
    setCurrentChip(key);
    resetInputs();
  };

  const handleAddToList = () => {
    if (!activeChip.enabled || !activeChip.cloudProvider || !activeChip.communicationModule) {
      setAddError('활성화된 Provider를 선택하세요');
      return;
    }
    const validationError = validateCredentials(currentChip, currentFields);
    if (validationError) {
      setAddError(validationError);
      return;
    }
    if (currentDbTypes.length === 0) {
      setAddError('DB Type을 1개 이상 선택하세요');
      return;
    }

    const item: StagedInfra = {
      tempId: makeTempId(),
      chipKey: currentChip,
      providerLabel: getProviderChipDisplayLabel(activeChip),
      cloudProvider: activeChip.cloudProvider,
      awsRegionType: activeChip.awsRegionType,
      credentials: { ...currentFields },
      dbTypes: [...currentDbTypes],
      communicationModule: activeChip.communicationModule,
    };
    setStaged((prev) => [...prev, item]);
    resetInputs();
  };

  const handleRemove = (tempId: string) => {
    setStaged((prev) => prev.filter((x) => x.tempId !== tempId));
  };

  const handleSave = async () => {
    if (staged.length === 0 || saving) return;
    setSaving(true);

    const results = await Promise.allSettled(
      staged.map((infra) => createProject(toCreateDto(infra, selectedServiceCode))),
    );

    const failed: StagedInfra[] = [];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const reason = result.reason;
        const message = reason instanceof Error ? reason.message : '알 수 없는 오류';
        failed.push({ ...staged[idx], error: message });
      }
    });

    setSaving(false);

    if (failed.length === 0) {
      onCreated();
      onClose();
      return;
    }

    setStaged(failed);
    onCreated();
  };

  const canAdd =
    activeChip.enabled &&
    Object.values(currentFields).some((v) => v.trim().length > 0) &&
    currentDbTypes.length > 0;

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        className={cn(modalStyles.container, 'w-[840px] max-h-[90vh] flex flex-col shadow-2xl')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={modalStyles.header}>
          <div>
            <h2 className={cn('text-lg font-bold', textColors.primary)}>인프라 등록</h2>
            <p className={cn('mt-0.5 text-sm', textColors.tertiary)}>
              PII 모니터링 모듈 연동이 필요한 운영계 인프라 정보를 입력해주세요. 각 인프라 Provider/DB Type을 기준으로 Agent/SDU를 자동 할당합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className={cn('p-2 rounded-lg transition-colors', interactiveColors.closeButton)}
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* 서비스 코드 (읽기 전용) */}
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg border',
              borderColors.default,
              bgColors.muted,
            )}
          >
            <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', bgColors.primary)}>
              <span className={cn('text-xs font-bold', textColors.inverse)}>
                {selectedServiceCode.charAt(0)}
              </span>
            </div>
            <div>
              <div className={cn('font-medium', textColors.primary)}>{selectedServiceCode}</div>
              <div className={cn('text-sm', textColors.tertiary)}>{serviceName}</div>
            </div>
          </div>

          {/* 1. Provider 선택 */}
          <section>
            <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
              <span className={cn('mr-1.5 text-xs', textColors.tertiary)}>1</span>
              인프라 (Provider) 유형 선택
            </h3>
            <ProviderChipGrid value={currentChip} onChange={handleChipChange} />
          </section>

          {/* 2/3 Credentials + DB Type */}
          <div className="grid grid-cols-2 gap-5">
            <section>
              <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
                <span className={cn('mr-1.5 text-xs', textColors.tertiary)}>2</span>
                인프라 정보
              </h3>
              {activeChip.enabled ? (
                <ProviderCredentialForm
                  chipKey={currentChip}
                  values={currentFields}
                  onChange={setCurrentFields}
                />
              ) : (
                <p className={cn('text-sm', textColors.tertiary)}>
                  해당 Provider는 추후 지원 예정입니다.
                </p>
              )}
            </section>
            <section>
              <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
                <span className={cn('mr-1.5 text-xs', textColors.tertiary)}>3</span>
                DB Type 선택
              </h3>
              <DbTypeMultiSelect values={currentDbTypes} onChange={setCurrentDbTypes} />
            </section>
          </div>

          {addError && (
            <p className={cn('text-sm', statusColors.error.text)}>{addError}</p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddToList}
              disabled={!canAdd}
            >
              + Add to List
            </Button>
          </div>

          {/* 4. Staged list */}
          <section>
            <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
              인프라 등록 List
            </h3>
            <StagedInfraTable items={staged} onRemove={handleRemove} />
          </section>
        </div>

        {/* Footer */}
        <div className={modalStyles.footer}>
          <Button variant="secondary" onClick={onClose} type="button">
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || staged.length === 0}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                저장 중...
              </span>
            ) : (
              `Save${staged.length > 0 ? ` (${staged.length})` : ''}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
