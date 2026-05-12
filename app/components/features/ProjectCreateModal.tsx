'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useToast } from '@/app/components/ui/toast';
import {
  createProject,
  previewTargetSourceRegistration,
  type RegistrationPreviewItem,
  type RegistrationPreviewRequest,
} from '@/app/lib/api';
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
} from '@/app/components/features/project-create';
import {
  RegistrationPreviewCardList,
  type PreviewRow,
} from '@/app/components/features/admin/v7';

interface ProjectCreateModalProps {
  selectedServiceCode: string;
  serviceName: string;
  onClose: () => void;
  onCreated: () => void;
}

type Phase = 'input' | 'preview' | 'submitting';

const makeTempId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toPreviewRequest = (infra: StagedInfra): RegistrationPreviewRequest => {
  if (infra.cloudProvider === 'AWS') {
    return {
      cloudProvider: 'AWS',
      awsAccountId: infra.credentials.payerAccount,
      ...(infra.credentials.linkedAccount
        ? { awsLinkedAccountId: infra.credentials.linkedAccount }
        : {}),
      isChinaRegion: infra.awsRegionType === 'china',
      dbTypes: infra.dbTypes,
    };
  }
  if (infra.cloudProvider === 'Azure') {
    return {
      cloudProvider: 'Azure',
      tenantId: infra.credentials.tenantId,
      subscriptionId: infra.credentials.subscriptionId,
      dbTypes: infra.dbTypes,
    };
  }
  return {
    cloudProvider: 'GCP',
    gcpProjectId: infra.credentials.projectId,
    dbTypes: infra.dbTypes,
  };
};

const toCreateDto = (
  infra: StagedInfra,
  dbType: DbType,
  serviceCode: string,
): Parameters<typeof createProject>[0] => {
  const base = { serviceCode, cloudProvider: infra.cloudProvider, dbType };
  if (infra.cloudProvider === 'AWS') {
    return {
      ...base,
      awsAccountId: infra.credentials.payerAccount,
      ...(infra.credentials.linkedAccount
        ? { awsLinkedAccountId: infra.credentials.linkedAccount }
        : {}),
      awsRegionType: infra.awsRegionType,
      isChinaRegion: infra.awsRegionType === 'china',
    };
  }
  if (infra.cloudProvider === 'Azure') {
    return {
      ...base,
      tenantId: infra.credentials.tenantId,
      subscriptionId: infra.credentials.subscriptionId,
    };
  }
  return {
    ...base,
    gcpProjectId: infra.credentials.projectId,
  };
};

interface PendingPreviewRow extends PreviewRow {
  stagedTempId: string;
}

export const ProjectCreateModal = ({
  selectedServiceCode,
  serviceName,
  onClose,
  onCreated,
}: ProjectCreateModalProps) => {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('input');
  const [currentChip, setCurrentChip] = useState<ProviderChipKey>('aws-global');
  const [currentFields, setCurrentFields] = useState<Record<string, string>>({});
  const [currentDbTypes, setCurrentDbTypes] = useState<DbType[]>([]);
  const [staged, setStaged] = useState<StagedInfra[]>([]);
  const [previewRows, setPreviewRows] = useState<PendingPreviewRow[]>([]);
  const [addError, setAddError] = useState<string | null>(null);

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

  const handleNext = async () => {
    if (staged.length === 0 || phase !== 'input') return;
    setPhase('submitting');
    try {
      const responses = await Promise.all(
        staged.map((infra) =>
          previewTargetSourceRegistration(selectedServiceCode, toPreviewRequest(infra)),
        ),
      );
      const rows: PendingPreviewRow[] = [];
      responses.forEach((response, infraIdx) => {
        const infra = staged[infraIdx];
        response.items.forEach((item: RegistrationPreviewItem, dbIdx: number) => {
          rows.push({
            stagedTempId: infra.tempId,
            dbType: infra.dbTypes[dbIdx],
            item,
          });
        });
      });
      setPreviewRows(rows);
      setPhase('preview');
    } catch (err) {
      setPhase('input');
      toast.error(err instanceof Error ? err.message : '등록 미리보기 실패');
    }
  };

  const handleBackToInput = () => {
    setPhase('input');
    setPreviewRows([]);
  };

  const handleConfirmRegister = async () => {
    if (phase !== 'preview') return;
    const addRows = previewRows.filter((row) => row.item.type === 'ADD');
    if (addRows.length === 0) {
      toast.info('신규 등록 대상이 없습니다.');
      return;
    }
    setPhase('submitting');
    const stagedById = new Map(staged.map((s) => [s.tempId, s]));

    const results = await Promise.allSettled(
      addRows.map((row) => {
        const infra = stagedById.get(row.stagedTempId);
        if (!infra) throw new Error('등록 대상 정보를 찾을 수 없습니다.');
        return createProject(toCreateDto(infra, row.dbType as DbType, selectedServiceCode));
      }),
    );

    const failedCount = results.filter((r) => r.status === 'rejected').length;
    if (failedCount > 0) {
      const firstFailure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      const message = firstFailure?.reason instanceof Error
        ? firstFailure.reason.message
        : '일부 인프라 등록에 실패했습니다.';
      toast.error(`${failedCount}건 실패: ${message}`);
      onCreated();
      setPhase('preview');
      return;
    }

    onCreated();
    onClose();
  };

  const canAdd =
    activeChip.enabled &&
    currentDbTypes.length > 0 &&
    validateCredentials(currentChip, currentFields) === null;

  const addRowCount = previewRows.filter((row) => row.item.type === 'ADD').length;
  const duplicateCount = previewRows.length - addRowCount;
  const submitting = phase === 'submitting';
  const showInput = phase === 'input' || (phase === 'submitting' && previewRows.length === 0);

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        className={cn(modalStyles.container, 'w-[840px] max-h-[90vh] flex flex-col shadow-2xl')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={modalStyles.header}>
          <div>
            <h2 className={cn('text-lg font-bold', textColors.primary)}>
              {showInput ? '인프라 등록' : '등록 내용 확인'}
            </h2>
            <p className={cn('mt-0.5 text-sm', textColors.tertiary)}>
              {showInput
                ? 'PII 모니터링 모듈 연동이 필요한 운영계 인프라 정보를 입력해주세요. 각 인프라 Provider/DB Type을 기준으로 Agent/SDU를 자동 할당합니다.'
                : '아래 항목이 등록됩니다. 내용을 확인하고 등록을 진행해주세요.'}
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

        <div className="p-6 space-y-5 overflow-y-auto">
          {showInput ? (
            <>
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

              <section>
                <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
                  <span className={cn('mr-1.5 text-xs', textColors.tertiary)}>1</span>
                  인프라 (Provider) 유형 선택
                </h3>
                <ProviderChipGrid value={currentChip} onChange={handleChipChange} />
              </section>

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

              <section>
                <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
                  인프라 등록 List
                </h3>
                <StagedInfraTable items={staged} onRemove={handleRemove} />
              </section>
            </>
          ) : (
            <>
              <div
                className={cn(
                  'flex items-center gap-2 text-sm px-4 py-3 rounded-lg border',
                  borderColors.default,
                  bgColors.muted,
                )}
              >
                <span className={cn('font-semibold', textColors.primary)}>아래</span>
                <span className={cn('font-bold text-base', textColors.primary)}>
                  {previewRows.length}
                </span>
                <span className={textColors.secondary}>개 인프라가 등록됩니다.</span>
                {duplicateCount > 0 && (
                  <span className={cn('ml-auto text-xs', statusColors.warning.text)}>
                    중복 {duplicateCount}건은 등록에서 제외됩니다.
                  </span>
                )}
              </div>
              <RegistrationPreviewCardList rows={previewRows} />
            </>
          )}
        </div>

        <div className={modalStyles.footer}>
          {showInput ? (
            <>
              <Button variant="secondary" onClick={onClose} type="button">
                취소
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={submitting || staged.length === 0}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    확인 중...
                  </span>
                ) : (
                  `다음${staged.length > 0 ? ` (${staged.length})` : ''}`
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleBackToInput} type="button" disabled={submitting}>
                이전
              </Button>
              <Button
                type="button"
                onClick={handleConfirmRegister}
                disabled={submitting || addRowCount === 0}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    등록 중...
                  </span>
                ) : (
                  `등록하기${addRowCount > 0 ? ` (${addRowCount})` : ''}`
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
