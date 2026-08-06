'use client';

/**
 * Credential 배정 modal — one resource, one choice, committed on 저장.
 *
 * A dropdown was the wrong shape at 20-30 credentials: the list is clipped by
 * whatever scrolls around it, the choice commits the instant you click (no way to
 * compare two candidates), and there is no room for the two facts that actually
 * separate near-identical names — 생성 시각 and 배정 건수.
 *
 * Radios, not a list of buttons: the group has exactly one answer including
 * "연결 안 함", the current value is visible without hovering anything, and
 * arrow-key navigation comes from the platform instead of being reimplemented.
 *
 * Nothing is written until 저장, so opening the modal to look is free.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { splitCredentialName } from '@/lib/credentials';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TC_TONE_FILL } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  filterCredentials,
  type CredentialEntry,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const TITLE_ID = 'ops-tc-cred-assign-title';
const NONE = '';

type SortKey = 'userId' | 'label' | 'createdAt' | 'assignedCount';
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null;

/** 표에 그릴 한 행 — 원본 이름은 저장·비교용으로 그대로 들고 간다. */
interface Row extends CredentialEntry {
  userId: string;
  label: string;
}

const toRow = (entry: CredentialEntry): Row => ({ ...entry, ...splitCredentialName(entry.name) });

const sortRows = (rows: readonly Row[], sort: SortState): Row[] => {
  if (!sort) return [...rows];
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    // 같은 값이면 원본 이름으로 한 번 더 가른다 — 정렬이 렌더마다 흔들리지 않게.
    const primary =
      sort.key === 'assignedCount'
        ? a.assignedCount - b.assignedCount
        : sort.key === 'createdAt'
          ? (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
          : a[sort.key].localeCompare(b[sort.key]);
    return (primary || a.name.localeCompare(b.name)) * sign;
  });
};

/** 정렬은 열이 한다 — 헤더 자체가 버튼이고, 현재 정렬은 aria-sort 와 화살표 둘 다로 말한다. */
function SortHead({
  label,
  columnKey,
  sort,
  onSort,
  width,
  align,
}: {
  label: string;
  columnKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  width?: string;
  align?: 'right';
}): ReactElement {
  const active = sort?.key === columnKey;
  return (
    <th
      className={cn(opsStyles.credModal.headCell, width, align === 'right' && 'text-right')}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(opsStyles.credModal.sortBtn, active && opsStyles.credModal.sortOn)}
      >
        {label}
        <span aria-hidden="true">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

export interface CredentialAssignModalProps {
  /** 배정 대상 리소스 — 무엇을 바꾸는지 제목 아래에 그대로 적는다. */
  resourceLabel: string;
  /** 현재 배정값 ('' = 연결 안 함). */
  value: string;
  /** secrets ∪ 배정에만 있는 이름 (배정 건수 포함). */
  entries: readonly CredentialEntry[];
  saving: boolean;
  onSubmit: (next: string) => void;
  onClose: () => void;
}

export function CredentialAssignModal({
  resourceLabel,
  value,
  entries,
  saving,
  onSubmit,
  onClose,
}: CredentialAssignModalProps): ReactElement {
  const [picked, setPicked] = useState(value);
  const [query, setQuery] = useState('');
  // 기본 정렬은 `credentialEntries` 가 이미 매긴 순서(목록에 없음 → 배정 많은 순 → 이름)다.
  // 열을 누르기 전까지는 그 순서를 흐트러뜨리지 않는다.
  const [sort, setSort] = useState<SortState>(null);

  const hits = useMemo(() => filterCredentials(entries, query), [entries, query]);
  // The current value must stay visible even when it does not match the query —
  // otherwise searching makes the modal look like nothing is assigned.
  const pinned = query.trim() && picked !== NONE && !hits.some((entry) => entry.name === picked)
    ? entries.find((entry) => entry.name === picked)
    : undefined;

  const rows = useMemo(
    () => sortRows([...(pinned ? [pinned] : []), ...hits].map(toRow), sort),
    [pinned, hits, sort],
  );

  const sortBy = (key: SortKey) => {
    // 시각·건수는 큰 값부터, 글자는 가나다순이 각자의 기본값이다.
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'userId' || key === 'label' ? 'asc' : 'desc' },
    );
  };

  const dirty = picked !== value;

  return (
    <ModalShell open onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        Credential 배정
      </h3>
      {/* 대상을 문장 안에 끼워 넣으면 리소스 이름이 조사와 붙어 한 덩어리로 읽힌다. 라벨·값·안내
          세 단으로 갈라 둔다 — 무엇에 거는지(값)가 안내 문장보다 위에 있어야 한다. 사용자 화면
          Step 5 의 Credential 모달과 같은 머리 구조다. */}
      <p className={opsStyles.credModal.targetLabel}>Resource</p>
      <p className={opsStyles.credModal.targetValue}>{resourceLabel}</p>
      <p className={pipelineStyles.modal.desc}>사용할 DB 접속 자격 증명을 선택하세요.</p>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Credential 검색 (${entries.length}개)`}
        aria-label="Credential 검색"
        className={opsStyles.credModal.search}
      />

      {/* 라디오를 세로로 쌓지 않고 표로 두는 이유: 이름이 `{userId}-{name}` 이라 사실이 네
          개(누구의 것인지, 무엇인지, 언제 만들었는지, 어디에 이미 쓰이는지)고, 비슷한 이름을
          가르는 것은 그 넷의 비교다. 열이 있으니 정렬도 열이 한다. */}
      <div className={cn(opsStyles.credModal.list, 'mt-3')}>
        <table className="w-full table-fixed border-separate border-spacing-0" role="radiogroup" aria-label="Credential">
          <thead>
            <tr>
              <th className={cn(opsStyles.credModal.headCell, 'w-[36px]')}>
                <span className="sr-only">선택</span>
              </th>
              <SortHead label="User ID" columnKey="userId" sort={sort} onSort={sortBy} width="w-[104px]" />
              <SortHead label="Credential 이름" columnKey="label" sort={sort} onSort={sortBy} />
              <SortHead label="생성 시각" columnKey="createdAt" sort={sort} onSort={sortBy} width="w-[136px]" />
              <SortHead label="배정" columnKey="assignedCount" sort={sort} onSort={sortBy} width="w-[72px]" align="right" />
            </tr>
          </thead>
          <tbody>
            {/* 연결 안 함 is a real choice, not an empty state — it stays put while searching,
                and it is pinned above the sort so it never wanders into the middle. */}
            <tr
              onClick={() => setPicked(NONE)}
              className={cn(opsStyles.credModal.row, picked === NONE && opsStyles.credModal.rowOn)}
            >
              <td className={cn(opsStyles.credModal.cell, 'text-center')}>
                <input
                  type="radio"
                  name="credential"
                  value={NONE}
                  checked={picked === NONE}
                  onChange={() => setPicked(NONE)}
                  aria-label="연결 안 함"
                  className={opsStyles.credModal.radio}
                />
              </td>
              <td className={opsStyles.credModal.cell} colSpan={4}>
                연결 안 함 — 이 리소스에 자격 증명을 배정하지 않습니다
              </td>
            </tr>

            {rows.map((entry) => (
              <tr
                key={entry.name}
                onClick={() => setPicked(entry.name)}
                // 갈라 놓은 두 칸이 아니라 저장되는 값 그대로를 툴팁으로 단다 — 규칙에 맞지
                // 않는 이름이 섞여도 실제 값이 무엇인지는 언제나 한 번에 확인된다.
                title={entry.name}
                className={cn(
                  opsStyles.credModal.row,
                  picked === entry.name && opsStyles.credModal.rowOn,
                )}
              >
                <td className={cn(opsStyles.credModal.cell, 'text-center')}>
                  <input
                    type="radio"
                    name="credential"
                    value={entry.name}
                    checked={picked === entry.name}
                    onChange={() => setPicked(entry.name)}
                    aria-label={entry.name}
                    className={opsStyles.credModal.radio}
                  />
                </td>
                <td className={cn(opsStyles.credModal.cell, 'font-mono')}>{entry.userId || '—'}</td>
                <td className={cn(opsStyles.credModal.cell, 'font-mono')}>
                  {entry.label}
                  {entry.missing && (
                    <span className={cn(opsStyles.statusTag, TC_TONE_FILL.warn, 'ml-1.5')}>
                      목록에 없음
                    </span>
                  )}
                </td>
                <td className={cn(opsStyles.credModal.cell, 'tabular-nums')}>
                  {entry.createdAt ? fmtDateTime(entry.createdAt) : '—'}
                </td>
                {/* 다른 리소스에서 이미 쓰이는지 — 이름이 비슷할 때 가장 잘 구분되는 단서. */}
                <td
                  className={cn(
                    opsStyles.credModal.used,
                    entry.assignedCount === 0 && 'text-[var(--pl-text-faint)]',
                  )}
                >
                  {entry.assignedCount === 0 ? '미배정' : `${entry.assignedCount}건`}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={opsStyles.credModal.empty}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={saving}>
          취소
        </PlButton>
        <PlButton variant="primary" onClick={() => onSubmit(picked)} disabled={!dirty || saving}>
          {saving ? '저장 중…' : '저장'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
