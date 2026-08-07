'use client';

import { useCallback, useMemo, useState } from 'react';
import { createApprovalRequest } from '@/app/lib/api';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Pagination } from '@/app/components/ui/Pagination';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { useToast } from '@/app/components/ui/toast';
import { ScanController } from '@/app/components/features/scan/ScanPanel';
import { ScanErrorState } from '@/app/components/features/scan/ScanErrorState';
import { ScanHeroState } from '@/app/components/features/scan/ScanHeroState';
import { ScanHistoryModal } from '@/app/components/features/scan/ScanHistoryModal';
import { ScanRunningState } from '@/app/components/features/scan/ScanRunningState';
import { ScanStrip } from '@/app/components/features/scan/ScanStrip';
import { TERMINAL_SCAN_STATUSES } from '@/app/components/features/scan/scan-labels';
import { useScanPermission } from '@/app/components/features/scan/scan-permission';
import {
  borderColors,
  cardStyles,
  cn,
  getButtonClass,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';
import type { CandidateDraftState, CandidateResource, EndpointConfigDraft } from '@/lib/types/resources';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import {
  WaitingApprovalToolbar,
  type ApprovalFilter,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { getCandidateBehavior } from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';
import { CandidateResourceTable } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable';
import type { CandidateRowActions } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceRow';
import { selectPhase } from '@/app/target-sources/[targetSourceId]/_components/candidate/phase';
import {
  listMissingExclusionReasons,
  toApprovalRequestInput,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import { useCandidateResources } from '@/app/target-sources/[targetSourceId]/_components/candidate/use-candidate-resources';
import { useExclusionPicker } from '@/app/target-sources/[targetSourceId]/_components/candidate/use-exclusion-picker';
import { IdcSubmitModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcSubmitModal';
import { IdcExclusionPopover } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcExclusionPopover';
import { IdcExclusionReasonModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcExclusionReasonModal';

interface CandidateResourceSectionProps {
  targetSourceId: number;
  /** 스캔 권한 검증·안내 문구가 프로바이더별 자격을 그대로 부르기 위한 값. */
  provider: CloudProvider;
  readonly: boolean;
  refreshProject: () => Promise<void>;
}

const EMPTY_DRAFTS: CandidateDraftState = { endpointDrafts: {}, rdsInstanceDrafts: {} };

/** Cloud exclusion reason UI cap. Contract allows 3000 (docs/cloud-provider-states.md);
 *  운영 정책으로 1000자로 조인다 — 계약의 부분집합이라 wire엔 영향 없다. */
const CLOUD_EXCL_REASON_MAXLEN = 1000;

/** Skeleton frame shown while candidate resources load — mirrors the candidate table shape. */
const CandidateTableSkeleton = () => (
  <div className="space-y-3" aria-busy="true" aria-live="polite">
    <div className={cn(idcStyles.skeletonBar, 'h-3.5 w-56 rounded')} />
    <div className={cn('overflow-hidden rounded-xl border', borderColors.default)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && cn('border-t', borderColors.light))}
        >
          <div className={cn(idcStyles.skeletonBar, 'h-4 w-4 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 flex-1 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 w-24 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-5 w-20 rounded-full')} />
        </div>
      ))}
    </div>
  </div>
);

export const CandidateResourceSection = ({
  targetSourceId,
  provider,
  readonly,
  refreshProject,
}: CandidateResourceSectionProps) => {
  const toast = useToast();
  const approvalModal = useModal();
  const historyModal = useModal();
  const { state: permission, check: checkPermission } = useScanPermission(provider, targetSourceId);
  const {
    state,
    candidates,
    selectedIds,
    setSelectedIds,
    exclusions,
    setExclusions,
    refetch,
    refetchAfterScan,
  } = useCandidateResources(targetSourceId);

  const [drafts, setDrafts] = useState<CandidateDraftState>(EMPTY_DRAFTS);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);

  // Plain id→reason map for the payload adapter and the table's reason chips.
  const exclusionReasons = useMemo(
    () => Object.fromEntries(Object.entries(exclusions).map(([id, e]) => [id, e.reason])),
    [exclusions],
  );

  // 재스캔 차분 표기 — 스트립의 "신규 N" (테이블 열은 아니고 스트립 메타 전용).
  const newCount = useMemo(
    () => candidates.filter((candidate) => candidate.scanStatus === 'NEW_SCAN').length,
    [candidates],
  );

  // Step 2·3와 동일한 검색/DB Type/Region/페이지 파생(useApprovalTableState)을
  // 그대로 쓴다 — 훅의 입력 모양(WaitingApprovalResource)으로 어댑트하고, 옵션
  // 문자열이 셀 표기와 일치하도록 셀과 같은 소스(드래프트 인지 dbType,
  // metadata.region)를 넣는다. 선택·제외 사유·CTA 비활성 계산은 전부 필터와
  // 무관하게 전체 후보 기준을 유지한다.
  const approvalShaped = useMemo(
    () => candidates.map((candidate) => ({
      resourceId: candidate.resourceId,
      resourceName: candidate.resourceName,
      resourceType: candidate.type,
      displayDbType: drafts.endpointDrafts[candidate.id]?.databaseType
        ?? candidate.endpointConfig?.databaseType
        ?? candidate.databaseType
        ?? '',
      region: candidate.metadata.region ?? '',
      selected: selectedIds.has(candidate.id),
    })),
    [candidates, drafts, selectedIds],
  );
  const table = useApprovalTableState(approvalShaped);
  const visibleCandidates = useMemo(() => {
    const byResourceId = new Map(candidates.map((candidate) => [candidate.resourceId, candidate]));
    return table.visibleResources
      .map((resource) => byResourceId.get(resource.resourceId))
      .filter((candidate): candidate is CandidateResource => candidate != null);
  }, [candidates, table.visibleResources]);

  // 승인 요청 CTA의 비활성 사유를 데이터로 명시 — 버튼 disabled 와 호버 설명이
  // 같은 원천을 읽는다. 빈 문자열·공백 사유는 미입력으로 취급(listMissing이 trim).
  const missingReasonResources = useMemo(
    () => listMissingExclusionReasons(candidates, selectedIds, exclusionReasons),
    [candidates, selectedIds, exclusionReasons],
  );
  const approvalBlockReason = useMemo(() => {
    if (selectedIds.size === 0) {
      return {
        title: '연동할 DB를 선택해주세요',
        detail: '목록에서 1개 이상 선택하면 승인 요청을 보낼 수 있어요.',
      };
    }
    if (missingReasonResources.length > 0) {
      const preview = missingReasonResources.slice(0, 2).map((c) => c.resourceName).join(', ');
      const rest = missingReasonResources.length - 2;
      return {
        title: `제외 사유 미입력 ${missingReasonResources.length}건`,
        detail: `제외한 설치 대상에는 사유가 필요해요: ${preview}${rest > 0 ? ` 외 ${rest}건` : ''}`,
      };
    }
    return null;
  }, [missingReasonResources, selectedIds.size]);

  const select = useCallback((resourceId: string) => {
    setSelectedIds((previous) => new Set(previous).add(resourceId));
    setExclusions((previous) => {
      if (!(resourceId in previous)) return previous;
      const next = { ...previous };
      delete next[resourceId];
      return next;
    });
  }, [setSelectedIds, setExclusions]);

  const exclude = useCallback((resourceId: string, reason: string, custom: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(resourceId);
      return next;
    });
    setExclusions((previous) => ({ ...previous, [resourceId]: { reason, custom } }));
  }, [setSelectedIds, setExclusions]);

  const picker = useExclusionPicker({ onSelect: select, onExclude: exclude });
  const { popover, reasonModal, closeAll: closePicker } = picker;

  // 검색·필터·페이지가 바뀌면 행에 앵커된 UI(확장 패널·제외 팝오버)의 대상 행이
  // 화면에서 사라진다 — 죽은 앵커를 남기지 않게 모든 뷰 변경 핸들러가 함께 닫는다.
  const {
    onSearchChange: tableSearchChange,
    onFilterChange: tableFilterChange,
    onDbTypeChange: tableDbTypeChange,
    onRegionChange: tableRegionChange,
    onPageChange: tablePageChange,
    onPageSizeChange: tablePageSizeChange,
  } = table;
  const closeRowUi = useCallback(() => {
    setExpandedResourceId(null);
    closePicker();
  }, [closePicker]);
  const handleSearchChange = useCallback((next: string) => {
    tableSearchChange(next);
    closeRowUi();
  }, [tableSearchChange, closeRowUi]);
  const handleFilterChange = useCallback((next: ApprovalFilter) => {
    tableFilterChange(next);
    closeRowUi();
  }, [tableFilterChange, closeRowUi]);
  const handleDbTypeChange = useCallback((next: string) => {
    tableDbTypeChange(next);
    closeRowUi();
  }, [tableDbTypeChange, closeRowUi]);
  const handleRegionChange = useCallback((next: string) => {
    tableRegionChange(next);
    closeRowUi();
  }, [tableRegionChange, closeRowUi]);
  const handlePageChange = useCallback((next: number) => {
    tablePageChange(next);
    closeRowUi();
  }, [tablePageChange, closeRowUi]);
  const handlePageSizeChange = useCallback((next: number) => {
    tablePageSizeChange(next);
    closeRowUi();
  }, [tablePageSizeChange, closeRowUi]);

  const approval = useApiAction(
    async () => {
      const input = toApprovalRequestInput(candidates, selectedIds, drafts, exclusionReasons);
      await createApprovalRequest(targetSourceId, input);
      await refreshProject();
    },
    {
      onSuccess: () => {
        approvalModal.close();
        setExpandedResourceId(null);
      },
      suppressAlert: true,
      errorMessage: '승인 요청에 실패했습니다.',
    },
  );

  const handleExpandToggle = useCallback((resourceId: string | null) => {
    setExpandedResourceId(resourceId);
  }, []);

  const handleEndpointSave = useCallback((resourceId: string, draft: EndpointConfigDraft) => {
    setDrafts((previous) => ({
      ...previous,
      endpointDrafts: { ...previous.endpointDrafts, [resourceId]: draft },
    }));
  }, []);

  // No seeding on check: the effective instance is DERIVED (draft → server value → sorted-top
  // default), so a cluster is never in a state where the payload has no instance to send.
  // A seeded copy of that default would be a second source of truth that could drift from it.
  const handleSelectRdsInstance = useCallback((resourceId: string, instanceResourceId: string) => {
    setDrafts((previous) => ({
      ...previous,
      rdsInstanceDrafts: { ...previous.rdsInstanceDrafts, [resourceId]: instanceResourceId },
    }));
  }, []);

  const rowActions = useMemo<CandidateRowActions>(() => ({
    toggleSelected: picker.handleToggleSelected,
    reasonChipClick: picker.handleReasonChipClick,
    expandToggle: handleExpandToggle,
    endpointSave: handleEndpointSave,
    selectRdsInstance: handleSelectRdsInstance,
  }), [picker.handleToggleSelected, picker.handleReasonChipClick, handleExpandToggle, handleEndpointSave, handleSelectRdsInstance]);

  const handleRequestApproval = useCallback(() => {
    if (selectedIds.size === 0) return;
    const unconfigured = candidates.filter(
      (candidate) => selectedIds.has(candidate.id)
        && !getCandidateBehavior(candidate).isConfigured(candidate, drafts),
    );
    if (unconfigured.length > 0) {
      toast.warning(
        `다음 리소스의 설정이 필요합니다: ${unconfigured.map((candidate) => candidate.resourceId).join(', ')}`,
      );
      return;
    }
    // Exclusion reason is required (docs/cloud-provider-states.md) — every unselected TARGET needs one.
    const missingReasons = listMissingExclusionReasons(candidates, selectedIds, exclusionReasons);
    if (missingReasons.length > 0) {
      toast.warning(
        `제외 사유 입력이 필요합니다: ${missingReasons.map((candidate) => candidate.resourceId).join(', ')}`,
      );
      return;
    }
    approval.reset();
    approvalModal.open();
  }, [approval, approvalModal, candidates, drafts, exclusionReasons, selectedIds, toast]);

  const handleScanComplete = useCallback(async () => {
    setDrafts(EMPTY_DRAFTS);
    setExpandedResourceId(null);
    // 재스캔이면 목록이 통째로 바뀐다 — 이전 검색·필터가 새 결과를 가리지 않게 초기화.
    tableSearchChange('');
    tableFilterChange('all');
    tableDbTypeChange('');
    tableRegionChange('');
    tablePageChange(0);
    closePicker();
    refetchAfterScan();
    await refreshProject();
  }, [tableSearchChange, tableFilterChange, tableDbTypeChange, tableRegionChange, tablePageChange, closePicker, refetchAfterScan, refreshProject]);

  const handleApprovalConfirm = useCallback(() => {
    void approval.execute();
  }, [approval]);

  const handleCheckPermission = useCallback(() => {
    void checkPermission();
  }, [checkPermission]);

  return (
    <>
      <ScanController targetSourceId={targetSourceId} onScanComplete={handleScanComplete}>
        {({ state: scanState, latestJob, progress, finalizing, starting, canStart, loading: scanLoading, startScan }) => {
          const initialLoading = scanLoading || state.status === 'loading';
          const phase = selectPhase({
            fetchStatus: state.status,
            scanState,
            hasCandidates: candidates.length > 0,
          });
          // 종료된 스캔만 "결과"다 — mock BFF는 이력이 없으면 NO_SCAN 센티널 잡을
          // 합성하므로(실 BFF는 404 → latestJob null) 상태 집합으로 걸러낸다.
          const finishedJob = latestJob != null
            && latestJob.scan_status != null
            && TERMINAL_SCAN_STATUSES.has(latestJob.scan_status)
            ? latestJob
            : null;
          const neverScanned = finishedJob == null;
          // 스트립은 본문이 스캔 결과 위에 서 있을 때만 — scanning 은 러닝 화면이
          // 스스로 말하고, fetch 상태는 프레임 전체를 소유한다. list 에서는 잡이
          // 없어도(목 시드·이력 유실) 렌더한다: 스캔 진입점이 스트립뿐이므로.
          const showStrip = phase === 'list'
            || (finishedJob != null && (phase === 'empty' || phase === 'scanFailed'));
          const scanDisabled = initialLoading || !canStart || readonly;
          // Counts only when the list is up: with no candidates they are all zero,
          // which is noise rather than information, and the band collapses to one
          // line. All three are in the candidate-DB unit (selected + excluded = eligible).
          const funnel = phase === 'list'
            ? {
              eligible: candidates.length,
              selected: selectedIds.size,
              excluded: Math.max(0, candidates.length - selectedIds.size),
              missingReasons: missingReasonResources.length,
              filter: table.filter,
              onFilterChange: handleFilterChange,
            }
            : undefined;

          const renderBody = (): React.ReactNode => {
            switch (phase) {
              case 'fetching':
                return <CandidateTableSkeleton />;
              case 'fetchError':
                return (
                  <div className={cn('space-y-3 rounded-xl border p-6', statusColors.error.bg, statusColors.error.border)}>
                    <p className={cn('text-sm font-medium', statusColors.error.textDark)}>
                      {state.status === 'error' ? state.message : ''}
                    </p>
                    <button onClick={refetch} className={getButtonClass('secondary')}>
                      다시 시도
                    </button>
                  </div>
                );
              case 'scanning':
                return <ScanRunningState progress={progress} finalizing={finalizing} />;
              case 'scanFailed':
                return <ScanErrorState onRetry={startScan} />;
              case 'list':
                // Step 2 표 스택 그대로: 툴바(검색+필터, 상단 라운드) → 무윤곽 표 →
                // Pagination 마감 바(rounded-b). 윤곽은 Header/Footer 두 세그먼트뿐이다.
                return (
                  <div>
                    <WaitingApprovalToolbar
                      searchValue={table.searchValue}
                      onSearchChange={handleSearchChange}
                      dbType={table.dbType}
                      onDbTypeChange={handleDbTypeChange}
                      region={table.region}
                      onRegionChange={handleRegionChange}
                      dbTypeOptions={table.dbTypeOptions}
                      regionOptions={table.regionOptions}
                    />
                    <CandidateResourceTable
                      candidates={visibleCandidates}
                      selectedIds={selectedIds}
                      exclusionReasons={exclusionReasons}
                      drafts={drafts}
                      expandedResourceId={expandedResourceId}
                      readonly={readonly}
                      actions={rowActions}
                      emptyMessage="조건에 맞는 결과가 없어요."
                    />
                    {table.filteredCount > 0 && (
                      <Pagination
                        page={table.safePage}
                        pageSize={table.pageSize}
                        totalCount={table.filteredCount}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                      />
                    )}
                  </div>
                );
              case 'empty':
                // 스캔 전엔 온보딩 히어로가 본문 전체 — 이 순간 화면의 유일한 행동이
                // 스캔이므로 primary CTA를 가진다. 스캔 후 0건은 스트립 아래 한 줄로.
                return neverScanned ? (
                  <ScanHeroState
                    provider={provider}
                    permission={permission}
                    onCheckPermission={handleCheckPermission}
                    onStartScan={startScan}
                    canStart={!scanDisabled}
                    starting={starting}
                  />
                ) : (
                  <p className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
                    발견된 리소스가 없어요. 다시 스캔으로 최신 상태를 확인해보세요.
                  </p>
                );
              default:
                phase satisfies never;
                return null;
            }
          };

          return (
            // No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar.
            <section className={cardStyles.base}>
              {/* Step 2·3 헤더 문법: 단계 태그 → 고정 제목 → 안내 문장. 스캔 컨트롤은
                  헤더가 아니라 스트립/히어로가 소유한다 — 목록이 있을 때 이 카드의
                  primary CTA는 하단 승인 요청 하나뿐이고, 스캔은 보조 밴드로 물러난다. */}
              <header className={cardStyles.header}>
                <span className={cardStyles.stepTag}>1번째 단계</span>
                <h2 className={cn(cardStyles.cardTitle)}>연동 대상 DB 선택</h2>
                {/* 2호흡: 스캔→선택 / 사유→승인. 강조는 사용자가 직접 해야 하는
                    행동 두 가지(선택·사유 입력)만 파랑 — 승인은 시스템 몫이라 평문.
                    break-keep: 음절 고아("요."만 다음 줄) 방지, 단어 단위로 감는다. */}
                <p className={cn('mt-2.5 break-keep', cardStyles.guidance)}>
                  인프라 스캔으로 {provider} 계정의 리소스를 조회하고,{' '}
                  <span className={primaryColors.text}>연동할 리소스를 선택</span>해요. 제외하는
                  리소스에는 <span className={primaryColors.text}>사유가 필요</span>하고, 결과는
                  관리자 승인을 거쳐 확정돼요.
                </p>
              </header>

              <div className={cardStyles.body}>
                {showStrip && (
                  // 스캔 밴드는 리소스 테이블과 명시적으로 분리된 영역 — 항상 독립
                  // 밴드로 서고, 표 그룹과는 간격으로 구분한다.
                  <div className="mb-4">
                    <ScanStrip
                      job={finishedJob}
                      newCount={newCount}
                      permission={permission}
                      onCheckPermission={handleCheckPermission}
                      onOpenHistory={historyModal.open}
                      onStartScan={startScan}
                      // 실패 본문(ScanErrorState)이 재시도 CTA를 소유 — 중복 금지.
                      showScanButton={phase !== 'scanFailed'}
                      scanDisabled={scanDisabled}
                      starting={starting}
                      funnel={funnel}
                    />
                  </div>
                )}
                {renderBody()}
              </div>

              {/* C-2 action zone (lifted out of CandidateResourceTable): the transition
                  CTA docks (sticky) at the card bottom while the long table scrolls. */}
              {phase === 'list' && !readonly && (
                <CardActionBar
                  hint={
                    <>
                      총 <strong className={textColors.primary}>{candidates.length}</strong>건 ·{' '}
                      <strong className={primaryColors.text}>{selectedIds.size}</strong>건 선택됨
                    </>
                  }
                >
                  {(() => {
                    // disabled 버튼은 자체 포인터 이벤트를 삼키므로(pointer-events-none)
                    // 호버는 Tooltip 래퍼가 받는다. 설명은 막힌 이유가 있을 때만 —
                    // 활성 버튼 위 툴팁은 장애물이다.
                    const approveButton = (
                      <Button
                        variant="primary"
                        onClick={handleRequestApproval}
                        disabled={approval.loading || approvalBlockReason != null}
                        className="flex items-center gap-2 disabled:pointer-events-none"
                      >
                        {approval.loading && <LoadingSpinner />}
                        연동 대상 승인 요청
                      </Button>
                    );
                    return approvalBlockReason ? (
                      <Tooltip
                        variant="status"
                        position="top"
                        triggerClassName="cursor-not-allowed"
                        content={
                          <div>
                            <p className="font-semibold">{approvalBlockReason.title}</p>
                            <p className="mt-1">{approvalBlockReason.detail}</p>
                          </div>
                        }
                      >
                        {approveButton}
                      </Tooltip>
                    ) : approveButton;
                  })()}
                </CardActionBar>
              )}
            </section>
          );
        }}
      </ScanController>

      {historyModal.isOpen && (
        <ScanHistoryModal
          targetSourceId={targetSourceId}
          provider={provider}
          onClose={historyModal.close}
        />
      )}

      {!readonly && (
        <IdcSubmitModal
          isOpen={approvalModal.isOpen}
          total={candidates.length}
          live={selectedIds.size}
          excluded={Math.max(0, candidates.length - selectedIds.size)}
          submitting={approval.loading}
          onSubmit={handleApprovalConfirm}
          onClose={approvalModal.close}
        />
      )}

      {popover && (
        <IdcExclusionPopover
          anchor={popover.anchor}
          selectedPreset={exclusions[popover.resourceId]?.custom ? undefined : exclusions[popover.resourceId]?.reason}
          customActive={exclusions[popover.resourceId]?.custom ?? false}
          onPickPreset={picker.handlePickPreset}
          onPickCustom={picker.handlePickCustom}
          onDismiss={picker.dismissPopover}
        />
      )}

      {reasonModal.isOpen && reasonModal.data !== undefined && (
        <IdcExclusionReasonModal
          isOpen
          initialReason={exclusions[reasonModal.data]?.reason}
          maxLen={CLOUD_EXCL_REASON_MAXLEN}
          onSave={picker.handleSaveReason}
          onClose={reasonModal.close}
        />
      )}
    </>
  );
};
