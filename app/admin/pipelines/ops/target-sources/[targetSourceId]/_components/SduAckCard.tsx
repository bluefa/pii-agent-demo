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
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getSduUpload } from '@/app/lib/api/sdu';
import {
  SDU_REGION_LABEL,
  sduAckAnswer,
  sduAckLabel,
  type SduRecipient,
  type SduUpload,
} from '@/lib/types/sdu';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** 확인 답변이 무효화된 이유 — §3.1 이 정한 두 원인만 말한다. */
const NOTE_WARN =
  'flex flex-col gap-1 rounded-lg px-3.5 py-3 mt-4 text-[14px] leading-[1.5] bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]';

const KV_GRID = 'grid grid-cols-[140px_1fr] items-baseline gap-x-4 gap-y-2.5 mt-4';

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
}

export function SduAckCard({ targetSourceId }: SduAckCardProps): ReactElement {
  const [upload, setUpload] = useState<SduUpload | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
    [targetSourceId],
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
        </>
      )}
    </section>
  );
}
