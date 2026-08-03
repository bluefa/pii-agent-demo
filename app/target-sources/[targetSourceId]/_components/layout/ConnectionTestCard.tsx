'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { cardStyles, cn, idcStyles, primaryColors, textColors } from '@/lib/theme';
import { ChevronRightIcon } from '@/app/components/ui/icons';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Pagination } from '@/app/components/ui/Pagination';
import { useModal } from '@/app/hooks/useModal';
import { usePagination } from '@/app/hooks/usePagination';
import { useToast } from '@/app/components/ui/toast';
import {
  ConnProgressStrip,
  type ConnProgressState,
} from '@/app/components/features/process-status/ConnProgressStrip';
import { useTestConnectionPolling } from '@/app/hooks/useTestConnectionPolling';
import { ERROR_MESSAGES } from '@/lib/constants/messages';
import {
  getSecrets,
  updateResourceCredential,
} from '@/app/lib/api';
import type { TestConnectionStatus } from '@/app/lib/api';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { IdcCredSelectCell } from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import { LogicalDbModalLoader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import { CloudReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal';
// This table shows the SAME resources steps 1·2·3 just showed, so it reads in their grammar
// rather than the db-list one: identity first, one line per cell, and the row-hover lifts that
// make a wide row scannable. Admin's request tables already borrow these for the same reason.
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  NAME_LIFT,
  ROW_BASE,
  ROW_TARGET,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import type { ConfirmedResource } from '@/lib/types/resources';
import { needsCredential } from '@/lib/types';
import { GROUPED_CHILD_KIND_LABEL, resultUnitId } from '@/lib/resource-grouping';

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

// Local credential edits — the confirmed list from the BFF seeds these, and Run Test
// persists any change via updateResourceCredential before triggering the async test.
type CredMap = Record<string, string>;

// Both copied from the steps 1·2·3 table so the two read as one surface.
const MONO_CELL = 'whitespace-nowrap font-mono text-[12px]';
const PLACEHOLDER = '—';

const seedCreds = (confirmed: readonly ConfirmedResource[]): CredMap =>
  Object.fromEntries(confirmed.map((r) => [r.resourceId, r.credentialId ?? '']));

// Athena / DynamoDB 등은 DB Credential 없이 연결한다. 이런 행까지 Credential 을
// 요구하면 Run Test 가 열리지 않고, 진행 요약도 "성공 0 · 완료 100%" 로 어긋난다.
const requiresCredential = (databaseType: string | null): boolean =>
  !!databaseType && needsCredential(databaseType);

/**
 * One row of this table = one thing the connection test actually reports on.
 *
 * For Athena that is the REGION, not the database: the result comes back keyed on
 * `athena_region_resource_id` (`athena:<acct>:<region>/<catalog>`), so every database of one
 * region shares a single verdict. Listing them separately printed that one verdict four times,
 * implied four tests had run, and counted four units in the progress strip — and each of those
 * rows looked its status up by its own database id, which no result is ever keyed on.
 */
interface TestUnit {
  /** The id the result is keyed on — see `resultUnitId`. */
  unitId: string;
  region: string | null;
  databaseType: string | null;
  /** The confirmed rows this unit covers: one, or every database of an Athena region. */
  members: ConfirmedResource[];
  /** True when this row stands for a region rather than for a single resource. */
  folded: boolean;
}

const toTestUnits = (confirmed: readonly ConfirmedResource[]): TestUnit[] => {
  const units: TestUnit[] = [];
  const byUnitId = new Map<string, TestUnit>();
  for (const resource of confirmed) {
    const unitId = resultUnitId(resource);
    const existing = byUnitId.get(unitId);
    if (existing) {
      existing.members.push(resource);
      continue;
    }
    const unit: TestUnit = {
      unitId,
      region: resource.region ?? null,
      databaseType: resource.databaseType ?? null,
      members: [resource],
      folded: !!resource.athenaRegionResourceId,
    };
    byUnitId.set(unitId, unit);
    units.push(unit);
  }
  return units;
};

interface ConnectionTestCardProps {
  targetSourceId: number;
  confirmed: readonly ConfirmedResource[];
  providerLabel: string;
  /** Refetch the project — advances to step 6 when the process status flips. */
  refreshProject: () => void;
}

/**
 * Cloud Step 5 — connection test (v16 `data-prov-view="azure gcp aws"` card). Collapses
 * the former confirmed-resources + connection-test panel + logical-DB-check slots into one
 * card that mirrors the IDC step5 layout: conn-progress strip + a single table (cred select +
 * Connection Status + logical-DB-check) + a gated completion-approval request → CloudReqApprovalModal.
 *
 * Live wiring (ADR-019): Run Test persists changed credentials then triggers the async
 * connection test (`useTestConnectionPolling`); per-resource Connection Status is read from
 * the latest poll's agent results. Once the run settles SUCCESS the completion-status is
 * fetched and the 완료 승인 요청 CTA opens only when it reads LATEST_TEST_CONNECTION_SUCCESS.
 */
export const ConnectionTestCard = ({
  targetSourceId,
  confirmed,
  providerLabel,
  refreshProject,
}: ConnectionTestCardProps) => {
  const { latestJob, uiState, trigger, triggerError, fetchError } = useTestConnectionPolling(targetSourceId);
  const [creds, setCreds] = useState<CredMap>(() => seedCreds(confirmed));
  const [approvalOpen, setApprovalOpen] = useState(false);
  // The table, the progress strip and the Run Test gate all run on units — one row per thing
  // the test reports on. Only the completion-approval summary still lists databases.
  const units = useMemo(() => toTestUnits(confirmed), [confirmed]);
  // Which folded regions are open. Collapsed by default: the databases are reference here —
  // nothing on those rows is acted on, and the row the user works with is the region.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleUnit = useCallback((unitId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(unitId)) next.add(unitId);
      return next;
    });
  }, []);
  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(units, {
    initialPageSize: 10,
  });
  const logicalModal = useModal<LogicalModalTarget>();
  const toast = useToast();

  // DB Credential options from GET .../secrets (not a hardcoded list).
  const [credOptions, setCredOptions] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void getSecrets(targetSourceId)
      .then((secrets) => {
        if (active) setCredOptions(secrets.map((s) => s.name));
      })
      .catch(() => {
        if (active) setCredOptions([]);
      });
    return () => {
      active = false;
    };
  }, [targetSourceId]);

  // Re-seed credentials when the confirmed list changes (provider retry / target switch).
  // Adjusting state during render (the React "previous props" pattern) instead of an
  // effect — avoids the cascading-render an effect-body setState would cause.
  const [seededFrom, setSeededFrom] = useState(confirmed);
  if (seededFrom !== confirmed) {
    setSeededFrom(confirmed);
    setCreds(seedCreds(confirmed));
  }

  const testing = uiState === 'PENDING';

  // Per-resource connection status from the latest poll, keyed by resource_id. The
  // poll streams results as each pipeline settles (and hydrates on mount, B3), so
  // this map is the live source of truth for the table.
  const statusByResource = useMemo(() => {
    const map: Record<string, TestConnectionStatus> = {};
    for (const agent of latestJob?.test_connection_agent_results ?? []) {
      if (agent.resource_id && agent.connection_status) map[agent.resource_id] = agent.connection_status;
    }
    return map;
  }, [latestJob]);

  // A row is connected (for the approval gate) when the latest poll returned
  // SUCCESS for this unit and it has a credential — where one is required.
  const unitCred = useCallback((unit: TestUnit) => creds[unit.members[0].resourceId] ?? '', [creds]);
  const rowConnected = useCallback(
    (unit: TestUnit): boolean =>
      statusByResource[unit.unitId] === 'SUCCESS' &&
      (!requiresCredential(unit.databaseType) || !!unitCred(unit)),
    [statusByResource, unitCred],
  );

  // Gate the 완료 승인 요청 CTA directly on the latest_version poll result:
  // only open it when latest_version.connectionStatus === 'SUCCESS' (B2).
  const approvalEnabled = uiState === 'SUCCESS';

  // Run Test gate (v16 updateConnRunBtn): every row that needs a credential has one.
  const total = units.length;
  const allCredsSet =
    total > 0 && units.every((u) => !requiresCredential(u.databaseType) || !!unitCred(u));

  const runTest = useCallback(async () => {
    if (testing || !allCredsSet) return;
    await trigger();
  }, [testing, allCredsSet, trigger]);

  // Changing a credential fires a PUT immediately; local state updates only on success.
  const handleCredChange = useCallback(async (resourceId: string, cred: string) => {
    try {
      await updateResourceCredential(targetSourceId, resourceId, cred);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
      return;
    }
    setCreds((prev) => ({ ...prev, [resourceId]: cred }));
  }, [targetSourceId, toast]);

  // On save the skip policy persists, which flips completion-status
  // (LATEST_TEST_CONNECTION_SUCCESS → LOGICAL_DATABASE_RECENTLY_UPDATED, spec §7);
  // refreshProject re-reads so the badge updates.
  const handleSaved = useCallback(() => {
    toast.success('논리 DB 제외 정책을 저장했습니다.');
    logicalModal.close();
    refreshProject();
  }, [logicalModal, toast, refreshProject]);

  const handleSaveError = useCallback(() => {
    toast.error('논리 DB 제외 정책 저장에 실패했습니다.');
  }, [toast]);

  const handleSubmitApproval = useCallback(() => {
    setApprovalOpen(false);
    refreshProject();
  }, [refreshProject]);

  // Progress counts a row as done when it is connected or failed. A row still
  // missing a required credential renders "자격 증명 필요" in the table, so counting
  // its poll result as done would claim 완료 100% for a target nobody tested yet.
  const okCount = units.filter((u) => rowConnected(u)).length;
  const failCount = units.filter((u) => statusByResource[u.unitId] === 'FAIL').length;
  const doneCount = okCount + failCount;
  const pendingCount = total - doneCount;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  // Completion-approval gate: every target connected, latest_version settled SUCCESS, no test in flight.
  const canRequestApproval = total > 0 && okCount === total && !testing && approvalEnabled;

  const progressState: ConnProgressState = testing
    ? 'running'
    : failCount > 0
      ? 'fail'
      : total > 0 && pendingCount === 0
        ? 'success'
        : 'idle';
  const progressLabel = testing
    ? '연결 테스트 진행 중 — 각 대상의 Connection Status를 확인하고 있어요'
    : progressState === 'success'
      ? '연결 테스트 완료 — 모든 대상이 연결되었어요'
      : progressState === 'fail'
        ? '연결 테스트 실패 — 실패한 대상의 Credential 또는 네트워크를 점검해 주세요'
        : '연결 테스트 대기 중 — Run Test를 실행해 주세요';

  return (
    // No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar.
    <section className={cardStyles.base}>
      <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cardStyles.cardTitle}>연결 테스트</h2>
          <p className={cn('mt-2.5', cardStyles.subtitle)}>
            DB 접근 정보 사전 등록 및 보안 통신/방화벽 ACL, Agent 연결 여부를 점검합니다.
          </p>
        </div>
        {/* C-1: repeatable action demoted to soft — 완료 승인 요청 keeps the only primary. */}
        <button
          type="button"
          onClick={runTest}
          disabled={testing || !allCredsSet}
          className={cn(idcStyles.triggerBtn.soft, 'disabled:cursor-not-allowed disabled:opacity-45')}
        >
          {testing ? (
            '연결 테스트 진행 중...'
          ) : (
            <>
              <svg
                className="w-[13px] h-[13px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run Test
            </>
          )}
        </button>
      </header>
      <div className={cn(cardStyles.body, 'space-y-4')}>
        <ConnProgressStrip
          state={progressState}
          label={progressLabel}
          ok={okCount}
          fail={failCount}
          pending={pendingCount}
          pct={progressPct}
        />
        {triggerError && (
          <p className={cn('text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>{triggerError}</p>
        )}
        {fetchError && (
          <p className={cn('text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>
            {ERROR_MESSAGES.TEST_CONNECTION_FETCH_FAILED}
          </p>
        )}
        {/* Table + pagination are ONE stack, exactly as steps 2·3 and 6·7 compose them: the
            table itself carries no border or shadow, and the pagination bar below supplies the
            only stroke and the bottom radius. The framed `table.frame` this used to sit in drew
            a second box inside the card — a card inside a card, at a heavier weight than any
            border on those steps.
            Those steps cap the stack with the filter toolbar (top-rounded, #F7F8FA); this step
            has no filters, so the header row — same fill — is the cap and takes the radius. */}
        <div>
          <div className={cn(CONNECTED_FRAME, 'rounded-t-[12px] overflow-x-auto')}>
            <table className="w-full">
              <thead className={idcStyles.table.approvalHeader}>
                {/* Steps 1·2·3 order, verbatim: identity (name → id) → attributes (type ·
                    region) → what this step asks of the row. A user arrives here having read
                    the same rows three times already; leading with Database Type made them
                    re-find the anchor they had been scanning by. */}
                {/* Resource ID is the one column steps 1·2·3 carry that this step drops. Seven
                    columns at the approval table's 18px gutters want 1160px in a 948px card, so
                    one had to go, and this is the only one nothing here is decided by: the row is
                    already named, typed and located by the three columns around it, while every
                    other column is either that anchor or an action. Step 4 drops the same class of
                    column for the same reason. */}
                <tr className="whitespace-nowrap">
                  <th className={idcStyles.table.approvalHeaderCell}>Resource Name</th>
                  <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
                  <th className={idcStyles.table.approvalHeaderCell}>Region</th>
                  <th className={idcStyles.table.approvalHeaderCell}>DB Credential</th>
                  <th className={idcStyles.table.approvalHeaderCell}>Connection Status</th>
                  <th className={idcStyles.table.approvalHeaderCell}>논리 DB 확인</th>
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {pageRows.map((unit) => {
                  const cred = unitCred(unit);
                  const status = statusByResource[unit.unitId];
                  const connected = rowConnected(unit);
                  const credRequired = requiresCredential(unit.databaseType);
                  const [first] = unit.members;
                  const open = expanded.has(unit.unitId);
                  return (
                    <Fragment key={unit.unitId}>
                    <tr
                      className={cn(ROW_BASE, ROW_TARGET, unit.folded && 'cursor-pointer')}
                      onClick={unit.folded ? () => toggleUnit(unit.unitId) : undefined}
                    >
                      {/* A folded row stands for a REGION, which has no resource name, so this
                          cell carries the disclosure and the group's label — the same identity
                          cluster steps 1·2·3 put on a group parent. Opening it lists the
                          databases below, in the column their names belong to. */}
                      <td
                        className={cn(
                          idcStyles.table.approvalCell,
                          unit.folded
                            ? open && idcStyles.table.group.parentCell
                            : cn('font-mono text-[14px]', textColors.primary, NAME_LIFT),
                        )}
                      >
                        {unit.folded ? (
                          <span className={idcStyles.table.group.lead}>
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={`${unit.region ?? ''} 데이터베이스 목록 ${open ? '접기' : '펼치기'}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleUnit(unit.unitId);
                              }}
                              className={cn(
                                idcStyles.table.group.toggle,
                                open
                                  ? idcStyles.table.group.toggleOpen
                                  : idcStyles.table.group.toggleClosed,
                                primaryColors.focusRing,
                              )}
                            >
                              <ChevronRightIcon className="h-3.5 w-3.5" />
                            </button>
                            <span className={idcStyles.table.group.label}>
                              {getDatabaseShortLabel(unit.databaseType ?? '')}
                            </span>
                          </span>
                        ) : (
                          // One line, always — the widest names here ran to four lines and left
                          // row heights ragged. Full value in the tip, as on steps 1·2·3.
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
                        )}
                      </td>
                      <td
                        className={cn(
                          idcStyles.table.approvalCell,
                          'text-[12px]',
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
                      <td className={idcStyles.table.approvalCell}>
                        {credRequired ? (
                          <IdcCredSelectCell
                            value={cred}
                            onChange={(next) => handleCredChange(first.resourceId, next)}
                            options={credOptions}
                          />
                        ) : (
                          <span
                            className={cn('whitespace-nowrap text-[12px]', textColors.tertiary)}
                          >
                            불필요
                          </span>
                        )}
                      </td>
                      <td className={idcStyles.table.approvalCell}>
                        {credRequired && !cred ? (
                          <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>자격 증명 필요</span>
                        ) : status === 'SUCCESS' ? (
                          <span className={cn(idcStyles.tag.base, idcStyles.tag.green)}>Success</span>
                        ) : status === 'FAIL' ? (
                          <span className={cn(idcStyles.tag.base, idcStyles.tag.red)}>Fail</span>
                        ) : status === 'RUNNING' ? (
                          <span className={cn(idcStyles.tag.base, idcStyles.tag.orange)}>Running</span>
                        ) : (
                          <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>Pending</span>
                        )}
                      </td>
                      {/* Athena is IAM-based and has no logical-DB management at all, so a folded
                          region row has nothing to configure — the button used to open anyway
                          (it was gated on `connected` alone) onto a screen for a concept that
                          does not exist here. DynamoDB shares the trait but has no region fold to
                          key off; it is tracked in LIN-86 with the rest of that rule. */}
                      <td className={idcStyles.table.approvalCell}>
                        {unit.folded ? (
                          <span
                            className={cn('whitespace-nowrap text-[12px]', textColors.tertiary)}
                          >
                            설정 불필요
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!connected}
                            onClick={() =>
                              logicalModal.open({
                                resourceId: first.resourceId,
                                resourceName: first.resourceName ?? first.resourceId,
                              })
                            }
                            className={cn(idcStyles.triggerBtn.ghostSm, 'whitespace-nowrap')}
                          >
                            설정
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Database list. The name, and what the name IS — read down the tree the
                        Database Type column says Athena → Database, exactly as on steps 1·2·3.
                        Without it `default` is just a string. Every other cell stays empty: the
                        region row above already answers them and none of it varies per database. */}
                    {unit.folded &&
                      open &&
                      unit.members.map((db, index) => (
                        <tr key={db.resourceId}>
                          <td
                            className={cn(
                              idcStyles.table.approvalCell,
                              'font-mono text-[14px]',
                              textColors.primary,
                              idcStyles.table.group.childCell,
                              index === unit.members.length - 1 &&
                                idcStyles.table.group.childCellLast,
                            )}
                          >
                            {db.resourceName ?? db.resourceId}
                          </td>
                          <td
                            className={cn(
                              idcStyles.table.approvalCell,
                              'text-[12px]',
                              textColors.secondary,
                            )}
                          >
                            {GROUPED_CHILD_KIND_LABEL}
                          </td>
                          <td className={idcStyles.table.approvalCell} />
                          <td className={idcStyles.table.approvalCell} />
                          <td className={idcStyles.table.approvalCell} />
                          <td className={idcStyles.table.approvalCell} />
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          )}
        </div>
        <CloudReqApprovalModal
          isOpen={approvalOpen}
          onClose={() => setApprovalOpen(false)}
          resources={confirmed}
          providerLabel={providerLabel}
          targetSourceId={targetSourceId}
          onSubmit={handleSubmitApproval}
        />
        {logicalModal.data && (
          <LogicalDbModalLoader
            open={logicalModal.isOpen}
            targetSourceId={targetSourceId}
            resourceId={logicalModal.data.resourceId}
            resourceName={logicalModal.data.resourceName}
            onSaved={handleSaved}
            onError={handleSaveError}
            onClose={logicalModal.close}
          />
        )}
      </div>
      {/* C-2 action zone: the step-transition CTA docks (sticky) at the card bottom. */}
      <CardActionBar
        hint="※ 모든 DB의 Connection Status가 Success이고 논리 DB 확인 설정이 완료되어야 다음 단계로 진행할 수 있어요."
      >
        <button
          type="button"
          onClick={() => setApprovalOpen(true)}
          disabled={!canRequestApproval}
          className={idcStyles.triggerBtn.primary}
        >
          완료 승인 요청
        </button>
      </CardActionBar>
    </section>
  );
};
