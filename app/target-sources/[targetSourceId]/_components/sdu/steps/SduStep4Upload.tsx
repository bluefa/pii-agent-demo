'use client';

import { useCallback, useState } from 'react';
import {
  getSduDefinition,
  getSduUpload,
  putSduCommandsAck,
  putSduFirewallAck,
  putSduAccessKeyRecipients,
} from '@/app/lib/api/sdu';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { ErrorState } from '@/app/components/ui/state';
import { useLocale } from '@/app/components/LocaleProvider';
import { SduStep1Define } from '@/app/target-sources/[targetSourceId]/_components/sdu/steps/SduStep1Define';
import {
  SDU_COPY,
  type SduUploadCopy,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';
import { BdcResourceBlock } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/BdcResourceBlock';
import { FirewallBlock } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/FirewallBlock';
import {
  GateBlock,
  type GateState,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/GateBlock';
import { InvalidationBanner } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/InvalidationBanner';
import { RecipientsBlock } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/RecipientsBlock';
import { UploadCommandsBlock } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/UploadCommandsBlock';
import {
  SDU_GATE_IDS,
  currentGate,
  doneCount,
  gateDoneStates,
  recipientsSummary,
  regionAckSummary,
  sduGateTitles,
  type SduGateId,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/model';
import type { SduBdcStatus, SduDefinition, SduUpload } from '@/lib/types/sdu';
import {
  buttonStyles,
  cardStyles,
  cn,
  getButtonClass,
  idcStyles,
  statusColors,
  textColors,
  textStyles,
} from '@/lib/theme';

interface Snapshot {
  upload: SduUpload;
  definition: SduDefinition;
}

const GateSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-3">
    {SDU_GATE_IDS.map((id) => (
      <div key={id} className={cn(idcStyles.skeletonBar, 'h-[58px] rounded-xl')} />
    ))}
  </div>
);

/**
 * SDU Step 4 — 데이터 업로드.
 *
 * Four blocks, one sequential gate chain: the firewall has to be open before an S3 Access Key
 * is usable, the key has to arrive before data can be uploaded, and the upload has to finish
 * before BDC builds anything. Only the current block is open; a finished one folds to the one
 * line it is worth remembering ("US · EU", "박지원 외 2명") plus the action that undoes it.
 *
 * The gates block FORWARD only — including the longest way back, 「연동 대상 수정」, which swaps
 * this card for 1단계 without touching the status. That is affordable because the server
 * recomputes which answers survive the edit instead of resetting the step — one answer per
 * block, kept or cleared as a whole (see the invalidation table).
 */
/** 접힌 4번 줄. 세 상태가 세 문장이다 — 「진행 중」 알약 옆에서 완료를 말하면 줄이 자기와 싸운다. */
const bdcSummaries = (t: SduUploadCopy): Record<SduBdcStatus, string> => ({
  NOT_STARTED: t.bdcNotStarted,
  IN_PROGRESS: t.bdcInProgress,
  COMPLETED: t.bdcCompleted,
});

export function SduStep4Upload({ project, onProjectUpdate }: SduStepProps) {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].upload;
  const gateTitle = sduGateTitles(t);
  const { targetSourceId } = project;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  /** A finished block the owner reopened. Null means "follow the flow" — the current one. */
  const [reopened, setReopened] = useState<SduGateId | null>(null);
  const [editing, setEditing] = useState(false);

  // Reset during render on target change, not in the effect: `SduTargetSourceLayout` renders
  // this card without a key, so a switch keeps the component mounted and the effect's reset
  // would land after paint — one frame showing another target source's Regions and answers as
  // settled fact. Same idiom as `useInstallationStatus`.
  const [activeId, setActiveId] = useState(targetSourceId);
  if (targetSourceId !== activeId) {
    setActiveId(targetSourceId);
    setSnapshot(null);
    setFailed(false);
    setWriteError(null);
    setReopened(null);
    setEditing(false);
  }

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const [upload, definition] = await Promise.all([
        getSduUpload(targetSourceId, { signal }),
        // The 대상 count per Region comes from 1단계's targets — the firewall response carries
        // the path, never how many databases ride it.
        getSduDefinition(targetSourceId, { signal }),
      ]);
      if (signal?.aborted) return;
      setFailed(false);
      setSnapshot({ upload, definition });
    },
    [targetSourceId],
  );

  const reload = useCallback(
    () =>
      load().catch(() => {
        setFailed(true);
      }),
    [load],
  );

  useAbortableEffect(
    (signal) =>
      load(signal).catch(() => {
        if (signal.aborted) return;
        setFailed(true);
      }),
    [load],
  );

  /**
   * Every write is followed by a re-read: which gates are open is the server's computation,
   * not this screen's. Rethrows so the block that asked can tell a saved answer from a lost
   * one — the message is already on screen by then.
   */
  const write = useCallback(
    async (run: () => Promise<void>) => {
      setWriteError(null);
      try {
        await run();
      } catch {
        setWriteError(t.writeError);
        throw new Error('sdu upload write failed');
      }
      setReopened(null);
      await reload();
    },
    [reload, t],
  );

  if (editing) {
    // The trip to 1단계 and back is client-side only — no status moves, so this is a swap of
    // what the card shows, not a navigation.
    return (
      <SduStep1Define
        project={project}
        onProjectUpdate={onProjectUpdate}
        mode="return"
        onReturn={() => {
          setEditing(false);
          void reload();
        }}
      />
    );
  }

  const done = snapshot ? gateDoneStates(snapshot.upload) : null;
  const current = snapshot && done ? currentGate(snapshot.upload, done) : null;
  const openId: SduGateId | null = reopened && done?.[reopened] ? reopened : current;

  const stateOf = (id: SduGateId): GateState =>
    done?.[id] ? 'done' : id === current ? 'current' : 'waiting';

  const toggle = (id: SduGateId) => () =>
    setReopened((previous) => (previous === id ? null : id));

  const secondaryAction = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(buttonStyles.ghostText, textColors.tertiary)}
    >
      {label}
    </button>
  );

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cardStyles.header}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={cardStyles.stepTag}>{t.stepTag}</span>
            <h2 className={cardStyles.cardTitle}>{t.cardTitle}</h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            {done && (
              <span className={cn(textStyles.bodyStrong, textColors.secondary)}>
                {t.doneCount(doneCount(done))}
              </span>
            )}
            {/* 되돌아가기는 가능해야 하지만 권하는 행동은 아니다 — 이 카드의 채운 버튼은
                펼쳐진 블록 안에 있고, 이 자리는 ghost 무게로 둔다. */}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={getButtonClass('ghost', 'sm')}
            >
              {t.editTargets}
            </button>
          </div>
        </div>
        <p className={cn('mt-3', cardStyles.guidance)}>{t.guidance}</p>
      </header>

      <div className={cardStyles.body}>
        {failed && !snapshot && (
          <ErrorState message={t.loadError} onRetry={() => void reload()} />
        )}
        {!failed && !snapshot && <GateSkeleton />}

        {snapshot && done && (
          <>
            <InvalidationBanner invalidation={snapshot.upload.invalidation} />
            {writeError && (
              <p role="alert" className={cn('mb-4', textStyles.body, statusColors.error.textDark)}>
                {writeError}
              </p>
            )}
            {/* 스냅샷이 있으면 위의 실패 화면은 그려지지 않는다 — 그때 이 줄이 없으면 다시
                읽기에 실패한 화면과 성공한 화면이 똑같이 보인다. 낡은 값을 낡았다고 말한다. */}
            {failed && (
              <p role="alert" className={cn('mb-4', textStyles.body, statusColors.error.textDark)}>
                {t.staleNotice}{' '}
                <button type="button" onClick={() => void reload()} className="underline">
                  {t.retry}
                </button>
              </p>
            )}

            <div className="flex flex-col gap-3">
              <GateBlock
                index={1}
                title={gateTitle.firewall}
                state={stateOf('firewall')}
                open={openId === 'firewall'}
                onToggle={done.firewall ? toggle('firewall') : undefined}
                summary={regionAckSummary(
                  t,
                  snapshot.upload.regions,
                  snapshot.upload.firewall.acked,
                )}
              >
                {/* 접힌 줄에 보조 동작이 없는 유일한 블록이다 — 되돌아갈 이유가
                    「다시 답한다」 하나뿐이라 머리를 눌러 펴는 것으로 충분하다. */}
                <FirewallBlock
                  regions={snapshot.upload.regions}
                  firewall={snapshot.upload.firewall}
                  targets={snapshot.definition.targets}
                  onAnswer={(confirmed) => write(() => putSduFirewallAck(targetSourceId, confirmed))}
                />
              </GateBlock>

              <GateBlock
                index={2}
                title={gateTitle.recipients}
                state={stateOf('recipients')}
                open={openId === 'recipients'}
                onToggle={done.recipients ? toggle('recipients') : undefined}
                summary={recipientsSummary(t, snapshot.upload.accessKeyRecipients.users)}
                // 끝나지 않은 줄은 펴지지 않는다(`openId` 가 `done` 을 요구한다) — 그런 줄에
                // 버튼을 달면 눌러도 아무 픽셀도 안 바뀐다. 여는 조건과 같은 조건을 쓴다.
                action={
                  done.recipients
                    ? secondaryAction(t.editRecipients, () => setReopened('recipients'))
                    : undefined
                }
              >
                <RecipientsBlock
                  serviceCode={project.serviceCode}
                  recipients={snapshot.upload.accessKeyRecipients.users}
                  onSave={(userIds) => write(() => putSduAccessKeyRecipients(targetSourceId, userIds))}
                />
              </GateBlock>

              <GateBlock
                index={3}
                title={gateTitle.commands}
                state={stateOf('commands')}
                open={openId === 'commands'}
                onToggle={done.commands ? toggle('commands') : undefined}
                summary={regionAckSummary(
                  t,
                  snapshot.upload.regions,
                  snapshot.upload.commands.acked,
                )}
                action={
                  done.commands
                    ? secondaryAction(t.showCommands, () => setReopened('commands'))
                    : undefined
                }
              >
                <UploadCommandsBlock
                  commands={snapshot.upload.commands}
                  onAnswer={(confirmed) => write(() => putSduCommandsAck(targetSourceId, confirmed))}
                />
              </GateBlock>

              <GateBlock
                index={4}
                title={gateTitle.bdc}
                state={stateOf('bdc')}
                open={openId === 'bdc'}
                summary={bdcSummaries(t)[snapshot.upload.bdc.status]}
              >
                <BdcResourceBlock
                  targetSourceId={targetSourceId}
                  bdc={snapshot.upload.bdc}
                  onProjectUpdate={onProjectUpdate}
                />
              </GateBlock>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
