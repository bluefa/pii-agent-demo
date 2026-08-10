'use client';

import { Modal } from '@/app/components/ui/Modal';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { SpreadsheetIcon } from '@/app/components/ui/icons';
import { bgColors, borderColors, cn, idcStyles, textColors } from '@/lib/theme';
import type { IdcResourceView } from '@/app/lib/api/idc';
import {
  downloadFirewallRequestCsv,
  firewallRequestFileName,
  toFirewallRequestRows,
} from '@/app/target-sources/[targetSourceId]/_components/idc/firewall-request';

interface IdcFirewallRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 확정/승인된 연동 대상 (DR7 — 주입받고 여기서 조회하지 않는다). */
  resources: readonly IdcResourceView[];
  /** 내려받는 파일 이름에 들어간다. */
  targetSourceId: number;
}

/**
 * 방화벽 오픈 요청 정보 (Step 3·4 공용).
 *
 * 무엇을 열어야 하는지만 말하는 화면이다. 오픈 여부(판정)는 설치가 시작된 뒤에야 생기고,
 * 그건 Step 4 의 `IdcFirewallModal` 이 맡는다 — 그쪽은 리소스 단위 판정, 이쪽은 정책 단위 요청이라
 * 행의 단위 자체가 다르다.
 *
 * 행은 Source IP × 접속 주소로 전개된다: 한 줄이 방화벽 정책 한 건이어야 화면과 내려받은
 * 파일이 같은 것을 말하고, 그 파일을 그대로 담당자에게 낼 수 있다.
 */
export const IdcFirewallRequestModal = ({
  isOpen,
  onClose,
  resources,
  targetSourceId,
}: IdcFirewallRequestModalProps) => {
  const rows = toFirewallRequestRows(resources);
  const targetCount = resources.filter((resource) => !resource.excluded).length;

  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(rows, {
    initialPageSize: 10,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="방화벽 오픈 요청 정보"
      subtitle="아래 경로에 대해 방화벽 오픈을 요청해 주세요. 한 줄이 방화벽 정책 한 건입니다."
      /* 6열 — 2xl(672px)에서는 비고 헤더가 두 줄로 쪼개졌다. 같은 열 수를 가진
         승인 요청 상세와 같은 폭을 쓴다. */
      size="3xl"
      chrome="toss"
      /* 표가 이미 자기 테두리로 끝나고 그 아래 페이저까지 한 덩어리라, 푸터 위 실선은
         같은 경계를 두 번 긋는다 — 버튼이 별개 판처럼 떨어져 보였다. */
      footerDivider={false}
      /* 푸터의 「확인」이 이미 나가는 길이다 — 머리에 ✕ 를 하나 더 두면 같은 동작이
         두 자리를 갖는다. 배경 클릭과 ESC 도 그대로 닫는다. */
      closeButton={false}
      footer={
        /* 두 버튼은 우측에 모인다 — 이 앱의 모달 푸터 여섯 개가 모두 그렇고, 양 끝으로
           가르면 홀로 선 다운로드 버튼이 실제보다 커 보였다(오너 지적). */
        <>
          <button
            type="button"
            className={idcStyles.modalBtn.outlinePrimary}
            disabled={rows.length === 0}
            onClick={() =>
              downloadFirewallRequestCsv(rows, firewallRequestFileName(targetSourceId))
            }
          >
            <SpreadsheetIcon className="h-4 w-4" />
            Excel 다운로드
          </button>
          <button type="button" className={idcStyles.modalBtn.primary} onClick={onClose}>
            확인
          </button>
        </>
      }
    >
      {rows.length === 0 ? (
        <div className={cn('px-2 py-8 text-center text-sm', textColors.tertiary)}>
          요청할 연동 대상이 없습니다.
        </div>
      ) : (
        <>
          {/* 두 숫자가 다른 것이 정보다 — 대상 하나가 정책 여러 건으로 늘어난다는 사실이
              전개를 화면에서 보여줘야 하는 이유다. */}
          <p className={cn('mb-3 text-[12px] tabular-nums', textColors.secondary)}>
            연동 대상 {targetCount}건 · 방화벽 정책{' '}
            <strong className={cn('font-bold', textColors.primary)}>{rows.length}건</strong>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={idcStyles.table.header}>
                <tr>
                  <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Source IP</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[30px]')} aria-hidden="true" />
                  {/* 폭을 선언하지 않는 유일한 열 — 남는 폭은 가장 긴 값(도메인)이 가져간다. */}
                  <th className={idcStyles.table.headerCell}>접속 주소</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[80px]')}>Port</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Database Type</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[200px]')}>비고</th>
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {pageRows.map((row) => (
                  <tr
                    key={`${row.sourceIp}→${row.host}:${row.port}`}
                    className={idcStyles.table.row}
                  >
                    <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                      {row.sourceIp}
                    </td>
                    <td className={cn(idcStyles.table.cell, 'text-center', textColors.tertiary)}>
                      →
                    </td>
                    <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                      {row.host}
                    </td>
                    {/* 0 은 "payload 에 port 없음" 이지 포트가 아니다 — 대시가 그 사실을 말한다. */}
                    <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                      {row.port || <span className={textColors.tertiary}>—</span>}
                    </td>
                    {/* 색을 명시한다 — 선언하지 않으면 모달 본문의 옅은 회색을 물려받아
                        같은 행의 다른 칸보다 흐려진다. */}
                    <td className={cn(idcStyles.table.cell, 'text-sm', textColors.secondary)}>
                      {row.databaseType}
                    </td>
                    {/* 도메인 대상만 값을 갖는다. 없는 칸은 비워 둔다 — 대시는 노이즈만 남긴다. */}
                    <td className={idcStyles.table.cell}>
                      {row.note && (
                        <span className={cn(idcStyles.tag.base, idcStyles.tag.orange)}>
                          {row.note}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={rows.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </>
      )}
    </Modal>
  );
};

/**
 * 「방화벽 오픈 요청 정보」 트리거 — Step 3·4 가 같은 버튼을 카드 제목 우측에 둔다.
 * 스타일은 Step 4 방화벽 단계의 「방화벽 확인」 버튼 그대로다.
 */
export const IdcFirewallRequestButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'text-xs font-bold px-3 py-1.5 rounded-lg border',
      borderColors.default,
      textColors.secondary,
      bgColors.mutedHover,
    )}
  >
    방화벽 오픈 요청 정보
  </button>
);
