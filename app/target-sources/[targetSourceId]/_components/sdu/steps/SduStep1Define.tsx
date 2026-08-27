'use client';

import { useRef, useState } from 'react';
import { getProject } from '@/app/lib/api';
import { getSduDefinition, putSduDefinition, submitSduDefinition } from '@/app/lib/api/sdu';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { useConfirmSubmit } from '@/app/hooks/useConfirmSubmit';
import { useToast } from '@/app/components/ui/toast';
import { ErrorState, LoadingState } from '@/app/components/ui/state';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { ProcessStatus } from '@/lib/types';
import { cardStyles, chipStyles, cn, idcStyles, primaryColors } from '@/lib/theme';
import type { SduDefinition } from '@/lib/types/sdu';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { SDU_STEP_TITLES } from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';
import { SduSubmitModal } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/SduSubmitModal';
import { TargetRowEditor } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/TargetRowEditor';
import { TargetRowList } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/TargetRowList';
import {
  activeSduDrafts,
  isSduDraftComplete,
  newSduTargetDraft,
  SDU_SCOPE_NOTE,
  sduDraftRegions,
  sduReturnHint,
  toSduPutTargets,
  toSduTargetDrafts,
  type SduTargetDraft,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/model';
import { listStyles } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/styles';

export interface SduStep1DefineProps extends SduStepProps {
  /**
   * 'return' is the trip back from 데이터 업로드 via 연동 대상 수정 — the same screen, but
   * it has somewhere to go back to. The gates only block forward.
   */
  mode?: 'initial' | 'return';
  onReturn?: () => void;
}

/** 지금 펼쳐 고치고 있는 행. `isNew` 면 취소가 그 행을 통째로 버린다. */
interface EditingRow {
  key: string;
  isNew: boolean;
  draft: SduTargetDraft;
}

const LOAD_ERROR_MESSAGE = '연동 대상 정의를 불러오지 못했어요.';
const SAVE_ERROR_MESSAGE = '연동 대상을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';

/**
 * Step 1 — 연동 대상 정의.
 *
 * 다른 타입의 1단계는 스캔 → 선택 → 승인 요청이다. SDU 는 스캔할 인프라에 접근하지 못하므로
 * 스캔이 없고, 담당자가 대상을 직접 여러 건 적어 준다. 대상 한 건은 클라우드 · Region ·
 * 업로드 IP · Database Type 네 가지이고, 이 중 **Region 이 이후 업로드 경로를 가르는 축**이라
 * 목록 머리줄이 Region 곳수를 항상 세어 보여준다.
 *
 * `mode='return'` 은 4단계에서 대상을 고치러 돌아온 같은 화면이다. 그때만 행이 변경 상태를
 * 입고, 삭제는 즉시 지우지 않고 표시만 한다 — 저장 전에는 되돌릴 수 있어야 한다.
 */
export function SduStep1Define({
  project,
  onProjectUpdate,
  mode = 'initial',
  onReturn,
}: SduStep1DefineProps) {
  const targetSourceId = project.targetSourceId;
  const isReturn = mode === 'return';
  // 권역은 고르는 값이 아니라 대상소스가 가진 값이다 — AWS 가 갈리는 것과 같은 필드
  // (`metadata.is_china_region`)를 읽는다. 정의 응답의 `region_scope` 로 판단하지 않는
  // 것은, 화면이 그리는 선택지가 응답보다 먼저 서야 하기 때문이다.
  const scope = project.isChinaRegion ? 'CHINA' : 'GLOBAL';

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [definition, setDefinition] = useState<SduDefinition | null>(null);
  const [rows, setRows] = useState<SduTargetDraft[]>([]);
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toast = useToast();
  const newRowSeq = useRef(0);

  useAbortableEffect(
    (signal) => {
      setStatus('loading');
      return getSduDefinition(targetSourceId, { signal })
        .then((loaded) => {
          if (signal.aborted) return;
          setDefinition(loaded);
          setRows(toSduTargetDrafts(loaded.targets));
          setEditing(null);
          setStatus('ready');
        })
        .catch(() => {
          // 실패는 빈 결과가 아니다 — 대상 0건으로 그리면 담당자는 지워졌다고 읽는다.
          if (signal.aborted) return;
          setStatus('error');
        });
    },
    [targetSourceId, reloadNonce],
  );

  const baseline = definition?.targets ?? [];
  const active = activeSduDrafts(rows);
  const regions = sduDraftRegions(rows);
  const blocked =
    editing !== null || active.length === 0 || active.some((row) => !isSduDraftComplete(row));

  const submit = useConfirmSubmit({
    targetSourceId,
    pendingStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    request: async () => {
      // 정의를 먼저 저장하고 제출한다. 제출은 본문이 없는 쓰기라(assumed §3) 저장하지 않은
      // 편집분을 실어 보낼 방법이 없다.
      await putSduDefinition(targetSourceId, { targets: toSduPutTargets(rows) });
      await submitSduDefinition(targetSourceId);
    },
    // 확인 프레임이 물러난 뒤에 갱신한다 — 상태가 바뀌는 순간 이 컴포넌트가 4단계 화면으로
    // 교체되므로, 순서가 반대면 프레임이 그려지지 않는다. 갱신 실패는 삼키지 않는다:
    // 제출은 접수됐는데 화면은 1단계 그대로라, 아무 말도 없으면 한 번 더 누른다.
    settle: async () => {
      try {
        onProjectUpdate(await getProject(targetSourceId));
      } catch {
        toast.warning('제출은 접수됐어요. 화면을 새로고침해 최신 상태를 확인해 주세요.');
      } finally {
        setSubmitOpen(false);
      }
    },
  });

  const handleAdd = () => {
    const key = `sdu-new-${newRowSeq.current++}`;
    setEditing({ key, isNew: true, draft: newSduTargetDraft(key, scope) });
  };

  const handleEdit = (key: string) => {
    const row = rows.find((candidate) => candidate.key === key);
    if (!row) return;
    setEditing({ key, isNew: false, draft: { ...row, databaseTypes: [...row.databaseTypes] } });
  };

  const handleEditorSave = () => {
    if (!editing) return;
    const saved = editing.draft;
    setRows((prev) =>
      editing.isNew ? [...prev, saved] : prev.map((row) => (row.key === saved.key ? saved : row)),
    );
    setEditing(null);
  };

  // 되돌아온 1단계에서는 삭제가 표시일 뿐이다 — 저장 전에는 되돌릴 수 있어야 한다.
  const handleDelete = (key: string) => {
    setRows((prev) =>
      isReturn
        ? prev.map((row) => (row.key === key ? { ...row, removed: true } : row))
        : prev.filter((row) => row.key !== key),
    );
  };

  const handleRestore = (key: string) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, removed: false } : row)));
  };

  const handleReturnSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await putSduDefinition(targetSourceId, { targets: toSduPutTargets(rows) });
      setDefinition(saved);
      setRows(toSduTargetDrafts(saved.targets));
      onReturn?.();
    } catch {
      setSaveError(SAVE_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSubmit = () => {
    // 지난 실패 프레임을 들고 다시 열지 않는다.
    submit.reset();
    setSubmitOpen(true);
  };

  return (
    <>
      {/* No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar. */}
      <section className={cardStyles.base}>
        <header className={cardStyles.header}>
          <div className="flex items-center gap-2">
            <span className={cardStyles.stepTag}>1단계</span>
            <h2 className={cardStyles.cardTitle}>{SDU_STEP_TITLES[1]}</h2>
            {isReturn && (
              <span className={cn(chipStyles.base, chipStyles.variant.manual)}>
                4단계에서 돌아옴
              </span>
            )}
          </div>
          <p className={cn('mt-2.5 break-keep', cardStyles.guidance)}>
            {isReturn ? (
              <>
                이미 4단계를 진행 중인 대상소스예요. 대상을 고치면 4단계에서 확인하신 내용 중{' '}
                <span className={primaryColors.text}>Region이 달라지는 부분만</span> 다시
                확인하시면 돼요. 등록한 수신자와 받으신 S3 Access Key는 그대로예요.
              </>
            ) : (
              <>
                SDU는 인프라를 스캔하지 않아요.{' '}
                <span className={primaryColors.text}>연동할 대상을 직접 입력</span>해 주세요. 대상
                한 건은 클라우드 · Region · 업로드 IP · Database Type 네 가지이고,{' '}
                <span className={primaryColors.text}>Region이 업로드 경로를 가르는 축</span>이에요.
              </>
            )}
          </p>
        </header>

        <div className={cardStyles.body}>
          {status === 'loading' && <LoadingState label="연동 대상 정의를 불러오는 중…" />}

          {status === 'error' && (
            <ErrorState
              title="불러오지 못했어요"
              message={LOAD_ERROR_MESSAGE}
              onRetry={() => setReloadNonce((nonce) => nonce + 1)}
            />
          )}

          {status === 'ready' && (
            <>
              {/* 카드 머리의 알림들. `StepBanner` 는 자기 아래 여백(mb-5)을 갖고 있으므로
                  아래 묶음의 `space-y` 안에 넣지 않는다 — 두 규칙이 겹치면 간격이 두 번 선다.
                  저장 실패도 여기 선다: 푸터는 sticky 라 카드 아래에 둔 알림을 가릴 수 있다. */}
              {isReturn && (
                <StepBanner variant="warn">
                  Region이 바뀌면 그 Region의 방화벽·업로드 확인을 다시 해야 해요. 업로드 IP가
                  바뀌면 모든 Region을 다시 확인해요.
                </StepBanner>
              )}
              {saveError && <StepBanner variant="error">{saveError}</StepBanner>}

              <div>
                {/* 권역은 담당자가 정하는 값이 아니므로 컨트롤이 아니라 한 줄이다 — 목록
                    머리줄과 같은 톤으로, 무엇이 이미 정해져 있는지만 말한다. */}
                <p className={listStyles.scopeNote}>{SDU_SCOPE_NOTE[scope]}</p>

                <TargetRowList
                  rows={rows}
                  baseline={baseline}
                  showDiff={isReturn}
                  editingKey={editing?.key ?? null}
                  editorSlot={
                    editing && (
                      <TargetRowEditor
                        draft={editing.draft}
                        scope={scope}
                        index={
                          editing.isNew
                            ? rows.length + 1
                            : rows.findIndex((row) => row.key === editing.key) + 1
                        }
                        onChange={(draft) => setEditing({ ...editing, draft })}
                        onSave={handleEditorSave}
                        onCancel={() => setEditing(null)}
                      />
                    )
                  }
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                  onAdd={handleAdd}
                />
              </div>
            </>
          )}
        </div>

        {/* C-2 action zone: the step-transition CTA docks (sticky) at the card bottom. */}
        {status === 'ready' && (
          <CardActionBar
            hint={
              isReturn
                ? sduReturnHint(baseline, rows)
                : `대상 ${active.length}건 · Region ${regions.length}곳 → 업로드 경로 ${regions.length}개`
            }
          >
            {isReturn ? (
              <button
                type="button"
                disabled={blocked || saving}
                onClick={handleReturnSave}
                className={idcStyles.triggerBtn.primary}
              >
                저장하고 4단계로 돌아가기
              </button>
            ) : (
              <button
                type="button"
                disabled={blocked}
                onClick={handleOpenSubmit}
                className={idcStyles.triggerBtn.primary}
              >
                제출하고 업로드 단계로
              </button>
            )}
          </CardActionBar>
        )}
      </section>

      <SduSubmitModal
        isOpen={submitOpen}
        targetCount={active.length}
        regionCount={regions.length}
        phase={submit.phase}
        pending={submit.pending}
        errorCode={submit.errorCode}
        onSubmit={submit.submit}
        onRetry={submit.retry}
        onClose={() => setSubmitOpen(false)}
      />
    </>
  );
}
