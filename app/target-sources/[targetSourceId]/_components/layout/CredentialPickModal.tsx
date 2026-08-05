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
  cn,
  getButtonClass,
  getInputClass,
  idcStyles,
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
 * 목록의 높이는 후보 수와 무관하게 이 값이다 — 20개든 3개든 모달이 같은 크기로 열린다.
 * 4줄 반이 보이는 높이라, 잘린 줄 자체가 "아래 더 있다"는 표시가 된다(페이저는 그 사실을
 * 숫자로 한 번 더 말해야 했다).
 */
const LIST_MAX_H = 'max-h-[236px]';

/** 표의 모든 값이 쓰는 한 단 — 세 열 사이에 계층을 두지 않는다. */
const cellClass = cn('text-[14px] font-normal', textColors.secondary);

interface CredentialPickModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 무엇을 바꾸는지 — 대상 리소스의 ResourceId. 이름이 아니라 쓰기 대상 그 자체다. */
  resourceId: string;
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
 * 열이 한다. 목록은 고정 높이 스크롤이라 후보가 몇 개든 모달은 같은 크기로 열린다.
 *
 * 저장 전에는 아무것도 쓰지 않으므로 열어서 보기만 하는 것은 공짜다.
 */
export const CredentialPickModal = ({
  isOpen,
  onClose,
  resourceId,
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

  const rows = options.map(toCredentialRow);
  const filtered = rows.filter((row) => matchesQuery(row, query));
  const sorted = sortCredentialRows(filtered, sortKey, sortDir);

  // 열릴 때마다 현재 값에서 다시 시작한다.
  const [seededFrom, setSeededFrom] = useState({ isOpen, value });
  if (seededFrom.isOpen !== isOpen || seededFrom.value !== value) {
    setSeededFrom({ isOpen, value });
    setPicked(value);
    setQuery('');
    setSortKey('createdAt');
    setSortDir('desc');
  }

  const sortBy = (key: CredentialSortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // 시각은 최신순, 글자는 가나다순이 각자의 기본값이다.
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DB Credential 지정"
      // 대상을 문장 안에 끼워 넣으면 리소스 이름이 조사와 붙어 한 덩어리로 읽힌다. 라벨·값·안내
      // 세 단으로 갈라 둔다 — 무엇에 거는지(값)가 안내 문장보다 위에 있어야 한다.
      subtitle={
        <>
          <span className={cn('block text-[12px] font-medium', textColors.tertiary)}>Resource ID</span>
          {/* ARN 은 길어서 두 줄을 넘기기 쉽다 — 14px 로 눕히고 leading 을 좁혀, 값이 헤더를
              차지해 표가 스크롤 뒤로 밀려나지 않게 한다. 단은 mono·굵기·명도로 구분된다. */}
          <span
            className={cn('mt-1 block break-all font-mono text-[14px] font-semibold leading-[1.4]', textColors.primary)}
          >
            {resourceId}
          </span>
          <span className={cn('mt-2 block text-[14px] font-semibold', primaryColors.text)}>
            사용할 DB 접속 자격 증명을 선택하세요.
          </span>
        </>
      }
      chrome="toss"
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
                onChange={(event) => setQuery(event.target.value)}
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

          {/* 목록만 스크롤한다 — 헤더는 sticky 라 정렬 컨트롤이 스크롤 뒤로 사라지지 않는다. */}
          <div className={cn(idcStyles.table.frame, 'rounded-t-none overflow-y-auto', LIST_MAX_H)}>
            <table className="w-full table-fixed">
              <thead className={cn(idcStyles.table.header, 'sticky top-0 z-10')}>
                <tr>
                  <th className={cn(idcStyles.table.headerCell, 'w-[40px]')}>
                    <span className="sr-only">선택</span>
                  </th>
                  <SortHeader
                    label="User ID"
                    columnKey="userId"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={sortBy}
                    className="w-[112px]"
                  />
                  <SortHeader
                    label="Credential 이름"
                    columnKey="label"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={sortBy}
                  />
                  {/* 날짜만 — 비슷한 이름을 가르는 데 분·초까지는 필요 없었고, 시각을 다 적으면
                      두 줄로 접혀 행 높이가 열마다 달라졌다. */}
                  <SortHeader
                    label="등록일"
                    columnKey="createdAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={sortBy}
                    className="w-[128px]"
                  />
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className={cn(idcStyles.table.cell, 'py-8 text-center text-[12px]', textColors.tertiary)}
                    >
                      검색 결과가 없어요.
                    </td>
                  </tr>
                )}
                {sorted.map((row) => {
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
                      {/* 세 칸은 같은 단이다. 어느 행이 골라졌는지는 라디오와 행 배경이 이미
                          말하므로, 굵기까지 얹으면 이름 열만 혼자 떠서 표가 기울어 읽힌다. */}
                      <td className={cn(idcStyles.table.cell, cellClass, 'truncate font-mono')}>
                        {row.userId || '—'}
                      </td>
                      <td className={cn(idcStyles.table.cell, cellClass, 'truncate font-mono')}>
                        {row.label}
                      </td>
                      <td className={cn(idcStyles.table.cell, cellClass, numericFeatures.tabular)}>
                        {row.createdAt ? formatDate(row.createdAt, 'date') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 검색이 현재 값을 걸러내도 무엇이 걸려 있는지는 계속 보인다. */}
          <span className={cn('mt-2 block truncate text-[12px]', textColors.tertiary)}>
            {picked ? (
              <>
                선택 <strong className={cn('font-semibold', textColors.secondary)}>{picked}</strong>
              </>
            ) : (
              '선택된 Credential이 없어요'
            )}
          </span>
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
