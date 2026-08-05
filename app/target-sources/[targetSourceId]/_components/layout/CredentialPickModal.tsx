'use client';

import { useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { SearchIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import { EmptyState } from '@/app/components/ui/state';
import { formatDate } from '@/lib/utils/date';
import type { SecretKey } from '@/lib/types';
import {
  bgColors,
  borderColors,
  cn,
  getButtonClass,
  getInputClass,
  idcStyles,
  interactiveColors,
  numericFeatures,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import {
  matchesQuery,
  sortCredentialRows,
  toCredentialRow,
  type CredentialSortKey,
  type SortDirection,
} from '@/app/target-sources/[targetSourceId]/_components/layout/credential-rows';

/**
 * 한 화면에 5줄. 목록이 20개든 3개든 모달의 높이가 같아야 한다 — 열 때마다 크기가 달라지는
 * 대화상자는 그 자체로 읽는 비용이고, 스크롤로 늘리면 아래쪽 후보는 존재를 모른 채 지나간다.
 */
const PAGE_SIZE = 5;

/** 우측 레일 페이저와 같은 조용한 톤 — 이동 컨트롤은 내용이 아니다. */
const pagerBtnClass = cn(
  'rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
  interactiveColors.underlineTab,
  'disabled:cursor-default disabled:opacity-40',
);

interface CredentialPickModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 무엇을 바꾸는지 — 리소스 이름을 제목 아래에 그대로 적는다. */
  resourceLabel: string;
  /** 현재 배정값 ('' = 미설정). */
  value: string;
  /** GET …/secrets 레코드 — 이름과 생성 시각. */
  options: readonly SecretKey[];
  saving: boolean;
  onSubmit: (next: string) => void;
}

/**
 * 한 리소스의 DB Credential 을 고르는 모달 — 관리자 화면의 Credential 배정과 같은 문법이다
 * (값은 표에서 밑줄 텍스트로 읽고, 수정은 여기서 한 번에 커밋).
 *
 * 라디오 목록이 아니라 표인 이유: 이름이 `{userId}-{name}` 이라 사실이 세 개(누구의 것인지,
 * 무엇인지, 언제 등록됐는지)고, 비슷한 이름을 가르는 것은 그 셋의 비교다. 열이 있으니 정렬도
 * 열이 하고, 페이지는 고정 크기라 후보가 몇 개든 모달은 같은 크기로 열린다.
 *
 * 저장 전에는 아무것도 쓰지 않으므로 열어서 보기만 하는 것은 공짜다.
 */
export const CredentialPickModal = ({
  isOpen,
  onClose,
  resourceLabel,
  value,
  options,
  saving,
  onSubmit,
}: CredentialPickModalProps) => {
  const [picked, setPicked] = useState(value);
  const [query, setQuery] = useState('');
  // 기본 정렬은 등록 시각 최신순 — 방금 만든 Credential 을 쓰러 오는 경우가 가장 흔하다.
  const [sortKey, setSortKey] = useState<CredentialSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);

  const rows = options.map(toCredentialRow);
  const filtered = rows.filter((row) => matchesQuery(row, query));
  const sorted = sortCredentialRows(filtered, sortKey, sortDir);

  // 열릴 때마다 현재 값에서 다시 시작하고, 그 값이 있는 페이지를 편다 — 3페이지에 있는 배정을
  // 1페이지만 보여주면 "아무것도 안 걸려 있다"로 읽힌다.
  const [seededFrom, setSeededFrom] = useState({ isOpen, value });
  if (seededFrom.isOpen !== isOpen || seededFrom.value !== value) {
    setSeededFrom({ isOpen, value });
    setPicked(value);
    setQuery('');
    setSortKey('createdAt');
    setSortDir('desc');
    const index = sortCredentialRows(rows, 'createdAt', 'desc').findIndex((row) => row.name === value);
    setPage(index < 0 ? 0 : Math.floor(index / PAGE_SIZE));
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  // 마지막 페이지가 비어도 표의 높이는 그대로다.
  const filler = Array.from({ length: PAGE_SIZE - pageRows.length });

  const sortBy = (key: CredentialSortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // 시각은 최신순, 글자는 가나다순이 각자의 기본값이다.
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const onQueryChange = (next: string) => {
    setQuery(next);
    setPage(0);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DB Credential 설정"
      // 보조 텍스트는 조용한 한 줄이고, 그 안에서 강조되는 것은 "무엇을 바꾸는가"(대상 리소스)
      // 하나뿐이다. 색이 아니라 굵기와 명도로만 올린다 — 파랑은 저장 CTA 와 선택 행의 몫이다.
      subtitle={
        <>
          <strong className={cn('font-semibold', textColors.primary)}>{resourceLabel}</strong>
          에 사용할 DB 접속 자격 증명을 선택하세요.
        </>
      }
      size="2xl"
      // 닫는 길은 푸터의 취소(그리고 ESC / 배경)뿐 — 헤더의 X 와 취소는 같은 일을 두 번 말한다.
      closeButton={false}
      footer={
        <>
          <button onClick={onClose} className={getButtonClass('secondary')}>
            취소
          </button>
          <button
            onClick={() => onSubmit(picked)}
            disabled={!picked || picked === value || saving}
            className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
          >
            {saving && <LoadingSpinner />}
            저장
          </button>
        </>
      }
    >
      {options.length === 0 ? (
        // 고를 것이 하나도 없는 화면은 표(헤더 + 빈 줄)로 두면 "지금 못 찾은 것"처럼 읽힌다.
        // 조치가 필요한 상태이므로 경고 마크를 달고, 무엇을 해야 하는지까지 적는다.
        <EmptyState
          variant="card"
          icon={<StatusWarningIcon className={cn('h-7 w-7', statusColors.warning.textDark)} />}
          title="등록된 Credential이 없어요"
          description="DB 접속 자격 증명이 아직 하나도 등록되지 않았어요. 관리자에게 등록을 요청해 주세요."
        />
      ) : (
        <div className="flex flex-col">
          {/* 검색은 표에 붙은 툴바다 — 리소스 표(step 2·3)와 같은 문법: 옅은 면, 위쪽만
              라운드, 아래 간격 없음. 떠 있는 입력창은 자기가 무엇을 거르는지 말하지 못한다. */}
          <div
            className={cn(
              'flex flex-wrap items-center gap-[10px] rounded-t-xl px-4 py-3.5',
              bgColors.muted,
            )}
          >
            <div className="relative min-w-[220px] max-w-[360px] flex-[1_1_260px]">
              <SearchIcon
                className={cn(
                  'pointer-events-none absolute left-[10px] top-1/2 h-3.5 w-3.5 -translate-y-1/2',
                  textColors.tertiary,
                )}
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="User ID 또는 Credential 이름 검색"
                aria-label="Credential 검색"
                className={cn(getInputClass(), 'h-8 bg-white py-0 pl-[32px] pr-3 text-[14px]')}
              />
            </div>
            <span className={cn('ml-auto text-[12px]', numericFeatures.tabular, textColors.tertiary)}>
              <strong className={cn('font-semibold', textColors.secondary)}>{sorted.length}</strong>
              {' / '}
              {options.length}개
            </span>
          </div>

          <div className={cn(idcStyles.table.frame, 'rounded-t-none')}>
            <table className="w-full table-fixed">
              <thead className={idcStyles.table.header}>
                <tr>
                  <th className={cn(idcStyles.table.headerCell, 'w-[44px]')}>
                    <span className="sr-only">선택</span>
                  </th>
                  <SortHeader
                    label="User ID"
                    columnKey="userId"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={sortBy}
                    className="w-[150px]"
                  />
                  <SortHeader
                    label="Credential 이름"
                    columnKey="label"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={sortBy}
                  />
                  <SortHeader
                    label="등록 시각"
                    columnKey="createdAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={sortBy}
                    className="w-[168px]"
                  />
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {pageRows.map((row) => {
                  const checked = picked === row.name;
                  return (
                    <tr
                      key={row.name}
                      onClick={() => setPicked(row.name)}
                      // 갈라 놓은 두 칸이 아니라 저장되는 값 그대로를 툴팁으로 단다. 규칙에 맞지
                      // 않는 이름이 섞여 들어와도 실제 값이 무엇인지는 언제나 한 번에 확인된다.
                      title={row.name}
                      className={cn(
                        idcStyles.table.row,
                        'cursor-pointer',
                        checked ? primaryColors.bgLight : bgColors.mutedHover,
                      )}
                    >
                      <td className={cn(idcStyles.table.cell, 'text-center')}>
                        <input
                          type="radio"
                          name="db-credential"
                          value={row.name}
                          checked={checked}
                          onChange={() => setPicked(row.name)}
                          aria-label={`${row.userId ? `${row.userId} ` : ''}${row.label}`}
                          className="h-4 w-4 accent-[#0064FF]"
                        />
                      </td>
                      {/* 행에서 고르는 값은 이름이다. User ID 는 그 이름이 누구 것인지 말하는
                          속성이므로 시각과 같은 보조 단(12/tertiary)에 둔다. */}
                      <td
                        className={cn(
                          idcStyles.table.cell,
                          'truncate font-mono text-[12px]',
                          textColors.tertiary,
                        )}
                      >
                        {row.userId || '—'}
                      </td>
                      <td
                        className={cn(
                          idcStyles.table.cell,
                          'truncate font-mono text-[14px]',
                          textColors.primary,
                          checked ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {row.label}
                      </td>
                      {/* 고르는 대상은 이름이므로 시각은 한 단계 아래에서 읽힌다. */}
                      <td
                        className={cn(
                          idcStyles.table.cell,
                          'text-[12px] font-normal',
                          numericFeatures.tabular,
                          textColors.tertiary,
                        )}
                      >
                        {row.createdAt ? formatDate(row.createdAt, 'datetime') : '—'}
                      </td>
                    </tr>
                  );
                })}
                {/* 빈 줄로 높이를 맞춘다 — 한 건만 걸린 검색에서 모달이 접히지 않게. */}
                {filler.map((_, index) => (
                  <tr key={`filler-${index}`} aria-hidden="true">
                    <td className={idcStyles.table.cell}>&nbsp;</td>
                    <td className={idcStyles.table.cell} />
                    <td className={idcStyles.table.cell} />
                    <td className={idcStyles.table.cell} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            {/* 검색이 현재 값을 걸러내도 무엇이 걸려 있는지는 계속 보인다. */}
            <span className={cn('text-[12px]', textColors.tertiary)}>
              {picked ? (
                <>
                  선택 <strong className={cn('font-semibold', textColors.secondary)}>{picked}</strong>
                </>
              ) : (
                '선택된 Credential이 없어요'
              )}
            </span>
            <div className="inline-flex items-center gap-2">
              {/* 파랑은 이 모달에서 저장 CTA 와 선택된 행에만 쓴다 — 페이지 이동은 강조할
                  내용이 아니라 이동 수단이므로 우측 레일 페이저와 같은 조용한 톤이다. */}
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 0}
                className={pagerBtnClass}
              >
                ‹ 이전
              </button>
              <span className={cn('text-[12px]', numericFeatures.tabular, textColors.tertiary)}>
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount - 1}
                className={pagerBtnClass}
              >
                다음 ›
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

interface SortHeaderProps {
  label: string;
  columnKey: CredentialSortKey;
  sortKey: CredentialSortKey;
  sortDir: SortDirection;
  onSort: (key: CredentialSortKey) => void;
  className?: string;
}

/** 정렬은 열이 한다 — 헤더 자체가 버튼이고, 현재 정렬은 aria-sort 와 화살표 둘 다로 말한다. */
const SortHeader = ({ label, columnKey, sortKey, sortDir, onSort, className }: SortHeaderProps) => {
  const active = sortKey === columnKey;
  return (
    <th
      className={cn(idcStyles.table.headerCell, className)}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1',
          active ? textColors.primary : undefined,
          primaryColors.focusRing,
        )}
      >
        {label}
        <span aria-hidden="true" className={active ? undefined : textColors.quaternary}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
};
