'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useToast } from '@/app/components/ui/toast';
import {
  createTargetSource,
  getCreationCandidates,
  type CreationCandidatesInput,
  type TargetSourceCreationCandidateResponse,
} from '@/app/lib/api';
import {
  cn,
  modalStyles,
  textColors,
  bgColors,
  borderColors,
  statusColors,
  interactiveColors,
  numericFeatures,
} from '@/lib/theme';
import type { DbType } from '@/lib/constants/db-types';
import {
  PROVIDER_CHIP_BY_KEY,
  type ApiProvider,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';
import type { CloudProvider } from '@/lib/types';
import {
  DbTypeMultiSelect,
  ProviderChipGrid,
  ProviderCredentialForm,
  validateCredentials,
} from '@/app/components/features/project-create';
import {
  AwsRegionToggle,
  RegistrationPreviewCardList,
  RegistrationProgressList,
  type AwsRegion,
  type PreviewRow,
  type ProgressRow,
  type ProgressRowStatus,
} from '@/app/components/features/admin/v7';

interface ProjectCreateModalProps {
  selectedServiceCode: string;
  onClose: () => void;
  onCreated: () => void;
}

type Phase = 'input' | 'preview' | 'progress';

interface FormState {
  chipKey: ProviderChipKey;
  apiProvider: ApiProvider;
  awsRegion: AwsRegion;
  fields: Record<string, string>;
}

const buildCandidatesInput = (form: FormState, dbTypes: DbType[]): CreationCandidatesInput => {
  const { fields } = form;
  const description = fields.description?.trim();
  switch (form.apiProvider) {
    case 'AWS':
      return {
        cloudProvider: 'AWS',
        awsAccountId: fields.payerAccount,
        isChinaRegion: form.awsRegion === 'china',
        ...(description ? { description } : {}),
        dbTypes,
      };
    case 'Azure':
      return {
        cloudProvider: 'Azure',
        tenantId: fields.tenantId,
        subscriptionId: fields.subscriptionId,
        ...(description ? { description } : {}),
        dbTypes,
      };
    case 'GCP':
      return {
        cloudProvider: 'GCP',
        gcpProjectId: fields.projectId,
        ...(description ? { description } : {}),
        dbTypes,
      };
    case 'IDC':
      return {
        cloudProvider: 'IDC',
        description: description ?? '',
        dbTypes,
      };
  }
};

const PROVIDER_FROM_RAW: Record<string, CloudProvider> = {
  AWS: 'AWS',
  AZURE: 'Azure',
  GCP: 'GCP',
  IDC: 'IDC',
};

// candidate.cloud_type casing is not guaranteed (loose wire); normalize uppercase.
const toCloudProvider = (raw?: string | null): CloudProvider =>
  PROVIDER_FROM_RAW[(raw ?? '').toUpperCase()] ?? 'AWS';

const identifierLabel = (candidate: TargetSourceCreationCandidateResponse): string => {
  const meta = candidate.metadata ?? {};
  switch (toCloudProvider(candidate.cloud_type)) {
    case 'AWS':
      return meta.aws_account_id ? `Payer ${meta.aws_account_id}` : '—';
    case 'Azure':
      return meta.subscription_id ? `Sub ${meta.subscription_id}` : '—';
    case 'GCP':
      return meta.project_id ? `Project ${meta.project_id}` : '—';
    case 'IDC':
      return meta.description || '—';
    default:
      return '—';
  }
};

export const ProjectCreateModal = ({
  selectedServiceCode,
  onClose,
  onCreated,
}: ProjectCreateModalProps) => {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('input');
  const [chipKey, setChipKey] = useState<ProviderChipKey>('aws');
  const [awsRegion, setAwsRegion] = useState<AwsRegion>('global');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dbTypes, setDbTypes] = useState<DbType[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // mountedRef gates async setState after unmount — handleRegister fans out N
  // createProject calls in parallel, and the modal can close mid-batch.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Escape closes the modal — but not during Phase 3 in-flight register, so
  // users cannot cancel a batch that is still hitting the BFF.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (phase === 'progress' && busy) return;
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, busy, onClose]);

  const chipDef = PROVIDER_CHIP_BY_KEY[chipKey];
  const isAws = chipDef.apiProvider === 'AWS';

  const handleChipChange = (key: ProviderChipKey) => {
    setChipKey(key);
    setFields({});
    setSubmitError(null);
  };

  const buildForm = (): FormState => ({
    chipKey,
    apiProvider: chipDef.apiProvider,
    awsRegion,
    fields,
  });

  const handleNext = async () => {
    if (busy) return;
    const validationError = validateCredentials(chipKey, fields);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    if (dbTypes.length === 0) {
      setSubmitError('DB Type을 1개 이상 선택하세요');
      return;
    }

    setSubmitError(null);
    setBusy(true);
    try {
      const candidates = await getCreationCandidates(
        selectedServiceCode,
        buildCandidatesInput(buildForm(), dbTypes),
      );
      if (!mountedRef.current) return;
      const rows: PreviewRow[] = candidates.map((candidate, idx) => ({
        candidate,
        dbType: dbTypes[idx],
      }));
      setPreviewRows(rows);
      setPhase('preview');
    } catch (err) {
      if (mountedRef.current) {
        toast.error(err instanceof Error ? err.message : '등록 미리보기 실패');
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const handleBackToInput = () => {
    setPhase('input');
    setPreviewRows([]);
  };

  const handleRegister = async () => {
    if (busy) return;
    const addRows = previewRows.filter((row) => row.candidate.status === 'ADD');
    if (addRows.length === 0) {
      toast.info('신규 등록 대상이 없습니다.');
      return;
    }

    const initial: ProgressRow[] = addRows.map((row, idx) => ({
      key: `row-${idx}`,
      cloudProvider: toCloudProvider(row.candidate.cloud_type),
      isSdu: row.candidate.is_sdu_type === true,
      primaryLabel: `${toCloudProvider(row.candidate.cloud_type)} · ${row.dbType}`,
      secondaryLabel: identifierLabel(row.candidate),
      status: 'in-progress',
    }));
    setProgressRows(initial);
    setPhase('progress');
    setBusy(true);

    const updateRow = (key: string, status: ProgressRowStatus, error?: string) => {
      if (!mountedRef.current) return;
      setProgressRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, status, ...(error ? { error } : {}) } : r)),
      );
    };

    await Promise.allSettled(
      addRows.map(async (row, idx) => {
        const key = `row-${idx}`;
        try {
          await createTargetSource(selectedServiceCode, row.candidate);
          updateRow(key, 'done');
        } catch (err) {
          updateRow(key, 'failed', err instanceof Error ? err.message : '등록 실패');
        }
      }),
    );

    if (!mountedRef.current) return;
    setBusy(false);
    onCreated();
  };

  const phase1Valid = dbTypes.length > 0 && validateCredentials(chipKey, fields) === null;
  const addRowCount = previewRows.filter((row) => row.candidate.status === 'ADD').length;
  const duplicateCount = previewRows.length - addRowCount;
  const progressDone = progressRows.filter((r) => r.status === 'done').length;
  const progressFailed = progressRows.filter((r) => r.status === 'failed').length;
  const progressComplete =
    progressRows.length > 0 && progressDone + progressFailed === progressRows.length;
  const progressTone: 'running' | 'success' | 'error' = !progressComplete
    ? 'running'
    : progressFailed === 0
      ? 'success'
      : 'error';
  const progressTitle = !progressComplete
    ? '인프라를 등록하고 있어요'
    : progressFailed === 0
      ? `${progressDone}건 등록 완료`
      : `${progressDone}건 완료 · ${progressFailed}건 실패`;
  const progressSubtitle = !progressComplete
    ? '각 인프라에 대해 Agent/SDU 할당과 자격증명 검증을 진행해요.'
    : progressFailed === 0
      ? '모든 인프라가 등록됐어요.'
      : '일부 인프라 등록에 실패했어요. 닫고 다시 시도해주세요.';

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-create-modal-title"
        className={cn(modalStyles.container, 'w-[840px] max-h-[90vh] flex flex-col shadow-2xl')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={modalStyles.header}>
          <div>
            <h2 id="project-create-modal-title" className={cn('text-lg font-bold', textColors.primary)}>
              {phase === 'input' && '인프라 등록'}
              {phase === 'preview' && '등록 내용 확인'}
              {phase === 'progress' && (progressComplete ? '등록 결과' : '인프라 등록 진행 중')}
            </h2>
            <p className={cn('mt-0.5 text-sm', textColors.tertiary)}>
              {phase === 'input' &&
                'PII 모니터링 모듈 연동이 필요한 운영계 인프라 정보를 입력해주세요. 각 인프라 Provider/DB Type을 기준으로 Agent/SDU를 자동 할당합니다.'}
              {phase === 'preview' &&
                '입력한 정보를 기준으로 아래 인프라가 등록됩니다. 내용을 확인하고 등록을 진행해주세요.'}
              {phase === 'progress' && progressSubtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={phase === 'progress' && !progressComplete}
            className={cn(
              'p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              interactiveColors.closeButton,
            )}
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {phase === 'input' && (
            <>
              <section>
                <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
                  <span className={cn('mr-1.5 text-xs', textColors.tertiary)}>1</span>
                  인프라 (Provider) 유형 선택
                </h3>
                <ProviderChipGrid value={chipKey} onChange={handleChipChange} />
                {isAws && (
                  <div className="mt-3">
                    <AwsRegionToggle value={awsRegion} onChange={setAwsRegion} />
                  </div>
                )}
              </section>

              <div className="grid grid-cols-2 gap-5">
                <section>
                  <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
                    <span className={cn('mr-1.5 text-xs', textColors.tertiary)}>2</span>
                    인프라 정보
                  </h3>
                  <ProviderCredentialForm
                    chipKey={chipKey}
                    values={fields}
                    onChange={setFields}
                  />
                </section>
                <section>
                  <h3 className={cn('mb-2 text-sm font-semibold', textColors.secondary)}>
                    <span className={cn('mr-1.5 text-xs', textColors.tertiary)}>3</span>
                    DB Type 선택
                  </h3>
                  <DbTypeMultiSelect values={dbTypes} onChange={setDbTypes} />
                </section>
              </div>

              {submitError && (
                <p className={cn('text-sm', statusColors.error.text)}>{submitError}</p>
              )}
            </>
          )}

          {phase === 'preview' && (
            <>
              <div
                className={cn(
                  'flex items-center gap-2 text-sm px-4 py-3 rounded-lg border',
                  borderColors.default,
                  bgColors.muted,
                )}
              >
                <span className={cn('font-bold text-base', textColors.primary, numericFeatures.tabular)}>
                  {previewRows.length}
                </span>
                <span className={textColors.secondary}>개 인프라 후보가 생성됐어요.</span>
                {duplicateCount > 0 && (
                  <span className={cn('ml-auto text-xs', statusColors.warning.text)}>
                    중복 {duplicateCount}건은 등록에서 제외됩니다.
                  </span>
                )}
              </div>
              <RegistrationPreviewCardList rows={previewRows} />
            </>
          )}

          {phase === 'progress' && (
            <RegistrationProgressList
              rows={progressRows}
              title={progressTitle}
              subtitle={progressSubtitle}
              tone={progressTone}
            />
          )}
        </div>

        <div className={modalStyles.footer}>
          {phase === 'input' && (
            <>
              <Button variant="secondary" onClick={onClose} type="button">
                취소
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={busy || !phase1Valid}
              >
                {busy ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    확인 중...
                  </span>
                ) : (
                  '다음'
                )}
              </Button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <Button
                variant="secondary"
                onClick={handleBackToInput}
                type="button"
                disabled={busy}
              >
                이전
              </Button>
              <Button
                type="button"
                onClick={handleRegister}
                disabled={busy || addRowCount === 0}
              >
                {`등록하기${addRowCount > 0 ? ` (${addRowCount})` : ''}`}
              </Button>
            </>
          )}
          {phase === 'progress' && (
            <Button
              type="button"
              onClick={onClose}
              disabled={!progressComplete}
            >
              {progressComplete ? '닫기' : '진행 중...'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
