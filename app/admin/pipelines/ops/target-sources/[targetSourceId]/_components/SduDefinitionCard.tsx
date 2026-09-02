'use client';

/**
 * 연동 대상 정의 card — 담당자가 1단계에서 무엇을 올리겠다고 정했는가(계약 §3).
 *
 * SDU 에는 승인이 없어서(§0, 제출이 곧 1 → 4) 진행 상태 탭의 「승인 요청 내역」은 어느
 * 대상에서도 영원히 빈 표다. 그 자리를 담당자가 입력한 것이 가져간다. 한 카드가 아니라
 * **세 카드**인 이유는 위계다: 한 카드 안에서 절 세 개를 제목 굵기로만 가르면 세 번째
 * 제목(「S3 Access Key 수신자」)이 바로 위 kv 라벨(「방화벽 결재 확인」)과 형제로 읽힌다.
 * 콘솔에 그 사이를 가를 활자 단이 없어서, 카드가 그 일을 한다(오너 결정).
 *
 * 조회도 카드마다 하나다. 정의만 저장하고 아직 제출하지 않은 대상에서는 §5 가 거절되는데,
 * 그때 이 카드는 그대로 서야 한다 — 한 조회의 실패로 둘 다 접으면 화면은 담당자가 아무것도
 * 입력하지 않았다고 말하게 된다. 형제가 각자 조회를 가지면 그 독립은 구조가 보장한다.
 */
import { useState, type ReactElement } from 'react';
import { cn, idcStyles, pipelineStyles } from '@/lib/theme';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getSduDefinition } from '@/app/lib/api/sdu';
import { SDU_REGION_LABEL, type SduDefinition } from '@/lib/types/sdu';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/**
 * 담당자 화면의 방화벽 표(`sdu/upload/FirewallBlock`)와 같은 콘솔 문법이다 — 같은 제품
 * 영역이고, 담당자가 Region 단위로 정의한 같은 데이터 가족이라 두 화면이 다른 표로 보이면
 * 안 된다.
 *
 * `flex` 는 **DB 종류 하나**다. 대상당 20개까지 오므로(계약 §3) 여기만 값이 실제로 길고,
 * 나머지 셋의 `width` 는 제 머리글이 잘리지 않는 바닥이다. 그래서 폭이 남으면 남는 자리는
 * 전부 DB 종류가 가져가고, 모자라면 그 열 안에서 접힌다 — 고정 열 셋을 밀지 않는다.
 *
 * 그룹 머리는 두지 않는다: 함께여야만 뜻이 서는 열 묶음이 없어서, 한 범주 위의 그룹은
 * 장식이 된다.
 *
 * 바닥의 합이 카드 안쪽 폭을 넘으면 `flex` 는 아무것도 못 가져간다 — 남는 폭이 없기 때문이다.
 * 그때 표는 제 스크롤 상자 안에서 가로로 흐르고, DB 종류는 바닥에 붙은 채로 남는다. 그래서
 * 넷의 합(560)을 이 카드의 안쪽 폭(@1440~1600 에서 596px, 실측) 아래로 둔다.
 */
const COLUMNS: ConsoleTableColumn[] = [
  { key: 'cloud', label: '클라우드', width: 96 },
  { key: 'region', label: 'Region', width: 96 },
  { key: 'uploadIp', label: '업로드 IP', width: 148 },
  { key: 'databaseTypes', label: 'DB 종류', width: 220, flex: true },
];

/** `consoleCell` 을 쓰지 않는다 — 그 문법은 잘라 내는 셀이고, DB 종류는 접혀야 한다. */
const CELL = cn(idcStyles.table.approvalCell, 'align-top text-[14px] text-[var(--pl-text-strong)]');

export interface SduDefinitionCardProps {
  targetSourceId: number;
}

export function SduDefinitionCard({ targetSourceId }: SduDefinitionCardProps): ReactElement {
  const [definition, setDefinition] = useState<SduDefinition | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useAbortableEffect(
    (signal) => {
      setLoaded(false);
      setFailed(false);
      return getSduDefinition(targetSourceId, { signal })
        .then((data) => {
          if (signal.aborted) return;
          setDefinition(data);
          setLoaded(true);
        })
        .catch(() => {
          // 취소는 실패가 아니다 — 대상이 바뀔 때마다 「불러오지 못했습니다」가 스쳐 간다.
          if (signal.aborted) return;
          setFailed(true);
          setLoaded(true);
        });
    },
    [targetSourceId],
  );

  return (
    <section className={cn(pipelineStyles.card.base, opsStyles.pagedCard)} aria-label="연동 대상 정의">
      <h2 className={opsStyles.cardTitle}>연동 대상 정의</h2>
      <p className={opsStyles.cardDesc}>담당자가 올리겠다고 정한 대상입니다.</p>

      {/* 옆 칸(연동 현황)과 같은 고정 본문 슬롯 — see opsStyles.pagedCardBody. */}
      <div className={opsStyles.pagedCardBody}>
        {!loaded ? (
          /* 정착본의 `ConsoleTable` 자국 그대로. 머리(열 이름·폭)는 `COLUMNS` 가 이미 아는
             고정 사실이라 실물로 그리고 — 그래서 머리 높이를 여기서 다시 셈하지 않는다 —
             값 자리만 바가 대신한다. 행은 **둘**이다: 정의 하나가 드는 대상은 대개 한 줌이라
             다섯을 예약하면 도착하는 순간 표가 줄어든다.
             높이는 **실측**이다 — 브라우저가 이 표(대상 1100, 대상 2건)의 정착본 머리를
             44.1px, 본문 행을 52.1px 로 보고한다: approvalCell 의 py-4(32) + 14px 글줄(19.6).
             그래서 바가 h-[19.6px] 다. */
          <div aria-busy>
            <span className="sr-only">불러오는 중</span>
            <div className={idcStyles.table.frame}>
              <ConsoleTable columns={COLUMNS}>
                <tbody aria-hidden>
                  {Array.from({ length: 2 }, (_, index) => (
                    <tr key={index}>
                      {['w-[56px]', 'w-[72px]', 'w-[104px]', 'w-[168px]'].map((width) => (
                        <td key={width} className={CELL}>
                          <span className={cn(opsStyles.skeletonBar, 'block h-[19.6px]', width)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </ConsoleTable>
            </div>
            {/* 「마지막 저장」 줄 — 12px 글줄 16.8px. */}
            <span className={cn(opsStyles.skeletonBar, 'mt-2 block h-[17px] w-[180px]')} aria-hidden />
          </div>
        ) : failed ? (
          <p className={pipelineStyles.empty.base}>연동 대상 정의를 불러오지 못했습니다.</p>
        ) : definition && definition.targets.length > 0 ? (
          <>
            {/* 넘치는 폭은 이 상자 안에서 흐른다 — 셸이 제 스크롤 박스를 가지므로 페이지가
                가로로 밀리지 않는다. */}
            <div className={idcStyles.table.frame}>
              <ConsoleTable columns={COLUMNS}>
                <tbody>
                  {definition.targets.map((target) => (
                    <tr key={target.targetId}>
                      <td className={cn(CELL, 'whitespace-nowrap')}>{target.cloud}</td>
                      <td className={cn(CELL, 'whitespace-nowrap')}>
                        {SDU_REGION_LABEL[target.region]}
                      </td>
                      <td className={cn(CELL, 'whitespace-nowrap tabular-nums')}>
                        {target.uploadIp}
                      </td>
                      {/* 대상당 20개까지 온다(계약 §3) — 유일한 `flex` 열이라 남는 폭을
                          가져가고, 모자라면 여기서 접힌다. */}
                      <td className={cn(CELL, 'break-words')}>{target.databaseTypes.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </ConsoleTable>
            </div>
            <p className={cn(pipelineStyles.text.meta, 'mt-2')}>
              {/* 첫 저장 전에는 `updatedAt` 이 null 이다. 그 자리에 '-' 를 찍으면
                  저장된 적 없는 정의가 시각을 잃어버린 정의처럼 읽힌다. */}
              {definition.updatedAt
                ? `마지막 저장 ${fmtDateTime(definition.updatedAt)}`
                : '아직 저장된 적이 없습니다.'}
            </p>
          </>
        ) : (
          <PlEmptyState icon="inbox" message="등록된 연동 대상이 없습니다." />
        )}
      </div>
    </section>
  );
}
