'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { useToast } from '@/app/components/ui/toast';
import { useModal } from '@/app/hooks/useModal';
import {
  createTargetSource,
  getCreationCandidates,
  type TargetSourceCreationCandidateResponse,
} from '@/app/lib/api';
import { Step1CloudAccount } from '@/app/components/features/project-create/Step1CloudAccount';
import { Step2AccountInfo } from '@/app/components/features/project-create/Step2AccountInfo';
import { Step3Databases } from '@/app/components/features/project-create/Step3Databases';
import { Step4Review } from '@/app/components/features/project-create/Step4Review';
import {
  Step5Result,
  type RegistrationRow,
  type RegistrationRowStatus,
} from '@/app/components/features/project-create/Step5Result';
import { WizardRail } from '@/app/components/features/project-create/WizardRail';
import {
  buildCandidatesInput,
  isStepComplete,
  type AwsInstallMode,
  type OperatingRegion,
  type WizardStep,
} from '@/app/components/features/project-create/wizard-model';
import type { DbType } from '@/lib/constants/db-types';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import { borderColors, cn, modalStyles, textColors } from '@/lib/theme';

interface ProjectCreateModalProps {
  selectedServiceCode: string;
  onClose: () => void;
  onCreated: () => void;
}

export const ProjectCreateModal = ({
  selectedServiceCode,
  onClose,
  onCreated,
}: ProjectCreateModalProps) => {
  const toast = useToast();
  const [step, setStep] = useState<WizardStep>(1);
  const [providerKey, setProviderKey] = useState<ProviderChipKey>('aws');
  const [region, setRegion] = useState<OperatingRegion>('global');
  const [installMode, setInstallMode] = useState<AwsInstallMode>('auto');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dbTypes, setDbTypes] = useState<DbType[]>([]);
  const [othersDb, setOthersDb] = useState(false);
  const [showCredErrors, setShowCredErrors] = useState(false);
  const [showDbError, setShowDbError] = useState(false);
  const [candidates, setCandidates] = useState<TargetSourceCreationCandidateResponse[]>([]);
  const [candidatesBusy, setCandidatesBusy] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const closeConfirm = useModal();

  // mountedRef gates async setState after unmount — step 5 fans out N createTargetSource
  // calls in parallel and the modal can be torn down mid-batch.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const formState = { providerKey, region, installMode, fields, dbTypes, othersDb };
  const registrationComplete = rows.length > 0 && rows.every((row) => row.status !== 'in-progress');
  const failedCount = rows.filter((row) => row.status === 'failed').length;
  const addCount = candidates.filter((candidate) => candidate.status === 'ADD').length;

  // Backdrop and Escape both land here. A batch already hitting the BFF cannot be
  // abandoned; once it has finished there is nothing left to lose, so no confirm.
  const openConfirm = closeConfirm.open;
  const requestClose = useCallback(() => {
    if (step === 5) {
      if (registrationComplete) onClose();
      return;
    }
    openConfirm();
  }, [step, registrationComplete, onClose, openConfirm]);

  const confirmIsOpen = closeConfirm.isOpen;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // The confirm dialog owns Escape while it is open (it dismisses itself).
      if (confirmIsOpen) return;
      requestClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmIsOpen, requestClose]);

  const handleProviderChange = (key: ProviderChipKey) => {
    if (key === providerKey) return;
    setProviderKey(key);
    setFields({});
    setInstallMode('auto');
    setDbTypes([]);
    setOthersDb(false);
    setShowCredErrors(false);
    setShowDbError(false);
  };

  // Monotonic token: going back and re-entering step 4 restarts the fetch, and a
  // slow earlier response must not overwrite the newer form's candidates.
  const candidateSeqRef = useRef(0);
  const loadCandidates = async () => {
    const seq = ++candidateSeqRef.current;
    setCandidatesBusy(true);
    setCandidatesError(null);
    setCandidates([]);
    try {
      const next = await getCreationCandidates(
        selectedServiceCode,
        buildCandidatesInput(formState),
      );
      if (!mountedRef.current || seq !== candidateSeqRef.current) return;
      setCandidates(next);
    } catch (err) {
      if (!mountedRef.current || seq !== candidateSeqRef.current) return;
      const message = err instanceof Error ? err.message : '연동 구성을 확인하지 못했어요.';
      setCandidatesError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current && seq === candidateSeqRef.current) setCandidatesBusy(false);
    }
  };

  const startRegistration = async () => {
    const addCandidates = candidates.filter((candidate) => candidate.status === 'ADD');
    if (addCandidates.length === 0) return;

    setRows(
      addCandidates.map((candidate, idx) => ({
        key: `row-${idx}`,
        candidate,
        status: 'in-progress' as const,
      })),
    );
    setStep(5);

    const updateRow = (key: string, status: RegistrationRowStatus, error?: string) => {
      if (!mountedRef.current) return;
      setRows((prev) =>
        prev.map((row) => (row.key === key ? { ...row, status, ...(error ? { error } : {}) } : row)),
      );
    };

    await Promise.allSettled(
      addCandidates.map(async (candidate, idx) => {
        const key = `row-${idx}`;
        try {
          await createTargetSource(selectedServiceCode, candidate);
          updateRow(key, 'done');
        } catch (err) {
          updateRow(key, 'failed', err instanceof Error ? err.message : '등록 실패');
        }
      }),
    );

    if (!mountedRef.current) return;
    onCreated();
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!isStepComplete(2, formState)) {
        setShowCredErrors(true);
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!isStepComplete(3, formState)) {
        setShowDbError(true);
        return;
      }
      setStep(4);
      void loadCandidates();
      return;
    }
    if (step === 4) {
      void startRegistration();
      return;
    }
    onClose();
  };

  const primaryLabel =
    step === 4 ? '등록하기' : step === 5 ? (registrationComplete ? '닫기' : '등록 중…') : '다음';
  const primaryDisabled =
    step === 4
      ? candidatesBusy || candidatesError !== null || addCount === 0
      : step === 5
        ? !registrationComplete
        : false;

  return (
    <>
      <div className={modalStyles.overlay} onClick={requestClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="infra-register-modal-title"
          // Fixed height, not auto: the five steps differ by ~200px of content and a
          // modal that resizes under the cursor moves the 다음 button between clicks.
          // `max-h-[90vh]` is the short-window escape hatch — the pane scrolls instead.
          className={cn(
            modalStyles.container,
            'flex h-[700px] max-h-[90vh] w-[960px] max-w-[calc(100vw-2rem)] flex-col shadow-2xl',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={cn('border-b px-7 pb-4.5 pt-6', borderColors.light)}>
            <h2 id="infra-register-modal-title" className={cn('text-xl font-bold', textColors.primary)}>
              인프라 등록
            </h2>
            <p className={cn('mt-1 text-sm', textColors.tertiary)}>
              PII 모니터링을 시작할 인프라를 등록해요. 입력하신 내용에 맞는 연동 구성을 안내해 드려요.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <WizardRail current={step} onNavigate={step < 5 ? setStep : undefined} />

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-[30px] pt-[26px] pb-4">
                {step === 1 && (
                  <Step1CloudAccount
                    providerKey={providerKey}
                    onProviderChange={handleProviderChange}
                    region={region}
                    onRegionChange={setRegion}
                  />
                )}
                {step === 2 && (
                  <Step2AccountInfo
                    providerKey={providerKey}
                    values={fields}
                    onChange={setFields}
                    showRequiredErrors={showCredErrors}
                    installMode={installMode}
                    onInstallModeChange={setInstallMode}
                  />
                )}
                {step === 3 && (
                  <Step3Databases
                    providerKey={providerKey}
                    selected={dbTypes}
                    onToggle={(value) => {
                      setShowDbError(false);
                      setDbTypes((prev) =>
                        prev.includes(value)
                          ? prev.filter((item) => item !== value)
                          : [...prev, value],
                      );
                    }}
                    othersSelected={othersDb}
                    onOthersToggle={() => {
                      setShowDbError(false);
                      setOthersDb((prev) => !prev);
                    }}
                    showError={showDbError}
                  />
                )}
                {step === 4 && (
                  <Step4Review
                    candidates={candidates}
                    installMode={installMode}
                    busy={candidatesBusy}
                    error={candidatesError}
                  />
                )}
                {step === 5 && (
                  <Step5Result
                    rows={rows}
                    installMode={installMode}
                    complete={registrationComplete}
                    failedCount={failedCount}
                  />
                )}
              </div>

              {/* Pinned to the pane's bottom-right, outside the scroller — no divider,
                  no footer bar. 700 = the 640px content column plus the pane's own
                  30px gutters, so the buttons land on that column's right edge. */}
              <div className="flex max-w-[700px] flex-none justify-end gap-2 px-[30px] pb-[26px]">
                {step > 1 && step < 5 && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setStep((prev) => (prev - 1) as WizardStep)}
                  >
                    이전
                  </Button>
                )}
                <Button type="button" onClick={handleNext} disabled={primaryDisabled}>
                  {primaryLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmStepModal
        open={closeConfirm.isOpen}
        onClose={closeConfirm.close}
        onConfirm={onClose}
        title="등록을 그만두시겠어요?"
        description="지금 닫으면 입력한 내용이 사라져요."
        cancelLabel="계속 작성"
        confirmLabel="닫기"
      />
    </>
  );
};
