'use client';

/**
 * 담당자 확인 card — 담당자가 2단계에서 무엇에 답했는가(계약 §5).
 *
 * 형제는 `SduDefinitionCard`(§3 정의)와 `SduRecipientsCard`(§6 수신자)다. 셋이 카드로
 * 갈린 이유는 위계다 — 한 카드 안의 절 셋을 제목 굵기로만 가르면 절 제목과 kv 라벨이
 * 형제로 읽힌다(오너 결정).
 *
 * ⛔ 회차별 「응답 이력」 표는 만들지 않는다(§9.1). 답이 대상 소스 단위 하나가 된 뒤로
 * 회차는 `예 → 아니오 → 예` 뿐이라, 그것을 위해 누적 로그를 세우는 것은 값에 비해 비싸다.
 * 승인 조건 ①이 실제로 읽는 것도 **현재 상태**다.
 *
 * **BDC 구축 완료 처리도 이 카드가 진다** (2026-08-30 델타). 완료의 전제가 바로 이 카드가
 * 그리는 두 확인이고(델타 §4), 그 단언이 대상 소스를 5단계로 밀어낸다 — 조건을 읽는 자리와
 * 그 조건 위에서 누르는 자리가 같아야 관리자가 두 화면을 오가지 않는다.
 */
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { getSduUpload, putSduBdcCompletion } from '@/app/lib/api/sdu';
import {
  SDU_REGION_LABEL,
  sduAckAnswer,
  sduAckLabel,
  type SduRecipient,
  type SduUpload,
} from '@/lib/types/sdu';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { SduBdcCompleteModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduBdcCompleteModal';

/** 확인 답변이 무효화된 이유 — §3.1 이 정한 두 원인만 말한다. */
const NOTE_WARN =
  'flex flex-col gap-1 rounded-lg px-3.5 py-3 mt-4 text-[14px] leading-[1.5] bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]';

const KV_GRID = 'grid grid-cols-[140px_1fr] items-baseline gap-x-4 gap-y-2.5 mt-4';

/** 두 확인과 BDC 사이의 이음매. BDC 는 담당자가 답한 것이 아니라 그 답들 **위에서** 일어난
 *  일이라, 같은 kv 격자에 넣으면 세 번째 확인 답변으로 읽힌다. */
const BDC_BLOCK = 'mt-5 border-t border-[var(--pl-border)] pt-4';

/** 완료 단언의 두 방향 — 계약이 하나의 값으로 말하듯 화면도 한 자리에서 갈린다. */
const BDC_LABEL: Record<SduUpload['bdc']['status'], string> = {
  NOT_STARTED: '대기 중',
  IN_PROGRESS: '진행 중',
  COMPLETED: '구축 완료',
};

function KvRow({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <>
      <dt className={pipelineStyles.text.kvKey}>{label}</dt>
      <dd className={pipelineStyles.text.kvValue}>{children}</dd>
    </>
  );
}

/** 답 + 그 답을 남긴 사람·시각. 미답에는 붙일 사람도 시각도 없다. */
function AckValue({
  ack,
}: {
  ack: { acked: boolean; ackedAt: string | null; ackedBy: SduRecipient | null };
}): ReactElement {
  const answer = sduAckAnswer(ack);
  const stamp = [ack.ackedBy?.name, ack.ackedAt ? fmtDateTime(ack.ackedAt) : null].filter(
    (part): part is string => part != null && part !== '',
  );
  return (
    <>
      {sduAckLabel(answer)}
      {answer !== null && stamp.length > 0 && (
        <>
          {/* 구분자는 **글자 흐름 안**에 있어야 한다. 여백(ml-2)만으로 가르면 눈에는
              갈라져 보여도 텍스트로는 「예홍길동」 한 낱말이 되고, 낭독도 그렇게 된다. */}
          {' · '}
          <span className={pipelineStyles.text.meta}>{stamp.join(' · ')}</span>
        </>
      )}
    </>
  );
}

export interface SduAckCardProps {
  targetSourceId: number;
  /**
   * BDC 완료/되돌리기가 저장됐다 — 뷰가 **process-status 를 다시 읽는다.** 화면은 단계를
   * 스스로 옮기지 않는다(델타 §3): 서버가 무엇으로 정했는지는 다시 읽어야만 안다.
   */
  onBdcChanged?: () => void;
}

export function SduAckCard({ targetSourceId, onBdcChanged }: SduAckCardProps): ReactElement {
  const [upload, setUpload] = useState<SduUpload | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /** 쓰기가 끝날 때마다 오른다 — 이 카드의 조회를 다시 돌리는 유일한 손잡이다. */
  const [reloadKey, setReloadKey] = useState(0);
  const [confirming, setConfirming] = useState<'complete' | 'rollback' | null>(null);
  const toast = usePlToast();

  useAbortableEffect(
    (signal) => {
      setLoaded(false);
      setFailed(false);
      return getSduUpload(targetSourceId, { signal })
        .then((data) => {
          if (signal.aborted) return;
          setUpload(data);
          setLoaded(true);
        })
        .catch(() => {
          // 취소는 실패가 아니다 — 대상이 바뀔 때마다 오류 문구가 스쳐 간다.
          if (signal.aborted) return;
          setFailed(true);
          setLoaded(true);
        });
    },
    [targetSourceId, reloadKey],
  );

  // 단언이 무엇이 됐는지는 **서버가 안다.** 낙관적 갱신 없이 둘 다 다시 읽는다 —
  // 여기서 `bdc.status` 를 손으로 세우면 전제를 못 갖춘 400 뒤에도 완료가 그려진다.
  const reread = useCallback(() => {
    setConfirming(null);
    setReloadKey((key) => key + 1);
    onBdcChanged?.();
  }, [onBdcChanged]);

  const { mutate: rollback, loading: rollingBack } = useApiMutation<void, void>(
    () => putSduBdcCompletion(targetSourceId, false),
    {
      onSuccess: () => {
        toast.show('BDC 구축 완료를 되돌렸습니다.');
        reread();
      },
      onError: () => toast.show('BDC 구축 완료 되돌리기에 실패했습니다.'),
    },
  );

  const invalidation = upload?.invalidation;
  const invalidated =
    invalidation != null && (invalidation.addedRegions.length > 0 || invalidation.uploadIpChanged);

  return (
    <section className={cn(pipelineStyles.card.base, 'flex flex-col')} aria-label="담당자 확인">
      <h2 className={opsStyles.cardTitle}>담당자 확인</h2>
      <p className={opsStyles.cardDesc}>업로드 전에 담당자가 답해야 하는 두 가지입니다.</p>

      {!loaded ? (
        <div className="mt-4 min-h-[72px] flex-1" aria-busy />
      ) : failed || !upload ? (
        <p className={cn(pipelineStyles.text.meta, 'mt-4')}>담당자 확인 정보를 불러오지 못했습니다.</p>
      ) : (
        <>
          <dl className={KV_GRID}>
            <KvRow label="방화벽 결재 확인">
              <AckValue ack={upload.firewall} />
            </KvRow>
            <KvRow label="데이터 업로드 확인">
              <AckValue ack={upload.commands} />
            </KvRow>
          </dl>
          {invalidated && invalidation && (
            // §3.1 — 저장이 이미 받아 둔 답을 비웠다. 이유가 사라지면 담당자도
            // 관리자도 설명 없이 비어 있는 확인 줄을 보게 된다.
            <div className={NOTE_WARN}>
              {invalidation.addedRegions.length > 0 && (
                <span>
                  Region 추가(
                  {invalidation.addedRegions.map((region) => SDU_REGION_LABEL[region]).join(', ')}
                  ) — 방화벽 결재 확인과 데이터 업로드 확인이 초기화됐습니다.
                </span>
              )}
              {invalidation.uploadIpChanged && (
                <span>업로드 IP 변경 — 방화벽 결재 확인이 초기화됐습니다.</span>
              )}
            </div>
          )}

          {/* BDC 구축 — 위의 두 답 **위에서** 일어난 일이라 격자 밖에 선다. 완료는 파생이
              아니라 관리자의 단언이고(델타 §0), 그 단언 하나가 대상 소스를 5단계로 옮긴다. */}
          <div className={BDC_BLOCK}>
            <dl className="grid grid-cols-[140px_1fr] items-baseline gap-x-4">
              <KvRow label="BDC 구축">
                {BDC_LABEL[upload.bdc.status]}
                {upload.bdc.completedAt && (
                  <>
                    {' · '}
                    <span className={pipelineStyles.text.meta}>
                      {fmtDateTime(upload.bdc.completedAt)}
                    </span>
                  </>
                )}
              </KvRow>
            </dl>
            <div className="mt-3.5">
              {upload.bdc.status === 'COMPLETED' ? (
                // 되돌리기는 눌러서 지나가는 자리가 아니다 — 제 확인창을 갖는다.
                <PlButton
                  variant="secondary"
                  disabled={rollingBack}
                  onClick={() => setConfirming('rollback')}
                >
                  구축 완료 되돌리기
                </PlButton>
              ) : (
                <PlButton variant="primary" onClick={() => setConfirming('complete')}>
                  BDC 구축 완료 처리
                </PlButton>
              )}
            </div>
          </div>

          <SduBdcCompleteModal
            targetSourceId={targetSourceId}
            open={confirming === 'complete'}
            onClose={() => setConfirming(null)}
            onCompleted={reread}
          />
          <ConfirmStepModal
            open={confirming === 'rollback'}
            onClose={() => setConfirming(null)}
            onConfirm={() => void rollback()}
            title="BDC 구축 완료를 되돌릴까요?"
            // 무엇이 되돌아가고 무엇이 남는지를 둘 다 말한다 — 단계까지 되돌아간다고 믿으면
            // 관리자는 눌러야 할 때 누르지 않는다 (델타 §3).
            description="BDC 구축 상태만 되돌아가고, 진행 단계는 그대로 남습니다."
            confirmLabel="되돌리기"
            tone="warning"
            isPending={rollingBack}
          />
        </>
      )}
    </section>
  );
}
