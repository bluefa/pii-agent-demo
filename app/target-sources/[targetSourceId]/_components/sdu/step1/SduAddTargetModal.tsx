'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { Modal } from '@/app/components/ui/Modal';
import { LockIcon } from '@/app/components/ui/icons';
import { useModal } from '@/app/hooks/useModal';
import {
  WizardRail,
  type WizardRailStep,
} from '@/app/components/features/project-create/WizardRail';
import { isValidIdcIp } from '@/lib/constants/idc';
import { cn, inputStyles, numericFeatures } from '@/lib/theme';
import {
  SDU_CLOUDS,
  SDU_REGION_LABEL,
  SDU_REGIONS_BY_SCOPE,
  type SduCloud,
  type SduRegionScope,
} from '@/lib/types/sdu';
import { DatabaseTypeGrid } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/DatabaseTypeGrid';
import {
  newSduTargetDraft,
  SDU_CLOUD_LABEL,
  SDU_DB_TYPE_REQUIRED_MESSAGE,
  SDU_IP_INVALID_MESSAGE,
  SDU_SCOPE_NOTE,
  sduDbTypeSummary,
  type SduTargetDraft,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/model';
import {
  addWizardStyles,
  choiceChipStyles,
  fieldStyles,
  listStyles,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/styles';

type AddStep = 1 | 2 | 3 | 4;

const ADD_STEPS: readonly WizardRailStep<AddStep>[] = [
  { step: 1, title: '연동 위치', sublabel: '클라우드와 Region' },
  { step: 2, title: '업로드 IP', sublabel: '데이터가 나가는 주소' },
  { step: 3, title: 'Database Type', sublabel: '업로드할 데이터의 종류' },
  { step: 4, title: '확인', sublabel: '추가할 대상' },
];

/** 단계 이동표. `(step + 1) as AddStep` 대신 표를 두는 이유는 캐스트를 쓰지 않기 위해서다. */
const NEXT_STEP: Record<AddStep, AddStep> = { 1: 2, 2: 3, 3: 4, 4: 4 };
const PREV_STEP: Record<AddStep, AddStep> = { 1: 1, 2: 1, 3: 2, 4: 3 };

const TITLE_ID = 'sdu-add-target-modal-title';

export interface SduAddTargetModalProps {
  /** 대상소스가 가진 값 — 고를 수 있는 Region 이 여기서 갈린다. */
  scope: SduRegionScope;
  /** 새 행의 목록 키. 서버가 모르는 행이므로 호출자가 만들어 넘긴다. */
  newKey: string;
  /** 다 채운 대상 한 건. 저장은 여기서 하지 않는다 — 목록에 얹기만 한다. */
  onAdd: (draft: SduTargetDraft) => void;
  onClose: () => void;
}

/**
 * 「연동 대상 추가」 — 네 값을 한 화면에 늘어놓는 대신 한 단계에 한 가지씩 묻는다.
 *
 * 「인프라 등록」 마법사와 같은 문법을 쓴다(`ProjectCreateModal`): 회색 바닥, 왼쪽 레일,
 * 오른쪽 흰 카드, 오른쪽 아래 이전/다음. 목록에 이미 있는 행을 고치는 일은 여전히 제자리
 * 편집이다 — 고치는 사람은 무엇을 고치는지 이미 알고 있어서 단계로 나눌 이유가 없다.
 *
 * 이 모달은 API 를 부르지 않는다. 저장은 1단계의 제출 / 저장 버튼이 하던 그대로다.
 */
export const SduAddTargetModal = ({ scope, newKey, onAdd, onClose }: SduAddTargetModalProps) => {
  const [step, setStep] = useState<AddStep>(1);
  const [draft, setDraft] = useState<SduTargetDraft>(() => newSduTargetDraft(newKey, scope));
  /**
   * 「다음」이 막힌 단계. 버튼을 조용히 비활성화하는 대신 눌렀을 때 그 칸의 사유를 말한다 —
   * 비활성 버튼은 왜 못 가는지 말해 주지 않는다.
   */
  const [blockedStep, setBlockedStep] = useState<AddStep | null>(null);
  const closeConfirm = useModal();

  const regions = SDU_REGIONS_BY_SCOPE[scope];
  const ipValid = isValidIdcIp(draft.uploadIp);
  const ipTouched = draft.uploadIp.trim().length > 0;
  const ipInvalid = !ipValid && (ipTouched || blockedStep === 2);
  const dbMissing = draft.databaseTypes.length === 0 && blockedStep === 3;

  const patch = (part: Partial<SduTargetDraft>) => {
    setBlockedStep(null);
    setDraft((prev) => ({ ...prev, ...part }));
  };

  // 클라우드와 Region 은 빈 상태가 없는 선택지라 1단계는 언제나 통과한다.
  const satisfied = (target: AddStep): boolean =>
    target === 2 ? ipValid : target === 3 ? draft.databaseTypes.length > 0 : true;

  const handleNext = () => {
    if (!satisfied(step)) {
      setBlockedStep(step);
      return;
    }
    if (step === 4) {
      onAdd(draft);
      return;
    }
    setStep(NEXT_STEP[step]);
  };

  /**
   * 무엇이든 적었으면 확인을 거쳐 닫는다. 1단계를 벗어난 것도 '적은 것'으로 센다 —
   * 클라우드만 고르고 넘어온 사람에게도 되돌아갈 길이 사라진 것은 마찬가지다.
   */
  const touched = step > 1 || ipTouched || draft.databaseTypes.length > 0;
  const requestClose = () => {
    if (touched) {
      closeConfirm.open();
      return;
    }
    onClose();
  };

  const ipInputId = `sdu-add-upload-ip-${draft.key}`;

  return (
    <>
      <Modal
        isOpen
        onClose={requestClose}
        size="wide"
        // 레일이 이 모달의 제목을 들고 있으므로 공용 헤더를 그리지 않는다.
        chrome="bare"
        ariaLabel="연동 대상 추가"
        // 확인창이 열려 있는 동안 ESC 는 그쪽 것이다. 둘 다 들으면 확인창을 닫는 ESC 가
        // 곧바로 확인창을 다시 연다.
        closeOnEscape={!closeConfirm.isOpen}
      >
        <div className={addWizardStyles.ground}>
          <WizardRail
            title="연동 대상 추가"
            subtitle="데이터가 어디에 있는지 알려주세요."
            navLabel="대상 추가 단계"
            steps={ADD_STEPS}
            current={step}
            onNavigate={setStep}
            titleId={TITLE_ID}
          />

          <div className={addWizardStyles.card}>
            <div className={addWizardStyles.cardBody}>
              {step === 1 && (
                <div>
                  <h3 className={addWizardStyles.stepTitle}>어디에 있는 데이터인가요?</h3>
                  <p className={addWizardStyles.stepLead}>
                    Region이 이후 업로드 경로를 가르는 축이에요.
                  </p>
                  {/* 권역은 담당자가 정하는 값이 아니므로 목록 화면과 같은 한 줄로만 말한다. */}
                  <p className={listStyles.scopeNote}>{SDU_SCOPE_NOTE[scope]}</p>

                  <div className="space-y-5">
                    <div>
                      <p className={fieldStyles.label}>데이터가 있는 클라우드</p>
                      <p className={fieldStyles.hint}>
                        업로드할 데이터가 원래 어디에서 운영되고 있는지예요. 연동 타입(SDU)과는
                        별개예요.
                      </p>
                      <div
                        role="radiogroup"
                        aria-label="클라우드"
                        className="mt-2 flex flex-wrap gap-1.5"
                      >
                        {SDU_CLOUDS.map((cloud: SduCloud) => {
                          const selected = draft.cloud === cloud;
                          return (
                            <button
                              key={cloud}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => patch({ cloud })}
                              className={cn(
                                choiceChipStyles.base,
                                selected ? choiceChipStyles.on : choiceChipStyles.off,
                              )}
                            >
                              {SDU_CLOUD_LABEL[cloud]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className={fieldStyles.label}>Region</p>
                      {/* China 권역의 선택지는 하나뿐이다. 답이 하나인 질문을 칩으로 그리면
                          담당자는 "다른 답도 있나" 하고 한 번 멈추므로, 고르는 자리를 지우고
                          확정된 값을 보여준다. */}
                      {regions.length === 1 ? (
                        <>
                          <p className={fieldStyles.hint}>
                            China 권역이라 Region은 China로 고정돼요. 대상마다 다르게 고를 수
                            없어요.
                          </p>
                          <p className={cn(choiceChipStyles.base, choiceChipStyles.on, 'mt-2 gap-1.5')}>
                            {SDU_REGION_LABEL[regions[0]]}
                            <LockIcon className="h-3.5 w-3.5" />
                            <span className="text-[12px] font-semibold">고정</span>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className={fieldStyles.hint}>
                            업로드 경로가 갈리는 축이에요. 같은 Region을 고른 대상들은 같은 S3 경로
                            하나를 함께 써요.
                          </p>
                          <div
                            role="radiogroup"
                            aria-label="Region"
                            className="mt-2 flex flex-wrap gap-1.5"
                          >
                            {regions.map((region) => {
                              const selected = draft.region === region;
                              return (
                                <button
                                  key={region}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() => patch({ region })}
                                  className={cn(
                                    choiceChipStyles.base,
                                    selected ? choiceChipStyles.on : choiceChipStyles.off,
                                  )}
                                >
                                  {SDU_REGION_LABEL[region]}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h3 className={addWizardStyles.stepTitle}>업로드는 어느 IP에서 하나요?</h3>
                  <p className={addWizardStyles.stepLead}>
                    한 대상에 한 주소예요. 여러 곳에서 올린다면 대상을 나눠 추가해주세요.
                  </p>

                  <label htmlFor={ipInputId} className={fieldStyles.label}>
                    업로드 IP
                  </label>
                  <p className={fieldStyles.hint}>
                    S3에 데이터를 올릴 때 나가는 IP 주소예요. 이 주소에서만 업로드가 허용돼요.
                  </p>
                  <input
                    id={ipInputId}
                    value={draft.uploadIp}
                    placeholder="예: 10.20.30.40"
                    onChange={(event) => patch({ uploadIp: event.target.value })}
                    className={cn(
                      inputStyles.base,
                      'mt-2 max-w-[260px]',
                      numericFeatures.tabular,
                      ipInvalid && inputStyles.error,
                    )}
                  />
                  {ipInvalid && <p className={fieldStyles.message}>{SDU_IP_INVALID_MESSAGE}</p>}
                </div>
              )}

              {step === 3 && (
                <div>
                  <h3 className={addWizardStyles.stepTitle}>어떤 Database를 올리나요?</h3>
                  <p className={addWizardStyles.stepLead}>
                    이 대상에서 올릴 데이터의 종류를 모두 적어주세요.
                  </p>

                  <DatabaseTypeGrid
                    values={draft.databaseTypes}
                    onChange={(databaseTypes) => patch({ databaseTypes })}
                  />
                  {dbMissing && (
                    <p className={fieldStyles.message}>{SDU_DB_TYPE_REQUIRED_MESSAGE}</p>
                  )}
                </div>
              )}

              {step === 4 && (
                <div>
                  <h3 className={addWizardStyles.stepTitle}>이대로 추가할까요?</h3>
                  <p className={addWizardStyles.stepLead}>
                    고칠 내용이 있으면 이전 단계로 돌아가 수정할 수 있어요.
                  </p>

                  <dl className={addWizardStyles.summary}>
                    <dt className={addWizardStyles.summaryTerm}>클라우드</dt>
                    <dd className={addWizardStyles.summaryValue}>{SDU_CLOUD_LABEL[draft.cloud]}</dd>
                    <dt className={addWizardStyles.summaryTerm}>Region</dt>
                    <dd className={addWizardStyles.summaryValue}>
                      {SDU_REGION_LABEL[draft.region]}
                    </dd>
                    <dt className={addWizardStyles.summaryTerm}>업로드 IP</dt>
                    <dd className={addWizardStyles.summaryIp}>{draft.uploadIp}</dd>
                    <dt className={addWizardStyles.summaryTerm}>Database Type</dt>
                    <dd className={addWizardStyles.summaryValue}>
                      {sduDbTypeSummary(draft.databaseTypes)}
                    </dd>
                  </dl>
                </div>
              )}
            </div>

            {/* 판의 오른쪽 아래에 고정 — 스크롤러 바깥이라 어느 단계에서도 같은 자리에 선다. */}
            <div className={addWizardStyles.cardFoot}>
              {step > 1 && (
                <Button variant="secondary" onClick={() => setStep(PREV_STEP[step])}>
                  이전
                </Button>
              )}
              <Button onClick={handleNext}>{step === 4 ? '대상 추가' : '다음'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmStepModal
        open={closeConfirm.isOpen}
        onClose={closeConfirm.close}
        onConfirm={onClose}
        title="대상 추가를 그만두시겠어요?"
        description="지금 닫으면 입력한 내용이 사라져요."
        cancelLabel="계속 작성"
        confirmLabel="닫기"
      />
    </>
  );
};
