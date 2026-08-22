'use client';

import { useEffect, useState } from 'react';
import { cn, idcStyles, primaryColors, textColors } from '@/lib/theme';
import { ConfirmStepModal, type ConfirmStepResult } from '@/app/components/ui/ConfirmStepModal';
import { approvalFailureCopy } from '@/app/components/ui/confirm-failures';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Ec2InstanceTag, RdsClusterTag } from '@/app/components/ui/RdsInstanceChips';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { Pagination } from '@/app/components/ui/Pagination';
import { LogicalDbCountCell } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbCountCell';
import { usePagination } from '@/app/hooks/usePagination';
import type { ConfirmSubmitPhase } from '@/app/hooks/useConfirmSubmit';
import { getLatestTestConnectionResultSummaries } from '@/app/lib/api';
import { StatTile } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import {
  CELL_LIFT,
  NAME_LIFT,
  ROW_BASE,
  ROW_TARGET,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { isRdsCluster } from '@/lib/rds-instances';
import { toTestUnits, type TestUnit } from '@/lib/resource-grouping';
import { isEc2Instance } from '@/lib/types';
import type { AppErrorCode } from '@/lib/errors';
import type { ConfirmedResource } from '@/lib/types/resources';
import {
  buildLogicalDbCountMap,
  type LogicalDbCountMap,
} from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';

/** 이름 셀과 같은 14px — 모달 안의 표는 머리글부터 한 눈금으로 읽는다. */
const MONO_CELL = 'whitespace-nowrap font-mono text-[14px]';
const PLACEHOLDER = '—';

interface CloudReqApprovalModalProps {
  isOpen: boolean;
  resources: readonly ConfirmedResource[];
  targetSourceId: number;
  /** 지금 그릴 프레임 (useConfirmSubmit). */
  phase: ConfirmSubmitPhase;
  /** 요청이 날아가 있는 동안 — 프레임은 그대로, 버튼만 잠긴다. */
  pending: boolean;
  errorCode?: AppErrorCode;
  onSubmit: () => void;
  /** 다시 요청하기 — 재요청 전에 진행 상태를 다시 읽는다(useConfirmSubmit). */
  onRetry: () => void;
  onClose: () => void;
}

/**
 * 프레임별 결과 문구. 확인 프레임은 건수를 다시 말하지 않는다 — 방금 그 숫자를 보고 누른
 * 사용자에게 같은 수를 되돌려주는 대신, 다음에 무슨 일이 일어나는지만 말한다.
 */
const RESULTS: Record<'success' | 'error', ConfirmStepResult> = {
  success: {
    kind: 'success',
    title: '승인 요청을 보냈어요',
    description: '잠시 후 관리자 승인 대기 단계로 이동해요.',
  },
  error: {
    kind: 'error',
    title: '승인 요청을 보내지 못했어요',
    // 실패가 지운 것이 없다는 말이 먼저다 — 다시 실행해야 하는 줄 알면 사용자는 통과한
    // 회차를 버리고 처음부터 다시 돌린다.
    description: '연결 테스트 결과와 논리 DB 설정은 그대로 남아 있어요.',
  },
};

/**
 * 한 행(= 한 테스트 단위)이 커버하는 논리 DB 수.
 *
 * **단위의 id 로 찾는다**(`TestUnit.unitId` = `resultUnitId`). Athena 는 4단계부터 리전이
 * 리소스라 결과가 `athena_region_resource_id` 한 줄로 달려 오고, 데이터베이스 각자의 id 로는
 * 어떤 결과도 키가 잡히지 않는다. 멤버별로 찾던 동안 접힌 Athena 행은 실행이 그 리전의 수를
 * 보고했는데도 늘 `—` 였다. 다른 타입은 `unitId === resourceId` 라 달라지는 게 없다.
 *
 * 없는 값은 0 이 아니다 — 이번 실행이 이 단위를 말하지 않았으면 null 로 남겨 `—` 를 찍는다.
 */
const unitCounts = (unit: TestUnit, counts: LogicalDbCountMap) =>
  counts.get(unit.unitId) ?? { target: null, excluded: null };

/**
 * 완료 승인 요청 확인 모달 — 1단계 승인 요청과 같은 확인 문법(ConfirmStepModal)이다:
 * 질문형 제목, 원인→결과 한 문장, 통계 타일, 그리고 요청 → 확인 프레임 → 전환.
 *
 * 표는 5단계 카드의 표와 **같은 행 집합**을 그린다(`toTestUnits`). 각자 접으면 한 화면에서
 * 카드가 6건, 모달이 8건이라고 말한다 — 실제로 그랬다. 열만 이 모달의 것이다: 카드가
 * 묻는 것은 "연결됐나"이고, 여기서 묻는 것은 "어떤 논리 DB 구성으로 확정할 것인가"다.
 */
export const CloudReqApprovalModal = ({
  isOpen,
  resources,
  targetSourceId,
  phase,
  pending,
  errorCode,
  onSubmit,
  onRetry,
  onClose,
}: CloudReqApprovalModalProps) => {
  // 최신 실행의 리소스별 논리 DB 수(연동 / 제외). 비어 있다는 것은 **아직 못 읽었거나
  // 이번 실행이 말하지 않았다**는 뜻이고, 둘 다 0 이 아니다 — 합계가 0 에서 시작하던
  // 시절 이 모달은 응답을 기다리는 2초 동안 "제외한 논리 DB 0개"라고 단정했다.
  const [counts, setCounts] = useState<LogicalDbCountMap>(() => new Map());
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void getLatestTestConnectionResultSummaries(targetSourceId, { signal: controller.signal })
      .then((summaries) => {
        if (controller.signal.aborted) return;
        setCounts(buildLogicalDbCountMap(summaries));
      })
      .catch(() => {
        // 조회 실패는 빈 결과가 아니다 — 맵을 비운 채 둬서 모든 수가 `—` 로 남는다.
      });
    return () => controller.abort();
  }, [isOpen, targetSourceId]);

  const units = toTestUnits(resources);
  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(units, {
    initialPageSize: 5,
  });

  // 합계는 읽은 것에서만 나온다 — **0 이 아니라 null 에서 시작한다.** 0 에서 시작하면
  // 아직 아무것도 안 읽은 상태가 "0개" 라는 사실이 되고, 그게 이 모달의 원래 버그였다.
  const totals = units.reduce<{ target: number | null; excluded: number | null }>(
    (acc, unit) => {
      const c = unitCounts(unit, counts);
      return {
        target: c.target == null ? acc.target : (acc.target ?? 0) + c.target,
        excluded: c.excluded == null ? acc.excluded : (acc.excluded ?? 0) + c.excluded,
      };
    },
    { target: null, excluded: null },
  );

  const failure = approvalFailureCopy(errorCode);

  return (
    <ConfirmStepModal
      open={isOpen}
      onClose={onClose}
      onConfirm={onSubmit}
      isPending={pending}
      result={
        phase === 'success'
          ? RESULTS.success
          : phase === 'error'
            ? { ...RESULTS.error, reason: failure.reason }
            : null
      }
      onRetry={failure.retry ? onRetry : undefined}
      title="연동 완료 승인을 요청할까요?"
      description={
        <>
          <span className={primaryColors.text}>
            연동 대상 {units.length}건의 연결 테스트 결과로 완료 승인을 요청해요
          </span>
          . 요청 후에는 관리자 검토가 시작되고, 변경하려면 요청을 취소하고 다시 제출해야 해요.
        </>
      }
      confirmLabel="요청하기"
      size="lg"
    >
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="연동 대상" value={units.length} unit="건" scale="dialog" />
        <StatTile label="연동 논리 DB" value={totals.target} unit="개" scale="dialog" />
        <StatTile label="제외한 논리 DB" value={totals.excluded} unit="개" scale="dialog" />
      </div>

      <div className="mt-4">
        {/* 카드 안의 표는 카드가 이미 테두리를 주므로 CONNECTED_FRAME 을 쓰지만, 여기서는
            표가 스스로 판이다 — 단, 아래를 페이지 바가 닫으므로 `frame` 이 아니라
            `framePaged` 다. `frame` 은 제 12px 라운드로 아래를 닫고 그림자를 바 위에
            드리워, 바가 이어진 게 아니라 끝난 카드 밑에 매달린 것처럼 보였다.
            overflow-hidden 과 안쪽의 overflow-x-auto 는 서로 다른 요소에 둔다: 한 요소에
            두 값을 쓰면 어느 쪽이 이길지 Tailwind 의 emit 순서가 정한다. */}
        <div className={idcStyles.table.framePaged}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={idcStyles.table.approvalHeaderDialog}>
                {/* 5단계 카드와 같은 순서 — 정체성(이름) → 속성(종류·리전) → 이 화면이 묻는 것. */}
                <tr className="whitespace-nowrap">
                  <th className={cn(idcStyles.table.approvalHeaderCell, idcStyles.table.nameCell)}>
                    Resource Name
                  </th>
                  <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
                  <th className={idcStyles.table.approvalHeaderCell}>Region</th>
                  {/* 6·7단계 표(WaitingApprovalTable · IdcResourceTable)와 같은 어휘다.
                      전에는 앞 열이 `논리 DB 개수` 라는 이름으로 연동 + 제외의 **합**을
                      찍었는데, 위의 타일은 같은 이름으로 연동만 세고 있어서 한 모달이 두
                      수를 말했다. deny 모델에서 제외 목록은 정책이지 스캔의 부분집합이
                      아니라, 그 합은 애초에 무엇의 개수도 아니다. */}
                  <th className={cn(idcStyles.table.approvalHeaderCell, 'text-right')}>연동 논리 DB</th>
                  <th className={cn(idcStyles.table.approvalHeaderCell, 'text-right')}>연동 제외</th>
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {pageRows.map((unit) => {
                  const [first] = unit.members;
                  const c = unitCounts(unit, counts);
                  // 태그가 붙는 행만 두 줄이다 — 안 붙는 행은 이미 가운데에 있다.
                  const stackedIdentity =
                    isRdsCluster(unit.resourceType ?? '') || isEc2Instance(unit.resourceType);
                  return (
                    <tr key={unit.unitId} className={cn(ROW_BASE, ROW_TARGET)}>
                      <td
                        className={cn(
                          idcStyles.table.approvalCell,
                          idcStyles.table.nameCell,
                          'font-mono text-[14px]',
                          textColors.primary,
                          NAME_LIFT,
                        )}
                      >
                        {unit.folded ? (
                          // 접힌 행은 리전을 가리키므로 리소스 이름이 없다. 엔진 이름을 쓰되
                          // 몇 개를 덮고 있는지 같이 말한다 — 카드에서는 펼쳐 볼 수 있지만
                          // 여기서는 없으므로, 말해 주지 않으면 데이터베이스가 조용히 사라진다.
                          <span className="flex min-w-0 flex-col items-start gap-1">
                            <span className="whitespace-nowrap">
                              {getDatabaseShortLabel(unit.databaseType ?? '')}
                            </span>
                            {/* 한 개짜리 리전에는 붙이지 않는다 — 접힌 것이 없으므로 알릴
                                것도 없고, 없는 알림 때문에 행만 두 줄이 된다. */}
                            {unit.members.length > 1 && (
                              <span
                                className={cn(
                                  'whitespace-nowrap font-sans text-[12px] font-medium',
                                  textColors.tertiary,
                                )}
                              >
                                데이터베이스 {unit.members.length}개
                              </span>
                            )}
                          </span>
                        ) : (
                          // 한 줄 고정 — 가장 긴 이름은 네 줄까지 감겨 행 높이를 들쭉날쭉하게
                          // 만들었다. 전체 값은 툴팁에, 1·2·3단계와 같은 처리다.
                          <span
                            className={cn(
                              'flex min-w-0 flex-col items-start gap-1',
                              stackedIdentity && idcStyles.table.stackedIdentityLift,
                            )}
                          >
                            {isRdsCluster(unit.resourceType ?? '') && <RdsClusterTag />}
                            {isEc2Instance(unit.resourceType) && <Ec2InstanceTag />}
                            <Tooltip
                              content={
                                <IdentifierTip label="Resource Name" value={first.resourceName ?? ''} />
                              }
                              variant="value"
                              size="md"
                              triggerClassName="min-w-0 max-w-[200px] block"
                              truncatedOnly
                            >
                              <span className="block truncate">
                                {first.resourceName || PLACEHOLDER}
                              </span>
                            </Tooltip>
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          idcStyles.table.approvalCell,
                          'text-[14px]',
                          textColors.secondary,
                          CELL_LIFT,
                        )}
                      >
                        {unit.databaseType ? getDatabaseShortLabel(unit.databaseType) : PLACEHOLDER}
                      </td>
                      <td
                        className={cn(
                          idcStyles.table.approvalCell,
                          MONO_CELL,
                          textColors.secondary,
                          CELL_LIFT,
                        )}
                      >
                        {unit.region || PLACEHOLDER}
                      </td>
                      {/* 6·7단계 표가 이 두 열에 쓰는 셀 그대로다. 보고되지 않은 수는 0 이
                          아니라 — 로 나가고(그 리소스에 논리 DB 가 없다는 뜻이 아니라 이번
                          실행이 그 수를 말하지 않았다는 뜻이다), 두 열 다 중립색이다 —
                          어느 쪽이 연동이고 어느 쪽이 제외인지는 머리글이 이미 말했다. */}
                      <td className={cn(idcStyles.table.approvalCell, 'text-right')}>
                        <LogicalDbCountCell count={c.target} label="연동 논리 DB" />
                      </td>
                      <td className={cn(idcStyles.table.approvalCell, 'text-right')}>
                        <LogicalDbCountCell count={c.excluded} label="연동 제외 논리 DB" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {units.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={units.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            // 기본 옵션은 10 부터라 5 는 목록에 없었다 — select 가 실제 페이지 크기를
            // 고를 수 없으니 첫 옵션을 그렸고, 바는 "표시 10 건씩 · 1–5 / 전체 6건"
            // 이라고 스스로를 반박했다. 모달 크기의 목록은 ScanHistoryModal 과 같은 [5, 10].
            pageSizeOptions={[5, 10]}
          />
        )}
      </div>
    </ConfirmStepModal>
  );
};
