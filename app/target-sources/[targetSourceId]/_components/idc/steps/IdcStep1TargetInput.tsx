'use client';

import { useCallback, useRef, useState } from 'react';
import { ProcessStatus, toWireDatabaseType } from '@/lib/types';
import { createApprovalRequest, getProject } from '@/app/lib/api';
import { useConfirmSubmit } from '@/app/hooks/useConfirmSubmit';
import { useToast } from '@/app/components/ui/toast';
import {
  idcDbTypeWireFromLabel,
  type IdcResourceView,
} from '@/app/lib/api/idc';
import { IDC_EXCL_PRESETS } from '@/lib/constants/idc';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { Pagination } from '@/app/components/ui/Pagination';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { EmptyState } from '@/app/components/ui/state';
import { DatabaseIcon, ReloadIcon, PlusIcon } from '@/app/components/ui/icons';
import {
  CardActionBar,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { useIdcApprovalTable } from '@/app/target-sources/[targetSourceId]/_components/idc/approval-table';
import { useLocale } from '@/app/components/LocaleProvider';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import {
  IdcTargetListTable,
  type IdcStep1Row,
} from '@/app/target-sources/[targetSourceId]/_components/idc/IdcTargetListTable';
import { IdcExclusionPopover } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcExclusionPopover';
import {
  IdcTargetFormModal,
  type IdcTargetFormResult,
} from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcTargetFormModal';
import { IdcLoadRequestModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcLoadRequestModal';
import { IdcSubmitModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcSubmitModal';
import { IdcExclusionReasonModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcExclusionReasonModal';
import type { ApprovalSelection } from '@/lib/approval-selection';

type SelectionRow = ApprovalSelection['resources'][number];

const toRow = (view: IdcResourceView): IdcStep1Row => ({
  ...view,
  exclusionCustom: view.excluded && !!view.exclusionReason && !IDC_EXCL_PRESETS.includes(view.exclusionReason as (typeof IDC_EXCL_PRESETS)[number]),
});

/**
 * IDC 한 행의 수기 입력 → 라우트의 `ApprovalSelectionInput`.
 *
 * IDC 는 스캔도 전용 제출 엔드포인트도 없어서, 이 경로가 host/port/format 을 백엔드로
 * 나르는 유일한 통로다. 그래서 여기만은 값을 계속 보낸다 — 서버에 대조할 원본이 아예
 * 없기 때문이다. 라우트는 이 값을 형식·범위로만 검증한다(`app/api/_lib/approval-input.ts`).
 *
 * `IdcResourceInput` 왕복(이전 요청 불러오기)과 같은 대응: kind→host_format,
 * hosts→hosts, service→oracle_service_id. `idc_source_ips`/`nlb_index` 는 Step2 가
 * 붙이므로 보내지 않는다.
 */
const toIdcInput = (r: IdcStep1Row): SelectionRow['idc'] => {
  // `database_type` 은 계약상 평문 문자열이다. 좁힌 wire enum 을 먼저 쓰되, 이전 요청에서
  // 불러온 enum 밖 DB 타입도 그대로 왕복하도록 raw 라벨로 물러선다.
  const databaseType = toWireDatabaseType(r.databaseTypeWire ?? r.databaseTypeLabel);
  return {
    host_format: r.kind === 'DOMAIN' ? 'HOST' : 'IP',
    hosts: r.hosts,
    ...(databaseType ? { database_type: databaseType } : {}),
    ...(r.port ? { port: r.port } : {}),
    ...(r.oracleSid ? { oracle_service_id: r.oracleSid } : {}),
    ...(r.credentialId ? { credential_id: r.credentialId } : {}),
  };
};

/**
 * Input adapter: IDC 수기 행 → `ApprovalSelectionInput`. 제외된 행도 접속 정보를 싣는다 —
 * Step2/Step3 와 백엔드가 `resource_id` 만으로는 그 행이 무엇이었는지 못 읽는다.
 */
export const toIdcApprovalRequestInput = (
  rows: readonly IdcStep1Row[],
): ApprovalSelection => ({
  resources: rows.map((r): SelectionRow => ({
    resource_id: r.resourceId,
    selected: !r.excluded,
    ...(r.excluded && r.exclusionReason ? { exclusion_reason: r.exclusionReason } : {}),
    idc: toIdcInput(r),
  })),
});


const defaultSourceIps = (kind: IdcResourceView['kind']): string[] =>
  kind === 'MULTIPLE_IP' ? ['172.16.0.11', '172.16.0.12'] : ['172.16.0.11'];

interface PopoverState {
  resourceId: string;
  anchor: HTMLElement;
}

/** Step 1 — 연동 대상 DB 입력 (manual). Orchestrates the editable list, exclusion
 *  flow, and the four modals. Working list lives in component state (DR1). */
export const IdcStep1TargetInput = ({
  project,
  onProjectUpdate,
}: IdcStepProps) => {
  const t = IDC_COPY[useLocale().locale];
  const targetSourceId = project.targetSourceId;

  // Step 1 starts EMPTY: IDC is manual input, so the working list begins blank and
  // the user either adds targets directly or loads a prior request on demand via
  // "기존 연동 요청 정보 불러오기" (IdcLoadRequestModal). No previous-request fetch on mount.
  const [rows, setRows] = useState<IdcStep1Row[]>([]);
  // Search / DB-type filter / paging, the same derivation the cloud step-1 candidate table uses.
  const { table, visibleResources: pagedRows } = useIdcApprovalTable(rows);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const toast = useToast();
  const tmpIdRef = useRef(0);

  const refreshProject = useCallback(async () => {
    const updated = await getProject(targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, targetSourceId]);

  const submit = useConfirmSubmit({
    targetSourceId,
    pendingStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    request: async () => {
      // Step 1 is manual input held in UI state — there is no IDC `/resources`
      // PUT in the contract; submission rides createApprovalRequest, which routes
      // every submission to WAITING_APPROVAL (Step 2, 승인 대기) for manual admin
      // approval — same as cloud providers (auto-approval is disabled in the demo).
      await createApprovalRequest(targetSourceId, toIdcApprovalRequestInput(rows));
    },
    // 확인 프레임이 물러난 뒤에 갱신한다 — 상태가 WAITING_APPROVAL 로 바뀌는 순간
    // 이 컴포넌트가 Step 2 로 교체되므로, 순서가 반대면 프레임이 그려지지 않는다.
    // 닫기는 finally 에 둔다. 확인 프레임은 닫기 경로가 전부 잠겨 있고(누를 것이 없는
    // 1초다) 버튼도 없으므로, 갱신이 던지면 사용자는 새로고침 말고는 빠져나갈 수 없다.
    // 그리고 갱신 실패를 삼키면 안 된다: 요청은 접수됐는데 화면은 1단계 그대로라, 아무
    // 말도 없으면 사용자는 승인 요청을 한 번 더 누른다(submit 에는 중복 가드가 없다).
    settle: async () => {
      try {
        await refreshProject();
      } catch {
        toast.warning(t.submitAcceptedRefresh);
      } finally {
        setSubmitOpen(false);
      }
    },
  });

  const editingRow = editId ? rows.find((r) => r.resourceId === editId) ?? null : null;
  const popoverRow = popover ? rows.find((r) => r.resourceId === popover.resourceId) ?? null : null;

  // The exclusion popover is anchored to a row element. A search / filter / page change can take
  // that row out of the DOM, leaving the popover pinned to nothing — every view change closes it.
  const onViewChange = <T,>(apply: (next: T) => void) => (next: T) => {
    apply(next);
    setPopover(null);
  };

  const total = rows.length;
  const excludedCount = rows.filter((r) => r.excluded).length;
  const liveCount = total - excludedCount;

  const patchRow = useCallback((resourceId: string, patch: Partial<IdcStep1Row>) => {
    setRows((prev) => prev.map((r) => (r.resourceId === resourceId ? { ...r, ...patch } : r)));
  }, []);

  const handleFormSubmit = (result: IdcTargetFormResult) => {
    // Derive the wire enum at the container boundary (ADR-017 §2, migration #2) —
    // the form (⑧) emits only the domain label. The label is always a valid
    // IDC_DB_TYPES option, so this resolves; guard keeps it type-safe.
    const databaseTypeWire = idcDbTypeWireFromLabel(result.databaseTypeLabel);
    if (!databaseTypeWire) return;
    if (editId) {
      patchRow(editId, {
        kind: result.kind,
        hosts: result.hosts,
        port: result.port,
        databaseTypeLabel: result.databaseTypeLabel,
        databaseTypeWire,
        oracleSid: result.oracleSid,
      });
    } else {
      const newRow: IdcStep1Row = {
        resourceId: `idc-tmp-${tmpIdRef.current++}`,
        persisted: false,
        kind: result.kind,
        hosts: result.hosts,
        port: result.port,
        databaseTypeLabel: result.databaseTypeLabel,
        databaseTypeWire,
        oracleSid: result.oracleSid,
        credentialId: undefined,
        sourceIps: defaultSourceIps(result.kind),
        firewallOpen: false,
        connection: 'PENDING',
        health: 'HEALTHY',
        done: '—',
        excluded: false,
        exclusionReason: undefined,
        exclusionCustom: false,
      };
      setRows((prev) => [...prev, newRow]);
    }
    setFormOpen(false);
    setEditId(null);
  };

  const handleToggle = (resourceId: string, checked: boolean, anchor: HTMLElement) => {
    if (checked) {
      // re-check → clear exclusion, back to integration target
      patchRow(resourceId, { excluded: false, exclusionReason: undefined, exclusionCustom: false });
    } else {
      // uncheck → require a reason; the row stays a target until one is picked
      setPopover({ resourceId, anchor });
    }
  };

  const handlePickPreset = (reason: string) => {
    if (!popover) return;
    patchRow(popover.resourceId, { excluded: true, exclusionReason: reason, exclusionCustom: false });
    setPopover(null);
  };

  const handlePickCustom = () => {
    if (!popover) return;
    setReasonFor(popover.resourceId);
    setPopover(null);
  };

  const handleSaveReason = (reason: string) => {
    if (!reasonFor) return;
    patchRow(reasonFor, { excluded: true, exclusionReason: reason, exclusionCustom: true });
    setReasonFor(null);
  };

  const handleOpenSubmit = () => {
    // 지난 실패 프레임을 들고 다시 열지 않는다.
    submit.reset();
    setSubmitOpen(true);
  };

  return (
    <>
      {/* No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar. */}
      <section className={cardStyles.base}>
        {/* Cloud step-1 header grammar: 단계 태그 · 고정 제목 한 줄 → 안내 문장. The two input
            entry points stay pinned to the header right — IDC has no scan strip to carry them. */}
        <header className={cn(cardStyles.header, 'flex items-start justify-between gap-4')}>
          <div>
            <div className="flex items-center gap-2">
              <span className={cardStyles.stepTag}>{t.step(1)}</span>
              <h2 className={cardStyles.cardTitle}>{t.step1Title}</h2>
            </div>
            {/* Blue names the two buttons pinned at the header right — the entry points the user
                has to press. break-keep wraps by word, not by syllable. */}
            <p className={cn('mt-2.5 break-keep', cardStyles.guidance)}>
              {t.step1GuideBefore}
              <span className={primaryColors.text}>{t.addTarget}</span>
              {t.step1GuideAfter}
            </p>
            {/* No top margin — the 1.55 leading is the paragraph break (step-2 grammar). */}
            <p className={cn('break-keep', cardStyles.guidance)}>
              {t.step1LoadGuideBefore}
              <span className={primaryColors.text}>{t.loadPrevCta}</span>
              {t.step1LoadGuideAfter}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" onClick={() => setLoadOpen(true)} className={idcStyles.triggerBtn.warnOutline}>
              <ReloadIcon className="h-3.5 w-3.5" />
              {t.loadPrevCta}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setFormOpen(true);
              }}
              className={idcStyles.triggerBtn.soft}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {t.addTarget}
            </button>
          </div>
        </header>

        <div className={cardStyles.body}>
          {rows.length === 0 ? (
            // Nothing entered yet — the empty state owns the one action this screen has, the way
            // the cloud scan hero does before a first scan.
            <EmptyState
              variant="block"
              icon={<DatabaseIcon className="h-7 w-7" aria-hidden="true" />}
              title={t.step1EmptyTitle}
              description={t.step1EmptyDesc}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setFormOpen(true);
                  }}
                  className={idcStyles.triggerBtn.primary}
                >
                  {t.addTarget}
                </button>
              }
            />
          ) : (
            <>
              {/* Toolbar (top-rounded) + table + pagination (bottom-rounded): one card, no gaps. */}
              <WaitingApprovalToolbar
                searchValue={table.searchValue}
                onSearchChange={onViewChange(table.onSearchChange)}
                dbType={table.dbType}
                onDbTypeChange={onViewChange(table.onDbTypeChange)}
                region={table.region}
                onRegionChange={onViewChange(table.onRegionChange)}
                dbTypeOptions={table.dbTypeOptions}
                regionOptions={table.regionOptions}
                searchPlaceholder={t.searchPlaceholder}
              />
              <IdcTargetListTable
                rows={pagedRows}
                onToggle={handleToggle}
                onReasonChipClick={(resourceId, anchor) => setPopover({ resourceId, anchor })}
                onEdit={(resourceId) => {
                  setEditId(resourceId);
                  setFormOpen(true);
                }}
                onDelete={(resourceId) => setRows((prev) => prev.filter((r) => r.resourceId !== resourceId))}
                emptyMessage={t.filterEmpty}
              />
              {table.filteredCount > 0 && (
                <Pagination
                  page={table.safePage}
                  pageSize={table.pageSize}
                  totalCount={table.filteredCount}
                  onPageChange={onViewChange(table.onPageChange)}
                  onPageSizeChange={onViewChange(table.onPageSizeChange)}
                  pageSizeOptions={[10, 20, 50, 100]}
                />
              )}
            </>
          )}
        </div>
        {/* C-2 action zone: the step-transition CTA docks (sticky) at the card bottom. The counts
            stay whole-list — the toolbar filters the view, not what gets submitted. */}
        {rows.length > 0 && (
          <CardActionBar
            hint={
              <>
                {t.hintTotal} <strong className={textColors.primary}>{total}</strong>
                {t.unitCount} · {t.hintLive}{' '}
                <strong className={primaryColors.text}>{liveCount}</strong>
                {t.unitCount}
                {excludedCount > 0 && (
                  <>
                    {' '}· {t.hintExcluded}{' '}
                    <strong className={statusColors.error.textDark}>{excludedCount}</strong>
                    {t.unitCount}
                  </>
                )}
              </>
            }
          >
            {(() => {
              // A disabled button swallows its own pointer events, so the explanation hangs off
              // the Tooltip wrapper — and only while the button is actually blocked.
              const submitButton = (
                <button
                  type="button"
                  disabled={liveCount === 0}
                  onClick={handleOpenSubmit}
                  className={cn(idcStyles.triggerBtn.primary, 'disabled:pointer-events-none')}
                >
                  {t.step1SubmitCta}
                </button>
              );
              return liveCount === 0 ? (
                <Tooltip
                  variant="status"
                  position="top"
                  triggerClassName="cursor-not-allowed"
                  content={
                    <div>
                      <p className="font-semibold">{t.step1BlockedTitle}</p>
                      <p className="mt-1">{t.step1BlockedBody}</p>
                    </div>
                  }
                >
                  {submitButton}
                </Tooltip>
              ) : (
                submitButton
              );
            })()}
          </CardActionBar>
        )}
      </section>

      <RejectionAlert project={project} />

      {formOpen && (
        <IdcTargetFormModal
          isOpen
          initial={
            editingRow
              ? {
                  kind: editingRow.kind,
                  hosts: editingRow.hosts,
                  port: editingRow.port,
                  databaseTypeLabel: editingRow.databaseTypeLabel,
                  oracleSid: editingRow.oracleSid,
                }
              : undefined
          }
          onSubmit={handleFormSubmit}
          onClose={() => {
            setFormOpen(false);
            setEditId(null);
          }}
        />
      )}

      {loadOpen && (
        <IdcLoadRequestModal
          isOpen
          targetSourceId={targetSourceId}
          onConfirm={(resources) => {
            setRows(resources.map(toRow));
            // The list is replaced wholesale — a page offset from the old one would land on a
            // page that no longer exists.
            table.onPageChange(0);
            setLoadOpen(false);
          }}
          onClose={() => setLoadOpen(false)}
        />
      )}

      <IdcSubmitModal
        isOpen={submitOpen}
        total={total}
        live={liveCount}
        excluded={excludedCount}
        phase={submit.phase}
        pending={submit.pending}
        errorCode={submit.errorCode}
        onSubmit={submit.submit}
        onRetry={submit.retry}
        onClose={() => setSubmitOpen(false)}
      />

      {reasonFor !== null && (
        <IdcExclusionReasonModal
          isOpen
          initialReason={rows.find((r) => r.resourceId === reasonFor)?.exclusionReason}
          onSave={handleSaveReason}
          onClose={() => setReasonFor(null)}
        />
      )}

      {popover && popoverRow && (
        <IdcExclusionPopover
          anchor={popover.anchor}
          selectedPreset={popoverRow.exclusionCustom ? undefined : popoverRow.exclusionReason}
          customActive={popoverRow.exclusionCustom}
          onPickPreset={handlePickPreset}
          onPickCustom={handlePickCustom}
          onDismiss={() => setPopover(null)}
        />
      )}
    </>
  );
};
