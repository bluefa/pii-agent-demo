'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
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
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { LogicalDbModalLoader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import { CloudReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal';
import type { ConfirmedResource } from '@/lib/types/resources';
import { needsCredential } from '@/lib/types';

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

// Local credential edits — the confirmed list from the BFF seeds these, and Run Test
// persists any change via updateResourceCredential before triggering the async test.
type CredMap = Record<string, string>;

const seedCreds = (confirmed: readonly ConfirmedResource[]): CredMap =>
  Object.fromEntries(confirmed.map((r) => [r.resourceId, r.credentialId ?? '']));

// Athena / DynamoDB 등은 DB Credential 없이 연결한다. 이런 행까지 Credential 을
// 요구하면 Run Test 가 열리지 않고, 진행 요약도 "성공 0 · 완료 100%" 로 어긋난다.
const requiresCredential = (resource: ConfirmedResource): boolean =>
  !!resource.databaseType && needsCredential(resource.databaseType);

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
  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(confirmed, {
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
  // SUCCESS for this resource and it has a credential — where one is required.
  const rowConnected = useCallback(
    (resource: ConfirmedResource): boolean =>
      statusByResource[resource.resourceId] === 'SUCCESS' &&
      (!requiresCredential(resource) || !!creds[resource.resourceId]),
    [creds, statusByResource],
  );

  // Gate the 완료 승인 요청 CTA directly on the latest_version poll result:
  // only open it when latest_version.connectionStatus === 'SUCCESS' (B2).
  const approvalEnabled = uiState === 'SUCCESS';

  // Run Test gate (v16 updateConnRunBtn): every row that needs a credential has one.
  const total = confirmed.length;
  const allCredsSet =
    total > 0 && confirmed.every((r) => !requiresCredential(r) || !!creds[r.resourceId]);

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
  const okCount = confirmed.filter((r) => rowConnected(r)).length;
  const failCount = confirmed.filter(
    (r) => statusByResource[r.resourceId] === 'FAIL',
  ).length;
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
        <div className={idcStyles.table.frame}>
          <table className="w-full">
            <thead className={idcStyles.table.header}>
              <tr>
                <th className={idcStyles.table.headerCell}>Database Type</th>
                <th className={idcStyles.table.headerCell}>Resource ID</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Region</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[180px]')}>Resource Name</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>DB Credential</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Connection Status</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[100px]')}>논리 DB 확인</th>
              </tr>
            </thead>
            <tbody className={idcStyles.table.body}>
              {pageRows.map((resource) => {
                const cred = creds[resource.resourceId] ?? '';
                const status = statusByResource[resource.resourceId];
                const connected = rowConnected(resource);
                const credRequired = requiresCredential(resource);
                return (
                  <tr key={resource.resourceId} className={idcStyles.table.row}>
                    <td className={idcStyles.table.cell}>
                      {resource.databaseType ? (
                        <span className={cn('text-[12px]', textColors.secondary)}>
                          {getDatabaseShortLabel(resource.databaseType)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={idcStyles.table.cell}>
                      <ResourceIdCell value={resource.resourceId} label="Resource ID" />
                    </td>
                    <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                      {resource.region ?? '-'}
                    </td>
                    <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                      {resource.resourceName ?? '-'}
                    </td>
                    <td className={idcStyles.table.cell}>
                      {credRequired ? (
                        <IdcCredSelectCell
                          value={cred}
                          onChange={(next) => handleCredChange(resource.resourceId, next)}
                          options={credOptions}
                        />
                      ) : (
                        <span className={cn('text-[12px]', textColors.tertiary)}>불필요</span>
                      )}
                    </td>
                    <td className={idcStyles.table.cell}>
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
                    <td className={idcStyles.table.cell}>
                      <button
                        type="button"
                        disabled={!connected}
                        onClick={() =>
                          logicalModal.open({
                            resourceId: resource.resourceId,
                            resourceName: resource.resourceName ?? resource.resourceId,
                          })
                        }
                        className={idcStyles.triggerBtn.ghostSm}
                      >
                        설정
                      </button>
                    </td>
                  </tr>
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
