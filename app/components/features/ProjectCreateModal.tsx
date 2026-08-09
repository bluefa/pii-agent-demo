'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
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
import { bgColors, borderColors, cn, modalStyles, textColors } from '@/lib/theme';

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

  // WCAG dialog pattern, same shape as ConfirmStepModal: focus enters the dialog,
  // the body stops scrolling, and focus goes back to the trigger on close. Without
  // it Tab walks into the /services list behind the overlay, where Enter routes to
  // another service — and this modal is not keyed by service, so it would keep the
  // whole wizard while `selectedServiceCode` swapped underneath it.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, []);

  const confirmIsOpen = closeConfirm.isOpen;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // The confirm dialog owns both keys while it is open — it runs its own trap
      // and dismisses itself on Escape.
      if (confirmIsOpen) return;
      if (event.key === 'Escape') {
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea, input, select, a[href]',
        ) ?? [],
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // Covers the first Tab after mount, when focus is on the dialog container
      // itself and would otherwise step out to whatever sits behind the overlay.
      const inside =
        active !== null && active !== dialogRef.current && dialogRef.current?.contains(active);
      if (!inside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
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
      // The inline card on step 4 is the error surface; a toast on top of it says
      // the same sentence twice and leaves as the card stays.
      setCandidatesError(err instanceof Error ? err.message : '연동 구성을 확인하지 못했어요.');
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
      // A failed fetch left step 4 with a disabled button and no way forward — the
      // primary becomes the retry rather than adding a second control.
      if (candidatesError !== null) {
        void loadCandidates();
        return;
      }
      void startRegistration();
      return;
    }
    onClose();
  };

  const primaryLabel =
    step === 4
      ? candidatesError !== null
        ? '다시 시도'
        : '등록하기'
      : step === 5
        ? registrationComplete
          ? '닫기'
          : '등록 중…'
        : '다음';
  const primaryDisabled =
    step === 4
      ? candidatesBusy || (candidatesError === null && addCount === 0)
      : step === 5
        ? !registrationComplete
        : false;

  return (
    <>
      <div className={modalStyles.overlay} onClick={requestClose}>
        <div
          ref={dialogRef}
          // -1: not in the Tab order, but focusable so the dialog can take the
          // initial focus and be announced by its title.
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="infra-register-modal-title"
          // Fixed height, not auto: the five steps differ by ~200px of content and a
          // modal that resizes under the cursor moves the 다음 button between clicks.
          // `max-h-[90vh]` is the short-window escape hatch — the pane scrolls instead.
          className={cn(
            modalStyles.container,
            'flex h-[700px] max-h-[90vh] w-[1000px] max-w-[calc(100vw-2rem)] flex-col shadow-2xl',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Grouping by surface, not by borders: a gray ground fills the dialog and the
              content sits on it as its own white card. The step column sits directly on
              the gray, so the 16px gutter is what separates the two — no rule to draw, and
              nothing left to make a seam. Inner radius steps down from the shell's.
              Both surfaces name their own foreground: an undeclared color inherits the
              body's, which flips under a dark system preference and vanishes here. */}
          <div
            className={cn(
              'flex min-h-0 flex-1 gap-4 overflow-hidden p-4',
              bgColors.panel,
              textColors.primary,
            )}
          >
            <WizardRail
              current={step}
              onNavigate={step < 5 ? setStep : undefined}
              titleId="infra-register-modal-title"
            />

            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col rounded-lg border',
                borderColors.card,
                bgColors.surface,
                textColors.primary,
              )}
            >
              {/* pt-6 matches the rail's, so the step heading and the dialog title
                  start on the same line instead of stepping down from it. */}
              <div className="min-h-0 flex-1 overflow-y-auto px-[30px] pt-6 pb-4">
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
