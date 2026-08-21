'use client';

/**
 * 논리 DB 관리 modal — the editable counterpart of the queue's read-only LdbModal.
 * Left panel: tested logical DBs (연동 대상, read-only, one-click prefill of the
 * add form). Right panel: the skip policy draft (연동 제외), editable.
 *
 * The PUT is a FULL REPLACE of the skip list (swagger
 * updateExcludedLogicalDatabasesByResourceId), so the draft here is the complete
 * next policy — removing a row and saving deletes it upstream. `type` is derived
 * from the presence of a schema (DATABASE vs SCHEMA), matching how the Step 5
 * flow serializes its draft; nothing is invented for the operator.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlSelect } from '@/app/admin/pipelines/_components/PlSelect';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import {
  getTestedLogicalDatabases,
  getExcludedLogicalDatabases,
  updateExcludedLogicalDatabases,
  type ExcludedLogicalDatabase,
  type SkipReason,
  type TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';

const TITLE_ID = 'ops-ldb-manage-title';

/** Skip reasons are a contract enum with no Korean labels anywhere — show them raw. */
const SKIP_REASONS: readonly SkipReason[] = ['STG', 'DEV', 'TEMP'];

/** Row identity = database[.schema] — the join key both panels agree on. */
const itemKey = (database: string, schema?: string): string =>
  schema ? `${database}.${schema}` : database;

const excludedKey = (item: ExcludedLogicalDatabase): string =>
  itemKey(item.databaseName, item.schemaName);

/** Stable draft signature — drives the 저장 button's "변경 없음" disabled state. */
const signature = (items: readonly ExcludedLogicalDatabase[]): string =>
  items
    .map((item) => `${excludedKey(item)}|${item.type}|${item.skipReason}`)
    .sort()
    .join(',');

/** Shared with the approval tab's read-only viewer (LdbViewModal) — one grammar,
 *  two modes, so 검토 화면과 편집 화면이 같은 목록을 같은 옷으로 그린다. */
export const ldbPanel = {
  wrap: 'flex min-h-[280px] flex-col rounded-lg border border-[var(--pl-border)]',
  head: 'flex items-center justify-between gap-2 border-b border-[var(--pl-border)] px-3.5 py-2.5',
  title: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  count: 'text-[12px] text-[var(--pl-text-weak)] tabular-nums',
  body: 'max-h-[260px] flex-1 overflow-y-auto px-3.5 py-1',
  row: 'flex items-center justify-between gap-2 border-b border-[var(--pl-gray-100)] py-2 last:border-b-0',
  name: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] break-all',
  action: 'text-[12px] font-semibold text-[var(--pl-primary)] hover:underline whitespace-nowrap',
  remove: 'text-[12px] font-semibold text-[var(--pl-err-text)] hover:underline whitespace-nowrap',
  placeholder: 'py-6 text-center text-[14px] text-[var(--pl-text-faint)]',
} as const;

const panel = ldbPanel;

export interface LdbManageModalProps {
  targetSourceId: number;
  resourceId: string;
  /** Header meta — 연동 대상 label (host/uri) and the DB type tag. */
  resourceLabel: string;
  databaseType: string | null;
  onClose: () => void;
  /** Fired after a successful PUT so the caller can refetch its counts. */
  onSaved: () => void;
}

export function LdbManageModal({
  targetSourceId,
  resourceId,
  resourceLabel,
  databaseType,
  onClose,
  onSaved,
}: LdbManageModalProps): ReactElement {
  const [tested, setTested] = useState<TestedLogicalDatabase[]>([]);
  const [testedFailed, setTestedFailed] = useState(false);
  const [draft, setDraft] = useState<ExcludedLogicalDatabase[]>([]);
  const [baseline, setBaseline] = useState('');
  const [excludedFailed, setExcludedFailed] = useState(false);

  const [database, setDatabase] = useState('');
  const [schema, setSchema] = useState('');
  const [reason, setReason] = useState<SkipReason>('TEMP');
  const [formError, setFormError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== resourceId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [testedList, excludedList] = await Promise.allSettled([
        getTestedLogicalDatabases(targetSourceId, resourceId),
        getExcludedLogicalDatabases(targetSourceId, resourceId),
      ]);
      if (cancelled) return;
      setTested(testedList.status === 'fulfilled' ? testedList.value : []);
      setTestedFailed(testedList.status === 'rejected');
      const excluded = excludedList.status === 'fulfilled' ? excludedList.value : [];
      setDraft(excluded);
      setBaseline(signature(excluded));
      setExcludedFailed(excludedList.status === 'rejected');
      setLoadedKey(resourceId);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, resourceId]);

  const prefill = useCallback((item: TestedLogicalDatabase) => {
    setDatabase(item.databaseName ?? '');
    setSchema(item.schemaName ?? '');
    setFormError(null);
  }, []);

  const add = (): void => {
    const nextDatabase = database.trim();
    const nextSchema = schema.trim();
    if (!nextDatabase) {
      setFormError('Database 이름을 입력해 주세요.');
      return;
    }
    const key = itemKey(nextDatabase, nextSchema || undefined);
    if (draft.some((item) => excludedKey(item) === key)) {
      setFormError('이미 제외 목록에 있습니다.');
      return;
    }
    setDraft((prev) => [
      ...prev,
      {
        databaseName: nextDatabase,
        ...(nextSchema ? { schemaName: nextSchema } : {}),
        // Schema present → SCHEMA scope, otherwise the whole database.
        type: nextSchema ? 'SCHEMA' : 'DATABASE',
        skipReason: reason,
      },
    ]);
    setDatabase('');
    setSchema('');
    setFormError(null);
    setSaved(false);
  };

  const remove = (key: string): void => {
    setDraft((prev) => prev.filter((item) => excludedKey(item) !== key));
    setSaved(false);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setSaveError(null);
    try {
      // The client re-reads the policy through the GET, so the returned list is
      // already the server's own state — adopting it keeps both panels on screen
      // instead of tearing them down for a second round trip.
      const stored = await updateExcludedLogicalDatabases(targetSourceId, resourceId, draft);
      setDraft(stored);
      setBaseline(signature(stored));
      setSaved(true);
      onSaved();
    } catch {
      setSaveError('제외 정책 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const excludedKeys = new Set(draft.map(excludedKey));
  const dirty = signature(draft) !== baseline;

  return (
    <ModalShell
      open
      onClose={onClose}
      variant="xwide"
      labelledBy={TITLE_ID}
      // Two panels + the add form outgrow a short viewport; xwide has no cap of its own.
      className="max-h-[88vh] overflow-y-auto"
    >
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        논리 DB 관리
      </h3>
      <div className="mb-2 flex items-center gap-2">
        {databaseType && (
          <span className={cn(tqStyles.tag.base, tqStyles.tag.blue)}>{getDatabaseShortLabel(databaseType)}</span>
        )}
        <span className={tqStyles.appTable.tdMono}>{resourceLabel}</span>
      </div>
      <p className={pipelineStyles.modal.desc}>
        연동 제외 정책은 저장할 때 목록 전체가 교체됩니다. 목록에서 지운 항목은 제외가 해제됩니다.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className={panel.wrap}>
          <div className={panel.head}>
            <span className={panel.title}>연동 대상 논리 DB</span>
            <span className={panel.count}>{loading ? '' : `${tested.length}개`}</span>
          </div>
          <div className={panel.body}>
            {loading ? (
              <p className={panel.placeholder} aria-busy>
                불러오는 중…
              </p>
            ) : testedFailed ? (
              <p className={panel.placeholder}>연동 대상 목록을 불러오지 못했습니다.</p>
            ) : tested.length === 0 ? (
              <p className={panel.placeholder}>조회된 논리 DB가 없습니다.</p>
            ) : (
              tested.map((item, index) => {
                const key = itemKey(item.databaseName ?? '', item.schemaName);
                const already = excludedKeys.has(key);
                return (
                  <div key={`${key}-${index}`} className={panel.row}>
                    <span className="min-w-0">
                      <span className={panel.name}>{key || '—'}</span>
                      <span className="ml-2 text-[12px] text-[var(--pl-text-faint)]">
                        {item.type ?? (item.schemaName ? 'SCHEMA' : 'DATABASE')}
                      </span>
                    </span>
                    {already ? (
                      <span className="whitespace-nowrap text-[12px] text-[var(--pl-text-faint)]">
                        제외됨
                      </span>
                    ) : (
                      <button type="button" className={panel.action} onClick={() => prefill(item)}>
                        제외 추가
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={panel.wrap}>
          <div className={panel.head}>
            <span className={panel.title}>연동 제외 논리 DB</span>
            <span className={panel.count}>{loading ? '' : `${draft.length}개`}</span>
          </div>
          <div className={panel.body}>
            {loading ? (
              <p className={panel.placeholder} aria-busy>
                불러오는 중…
              </p>
            ) : excludedFailed ? (
              <p className={panel.placeholder}>제외 목록을 불러오지 못했습니다.</p>
            ) : draft.length === 0 ? (
              <p className={panel.placeholder}>제외된 논리 DB가 없습니다.</p>
            ) : (
              draft.map((item) => {
                const key = excludedKey(item);
                return (
                  <div key={key} className={panel.row}>
                    <span className="min-w-0">
                      <span className={panel.name}>{key}</span>
                      <span className={cn(tqStyles.tag.base, tqStyles.tag.gray, 'ml-2')}>
                        {item.skipReason}
                      </span>
                    </span>
                    <button type="button" className={panel.remove} onClick={() => remove(key)}>
                      삭제
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
        <div className="text-[12px] font-semibold text-[var(--pl-text-weak)]">제외 추가</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            aria-label="Database 이름"
            value={database}
            onChange={(event) => {
              setDatabase(event.target.value);
              setFormError(null);
            }}
            placeholder="database"
            autoComplete="off"
            spellCheck={false}
            className={cn(pipelineStyles.input, 'w-[200px] [font-family:var(--pl-font-mono)]')}
          />
          <input
            aria-label="Schema 이름 (선택)"
            value={schema}
            onChange={(event) => {
              setSchema(event.target.value);
              setFormError(null);
            }}
            placeholder="schema (선택)"
            autoComplete="off"
            spellCheck={false}
            className={cn(pipelineStyles.input, 'w-[180px] [font-family:var(--pl-font-mono)]')}
          />
          <PlSelect
            aria-label="제외 사유"
            value={reason}
            onChange={(event) => setReason(event.target.value as SkipReason)}
          >
            {SKIP_REASONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </PlSelect>
          <span className={cn(tqStyles.tag.base, tqStyles.tag.gray)}>
            {schema.trim() ? 'SCHEMA' : 'DATABASE'}
          </span>
          <PlButton variant="secondary" size="sm" onClick={add}>
            추가
          </PlButton>
        </div>
        <p className={cn(pipelineStyles.text.meta, 'mt-2')}>
          Schema를 입력하면 SCHEMA 범위, 비우면 DATABASE 전체가 제외됩니다.
        </p>
        {formError && (
          <p role="alert" className="mt-2 text-[12px] font-medium text-[var(--pl-err-text)]">
            {formError}
          </p>
        )}
      </div>

      {saveError && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-[var(--pl-err-border)] bg-[var(--pl-err-bg)] px-3.5 py-2.5 text-[14px] font-medium text-[var(--pl-err-text)]"
        >
          {saveError}
        </div>
      )}
      {saved && !dirty && !saveError && (
        <p className={cn(pipelineStyles.text.meta, 'mt-3')}>제외 정책을 저장했습니다.</p>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={saving}>
          닫기
        </PlButton>
        <PlButton
          variant="primary"
          onClick={() => void save()}
          // A failed 제외 GET leaves the draft empty, and the PUT is a full replace —
          // saving then would silently wipe a policy we never read.
          disabled={saving || loading || !dirty || excludedFailed}
        >
          {saving ? '저장 중…' : '저장'}
        </PlButton>
      </div>
      {excludedFailed && !loading && (
        <p className={cn(pipelineStyles.text.meta, 'mt-2 text-right')}>
          제외 목록을 불러오지 못했습니다. 기존 정책이 지워질 수 있어 저장할 수 없습니다. 모달을 닫고 다시 열어
          주세요.
        </p>
      )}
    </ModalShell>
  );
}
