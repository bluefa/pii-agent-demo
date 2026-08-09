'use client';

/**
 * 확정 정보 card — the single per-resource table of this tab.
 *
 * Rows come from the confirmed snapshot (GET …/confirmed-integration, snake
 * passthrough per ADR-019). Two joins by `resource_id` fill the trailing columns,
 * each from the endpoint whose contract actually declares it —
 *   Connection Status  latest_version.test_connection_agent_results[] (verdicts)
 *   논리 DB 건수        latest-results (logical_database_count / excluded_…)
 * A resource neither reports on renders — for those columns; nothing is inferred
 * from the snapshot alone (an installed resource is not a tested one).
 *
 * Per-row controls: Credential 배정 (searchable combobox over GET …/secrets — the
 * contract's credential list, whose card sits at the top of the tab) and
 * 논리 DB 관리 (skip policy).
 *
 * Rows/secrets are fetched by TcTab and passed in, because the credential card
 * needs the same two datasets to answer "이 자격 증명이 몇 건에 배정됐나".
 *
 * An absent snapshot (404 before 연동 확정) is an empty state, not an error; a real
 * fetch failure adds a 다시 시도 affordance to that same empty state so the two are
 * never confused with "확정된 리소스가 0건".
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn, idcStyles, pipelineStyles } from '@/lib/theme';
import {
  updateResourceCredential,
  type ConfirmedIntegrationResourceItem,
} from '@/app/lib/api';
import { isEc2Instance, type SecretKey } from '@/lib/types';
import { isRdsCluster } from '@/lib/rds-instances';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { Ec2InstanceTag, RdsClusterTag } from '@/app/components/ui/RdsInstanceChips';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlSelect } from '@/app/admin/pipelines/_components/PlSelect';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TcPill,
  TC_TONE_FILL,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { LdbManageModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/LdbManageModal';
import { TcCredentialModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcCredentialModal';
import { CredentialAssignModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/CredentialAssignModal';
import {
  credentialEntries,
  filterConfirmedRows,
  ldbCount,
  type TcVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** Step 6·7 확정 표와 같은 한 페이지 분량. */
const PAGE_SIZE = 10;

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

/** 빈 값은 옵션이 될 수 없다 — 고를 수 없는 조건은 목록에 두지 않는다. */
const uniqueSorted = (values: readonly string[]): string[] =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

/**
 * Step 6·7 확정 표의 골격을 관리자 토큰으로 옮긴 값들 — 여백·정렬은 그 표(18/16, 옅은 헤더
 * 면, 헤어라인 행)에서 그대로 가져오고, 색·글자는 이 콘솔의 `--pl-*` 를 쓴다. 두 화면이 같은
 * 리소스를 같은 순서로 읽되, 이 카드가 옆 카드들과 다른 톤으로 튀지는 않게 하기 위함이다.
 */
const TABLE_FRAME =
  'overflow-x-auto rounded-b-[10px] border border-t-0 border-[var(--pl-border)]';
/** 툴바는 표에 붙는다 — 사이에 간격을 두면 검색창이 어느 표를 거르는지 말하지 못한다. */
const TOOLBAR =
  'mt-3 flex flex-wrap items-center gap-2 rounded-t-[10px] border border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-4 py-3';
const SEARCH_INPUT =
  'h-8 w-[260px] flex-none rounded-lg border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] px-3 text-[14px] text-[var(--pl-text-strong)] focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)] focus:outline-none';
const HEAD_CELL =
  'whitespace-nowrap px-[18px] py-3 text-left text-[12px] font-medium text-[var(--pl-text-weak)]';
const CELL =
  'border-b border-[var(--pl-gray-100)] px-[18px] py-4 align-middle text-[14px] text-[var(--pl-text-strong)]';

/**
 * 연결 상태 cell — the run's own verdict for this resource, or — if it had none.
 * 네 값 중 하나만 한국어였다(Success / Failed / 진행 중 / Unknown): 같은 열이 같은 질문에
 * 두 언어로 답하고 있었으므로, 사용자 화면 Step 5 가 쓰는 말로 맞춘다.
 */
function ConnCell({ verdict }: { verdict: TcVerdict | undefined }): ReactElement {
  if (!verdict) return <Dash />;
  if (verdict === 'SUCCESS') return <TcPill tone="ok" label="성공" />;
  if (verdict === 'FAIL') return <TcPill tone="err" label="실패" />;
  if (verdict === 'RUNNING') return <TcPill tone="warn" label="진행 중" />;
  return <TcPill tone="off" label="알 수 없음" />;
}

/**
 * Contract-declared count — absent (no TC row / not a success) renders —, never 0.
 * A non-zero count opens the 논리 DB 관리 modal, so it renders as the underlined
 * in-cell link the app uses at Step 6/7 (LogicalDbCountCell): the underline
 * carries the affordance, which lets the row drop its trailing 관리 link entirely.
 * A reported 0 has nothing to open and stays plain text.
 */
function CountCell({
  row,
  tab,
  verdict,
  onOpen,
}: {
  row: TcResultRow | undefined;
  tab: 'inc' | 'exc';
  verdict: TcVerdict | undefined;
  onOpen: () => void;
}): ReactElement {
  const count = ldbCount(row, tab, verdict);
  if (count == null) return <Dash />;
  if (count === 0) return <span className={opsStyles.countZero}>0개</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${tab === 'inc' ? '연동 대상' : '연동 제외'} 논리 DB ${count}개 보기`}
      className={opsStyles.countLink}
    >
      {count}
      <span className="text-[12px] font-medium">개</span>
    </button>
  );
}

/**
 * Resource Name — Step 6·7 확정 표의 정체성 스택: 클러스터·EC2 는 무엇인지를 이름 위
 * 태그로 먼저 말하고, 이름은 한 줄로 자른 뒤 전체 값을 팁에 둔다(잘렸을 때만 뜬다).
 * 태그가 붙은 행만 두 줄이므로, 그 행만 위로 당겨 이름이 이웃 열의 정렬선에 남는다.
 */
function ResourceNameCell({
  value,
  resourceType,
}: {
  value: string | null;
  resourceType: string;
}): ReactElement {
  const cluster = isRdsCluster(resourceType);
  const ec2 = isEc2Instance(resourceType);
  const name = value ? (
    <Tooltip
      content={<IdentifierTip label="Resource Name" value={value} />}
      variant="value"
      size="md"
      triggerClassName="min-w-0 max-w-[200px] block"
      truncatedOnly
    >
      <span className="block truncate font-mono text-[14px]">{value}</span>
    </Tooltip>
  ) : (
    <Dash />
  );
  if (!cluster && !ec2) return name;
  return (
    <span
      className={cn(
        'flex min-w-0 flex-col items-start gap-1',
        idcStyles.table.stackedIdentityLift,
      )}
    >
      {cluster ? <RdsClusterTag /> : <Ec2InstanceTag />}
      {name}
    </span>
  );
}

export interface ConfirmedInfoCardProps {
  targetSourceId: number;
  /** Confirmed snapshot resources (fetched by TcTab). */
  rows: readonly ConfirmedIntegrationResourceItem[];
  /** Contract credential list (fetched by TcTab). */
  secrets: readonly SecretKey[];
  /** 논리 DB 건수 rows (latest-results), joined by resource_id. */
  tcResults: readonly TcResultRow[];
  /** 리소스별 연결 판정 (latest_version), joined by resource_id. */
  verdicts: ReadonlyMap<string, TcVerdict>;
  /** First tab load still in flight. */
  loading: boolean;
  /** Real snapshot fetch failure — a 404 "not confirmed yet" is not one. */
  failed: boolean;
  /** GET …/secrets failed — the credential modal says so instead of showing "0개". */
  secretsFailed: boolean;
  onReload: () => void;
}

export function ConfirmedInfoCard({
  targetSourceId,
  rows,
  secrets,
  tcResults,
  verdicts,
  loading,
  failed,
  secretsFailed,
  onReload,
}: ConfirmedInfoCardProps): ReactElement {
  const toast = usePlToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ldbRow, setLdbRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  const [credRow, setCredRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  // 검색·필터·페이지 — Step 6·7 확정 표가 가진 것과 같은 세 가지. 확정 리소스는 수십 건이라
  // 한 화면에 다 펴 두면 Credential 배정을 하러 온 사람이 자기 행을 눈으로 찾아야 했다.
  const [query, setQuery] = useState('');
  const [dbTypeFilter, setDbTypeFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [page, setPage] = useState(0);

  const tcByResourceId = new Map(tcResults.map((row) => [row.resourceId, row]));

  // 옵션은 셀이 실제로 찍는 문자열이어야 한다 — wire 원문(mysql)을 옵션에 두면 셀의
  // MySQL 과 달라 아무 행도 걸리지 않는다.
  const dbTypeOf = (row: ConfirmedIntegrationResourceItem): string =>
    row.database_type ? getDatabaseShortLabel(row.database_type) : '';
  const dbTypeOptions = useMemo(() => uniqueSorted(rows.map(dbTypeOf)), [rows]);
  const regionOptions = useMemo(
    () => uniqueSorted(rows.map((row) => row.database_region ?? '')),
    [rows],
  );

  const filtered = useMemo(
    () =>
      filterConfirmedRows(rows, { query, dbType: dbTypeFilter, region: regionFilter }, dbTypeOf),
    [rows, query, dbTypeFilter, regionFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // 필터를 좁히면 지금 페이지가 범위 밖으로 나갈 수 있다 — 그대로 쓰면 빈 표가 된다.
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const firstIndex = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;

  // 생성 시각 + 배정 건수 ride along in the assign modal: with 20+ credentials the
  // name alone rarely settles "which one is this", and those are the only other
  // facts available (SecretResponse + the confirmed snapshot join).
  const entries = credentialEntries(secrets, rows);
  const knownCredential = new Set(secrets.map((secret) => secret.name));

  const assignCredential = async (
    row: ConfirmedIntegrationResourceItem,
    credentialId: string,
  ): Promise<void> => {
    setSavingId(row.resource_id);
    try {
      await updateResourceCredential(targetSourceId, row.resource_id, credentialId || null);
      toast.show(credentialId ? 'Credential을 변경했습니다.' : 'Credential 연결을 해제했습니다.');
      setCredRow(null);
      onReload();
    } catch {
      // The modal stays open on failure so the choice is not lost.
      toast.show('Credential 변경에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const { table } = opsStyles;

  return (
    <section className={pipelineStyles.card.base} aria-label="확정 정보">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="install" size={18} className="text-[var(--pl-primary)]" />
            확정 정보
          </h2>
          {/* The cell affordance only appears on hover/focus, so the card says up
              front that the column is editable — otherwise the table reads as a
              read-only report and nobody hovers it. Primary color marks the one
              action in this sentence, not the whole sentence. */}
          <p className={opsStyles.cardDesc}>
            연동이 확정된 리소스별 연결 결과입니다. 순서는 연동 요청(Step 2) 표와 같으며,{' '}
            <b className="font-semibold text-[var(--pl-primary)]">
              Credential 값을 클릭하면 배정을 수정
            </b>
            할 수 있습니다.
          </p>
        </div>
        {/* The credential list is a lookup, not a status — it opens from here,
            where credentials are actually assigned. */}
        <PlButton variant="secondary" className="flex-none" onClick={() => setCredentialsOpen(true)}>
          Credential 목록
        </PlButton>
      </div>

      {loading ? (
        <div className="mt-3" aria-busy>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className={cn(opsStyles.skeleton, 'mt-2 h-10 first:mt-0')}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <span className={pipelineStyles.empty.icon}>
            <Icon name="install" size="xl" />
          </span>
          <p>확정된 연동 정보가 없습니다.</p>
          {failed && (
            <PlButton variant="secondary" size="sm" className="mt-3" onClick={onReload}>
              다시 시도
            </PlButton>
          )}
        </div>
      ) : (
        <>
          {/* 검색 + 두 필터는 표에 붙은 툴바다 — Step 6·7 과 같은 실루엣(옅은 면, 위쪽만
              라운드, 아래 간격 없음). 떠 있는 입력창은 자기가 무엇을 거르는지 말하지 못한다. */}
          <div className={TOOLBAR}>
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Resource ID 또는 Resource Name 검색"
              aria-label="확정 리소스 검색"
              className={SEARCH_INPUT}
            />
            <PlSelect
              aria-label="Database Type 필터"
              value={dbTypeFilter}
              onChange={(event) => {
                setDbTypeFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Database Type 전체</option>
              {dbTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </PlSelect>
            <PlSelect
              aria-label="Region 필터"
              value={regionFilter}
              onChange={(event) => {
                setRegionFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Region 전체</option>
              {regionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </PlSelect>
          </div>
          <div className={TABLE_FRAME}>
            <table className={table.base}>
              {/* Step 2·3·6·7 의 열 순서: 정체성(이름 → id) → 속성(타입 · 리전) → 판정.
                  관리자 전용 두 열(연결 상태 · Credential)은 그 뒤에 붙는다. */}
              <thead className="bg-[var(--pl-gray-50)]">
                <tr>
                  <th className={HEAD_CELL}>Resource Name</th>
                  <th className={HEAD_CELL}>Resource ID</th>
                  <th className={HEAD_CELL}>Database Type</th>
                  <th className={HEAD_CELL}>Region</th>
                  <th className={HEAD_CELL}>연동 대상 논리 DB</th>
                  <th className={HEAD_CELL}>연동 제외 논리 DB</th>
                  <th className={HEAD_CELL}>연결 상태</th>
                  <th className={HEAD_CELL}>Credential</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className={cn(CELL, 'py-10 text-center text-[var(--pl-text-weak)]')}
                    >
                      {FILTER_EMPTY_MESSAGE}
                    </td>
                  </tr>
                )}
                {pageRows.map((row, index) => {
                  const tc = tcByResourceId.get(row.resource_id);
                  const verdict = verdicts.get(row.resource_id);
                  return (
                    <tr key={`${row.resource_id}-${index}`} className={table.rowHover}>
                      <td className={CELL}>
                        <ResourceNameCell
                          value={row.resource_name || null}
                          resourceType={row.resource_type}
                        />
                      </td>
                      <td className={CELL}>
                        {/* Step 1·2·3 grammar: truncated to `Prefix…` like the name
                            column, tip on hover, copy button on row hover. */}
                        {row.resource_id ? (
                          <ResourceIdCell
                            value={row.resource_id}
                            label="Resource ID"
                            maxWidthClass="max-w-[200px]"
                          />
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className={cn(CELL, 'whitespace-nowrap')}>
                        {/* wire 는 소문자 원문(mysql·athena) — 사용자 화면과 같은 표기.
                            타입은 상태가 아니라 분류라 칩(색면)을 쓰지 않는다. */}
                        {row.database_type ? getDatabaseShortLabel(row.database_type) : <Dash />}
                      </td>
                      <td className={cn(CELL, 'whitespace-nowrap font-mono')}>
                        {/* 리전은 한 덩어리다 — 접히면 'ap-northeast-' / '2' 두 값처럼 읽힌다. */}
                        {row.database_region || <Dash />}
                      </td>
                      <td className={CELL}>
                        <CountCell row={tc} tab="inc" verdict={verdict} onOpen={() => setLdbRow(row)} />
                      </td>
                      <td className={CELL}>
                        <CountCell row={tc} tab="exc" verdict={verdict} onOpen={() => setLdbRow(row)} />
                      </td>
                      <td className={CELL}>
                        <ConnCell verdict={verdict} />
                      </td>
                      <td className={CELL}>
                        {/* Credential is addressed by resource id — no id, no assignment. */}
                        {row.resource_id ? (
                          <div className="w-[190px]">
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-label={`${row.resource_name || row.resource_id} Credential 수정 — 현재 ${row.credential_id || '연결 안 함'}`}
                              disabled={savingId === row.resource_id}
                              onClick={() => setCredRow(row)}
                              className={opsStyles.cellAction}
                            >
                              <span
                                className={
                                  row.credential_id
                                    ? opsStyles.cellActionValue
                                    : opsStyles.cellActionEmpty
                                }
                              >
                                {row.credential_id || '연결 안 함'}
                              </span>
                              {/* aria-hidden — the button's own label already says it edits. */}
                              <span aria-hidden className={opsStyles.cellActionHint}>
                                수정
                              </span>
                            </button>
                            {/* An assignment the list no longer carries is stated, not
                                quietly folded in as one more selectable option. */}
                            {row.credential_id && !knownCredential.has(row.credential_id) && (
                              <span
                                className={cn(opsStyles.statusTag, TC_TONE_FILL.warn, 'mt-1 block w-fit')}
                              >
                                목록에 없음
                              </span>
                            )}
                          </div>
                        ) : (
                          <Dash />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* 범위와 페이저는 같은 줄에 — Agent별 결과 목록이 쓰는 문법 그대로다. */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
              {firstIndex}–{safePage * PAGE_SIZE + pageRows.length} / {filtered.length}
              {filtered.length !== rows.length && ` (전체 ${rows.length})`}
            </p>
            <OpsPagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
          <p className={cn(pipelineStyles.text.meta, 'mt-3.5')}>
            연결 상태는 최근 연결 테스트가 리소스별로 보고한 판정이고, 논리 DB 건수는 그중
            성공한 리소스에만 표기합니다. 실행 결과가 없거나 성공하지 않은 리소스는 —(값 없음)으로
            두며, 임의로 성공 처리하지 않습니다. 논리 DB 건수를 누르면 대상·제외 정책을 관리할 수
            있습니다.
          </p>
        </>
      )}

      {credRow && (
        <CredentialAssignModal
          key={`cred-${credRow.resource_id}`}
          resourceLabel={credRow.resource_name || credRow.resource_id}
          value={credRow.credential_id ?? ''}
          entries={entries}
          saving={savingId === credRow.resource_id}
          onSubmit={(next) => void assignCredential(credRow, next)}
          onClose={() => setCredRow(null)}
        />
      )}

      {credentialsOpen && (
        <TcCredentialModal
          secrets={secrets}
          rows={rows}
          failed={secretsFailed}
          onClose={() => setCredentialsOpen(false)}
        />
      )}

      {ldbRow && (
        <LdbManageModal
          key={`ldb-${ldbRow.resource_id}`}
          targetSourceId={targetSourceId}
          resourceId={ldbRow.resource_id}
          resourceLabel={ldbRow.resource_name || ldbRow.resource_id}
          databaseType={ldbRow.database_type}
          onClose={() => setLdbRow(null)}
          onSaved={onReload}
        />
      )}
    </section>
  );
}
