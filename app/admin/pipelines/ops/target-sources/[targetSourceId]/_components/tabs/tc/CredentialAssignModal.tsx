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

  const hits = useMemo(() => filterCredentials(entries, query), [entries, query]);
  // The current value must stay visible even when it does not match the query —
  // otherwise searching makes the modal look like nothing is assigned.
  const pinned = query.trim() && picked !== NONE && !hits.some((entry) => entry.name === picked)
    ? entries.find((entry) => entry.name === picked)
    : undefined;

  const dirty = picked !== value;

  return (
    <ModalShell open onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        Credential 배정
      </h3>
      <p className={pipelineStyles.modal.desc}>
        <span className="font-semibold text-[var(--pl-text-strong)]">{resourceLabel}</span>
        에 사용할 DB 접속 자격 증명을 선택하세요.
      </p>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Credential 검색 (${entries.length}개)`}
        aria-label="Credential 검색"
        className={opsStyles.credModal.search}
      />

      <div
        role="radiogroup"
        aria-label="Credential"
        className={cn(opsStyles.credModal.list, 'mt-3')}
      >
        {/* 연결 안 함 is a real choice, not an empty state — it stays put while searching. */}
        <label className={cn(opsStyles.credModal.row, picked === NONE && opsStyles.credModal.rowOn)}>
          <input
            type="radio"
            name="credential"
            value={NONE}
            checked={picked === NONE}
            onChange={() => setPicked(NONE)}
            className={opsStyles.credModal.radio}
          />
          <span className="min-w-0">
            <span className={opsStyles.credModal.name}>연결 안 함</span>
            <span className={opsStyles.credModal.meta}>이 리소스에 자격 증명을 배정하지 않습니다</span>
          </span>
        </label>

        {[...(pinned ? [pinned] : []), ...hits].map((entry) => (
          <label
            key={entry.name}
            className={cn(
              opsStyles.credModal.row,
              picked === entry.name && opsStyles.credModal.rowOn,
            )}
          >
            <input
              type="radio"
              name="credential"
              value={entry.name}
              checked={picked === entry.name}
              onChange={() => setPicked(entry.name)}
              className={opsStyles.credModal.radio}
            />
            <span className="min-w-0 flex-1">
              <span className={opsStyles.credModal.name}>
                {entry.name}
                {entry.missing && (
                  <span className={cn(opsStyles.statusTag, TC_TONE_FILL.warn, 'ml-1.5')}>
                    목록에 없음
                  </span>
                )}
              </span>
              <span className={opsStyles.credModal.meta}>
                {entry.createdAt ? `생성 ${fmtDateTime(entry.createdAt)}` : '생성 정보 없음'}
              </span>
            </span>
            {/* 다른 리소스에서 이미 쓰이는지 — 이름이 비슷할 때 가장 잘 구분되는 단서. */}
            <span
              className={cn(
                opsStyles.credModal.used,
                entry.assignedCount === 0 && 'text-[var(--pl-text-faint)]',
              )}
            >
              {entry.assignedCount === 0 ? '미배정' : `배정 ${entry.assignedCount}건`}
            </span>
          </label>
        ))}

        {hits.length === 0 && !pinned && (
          <p className={opsStyles.credModal.empty}>검색 결과가 없습니다.</p>
        )}
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
