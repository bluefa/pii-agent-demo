'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApprovalRequest } from '@/app/lib/api';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Pagination } from '@/app/components/ui/Pagination';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { useConfirmSubmit } from '@/app/hooks/useConfirmSubmit';
import { useModal } from '@/app/hooks/useModal';
import { useScanCompletionTransition } from '@/app/hooks/useScanCompletionTransition';
import { useToast } from '@/app/components/ui/toast';
import { PlusIcon } from '@/app/components/ui/icons';
import type { Ec2Instance } from '@/app/lib/api/ec2';
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
  scanTransition,
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
import {
  toManualEc2Candidate,
  type Ec2ConnectionConfig,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/manual-ec2';
import { Ec2AddModal } from '@/app/target-sources/[targetSourceId]/_components/aws/Ec2AddModal';
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

/**
 * One EC2 instance the user searched for and added by hand, kept as what it is —
 * the instance plus the connection info typed for it. The Step-1 row is derived from
 * the pair, so reopening the form for an edit never has to reconstruct either half.
 */
interface ManualEc2Entry {
  instance: Ec2Instance;
  config: Ec2ConnectionConfig;
}

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
  const [manualEc2, setManualEc2] = useState<ManualEc2Entry[]>([]);
  const [ec2AddOpen, setEc2AddOpen] = useState(false);
  const [ec2EditingId, setEc2EditingId] = useState<string | null>(null);
  // 방금 담긴 한 건. 여러 대를 이어 담으면 마커는 언제나 마지막 하나에만 붙는다 —
  // 신호가 둘이면 어느 쪽이 방금인지 말해주지 못한다.
  const [justAddedEc2Id, setJustAddedEc2Id] = useState<string | null>(null);

  // Manually added instances join the scanned candidates as ordinary rows, so the table,
  // the counts, the filters and the approval payload need no second code path. They lead the
  // list: the user just added them, and a row appended behind ten scanned ones reads as lost.
  const allCandidates = useMemo(
    () => [
      ...manualEc2.map((entry) => toManualEc2Candidate(entry.instance, entry.config)),
      ...candidates,
    ],
    [candidates, manualEc2],
  );
  // Every id already on the table, not just the manually added ones: the scan can surface an
  // EC2 instance as a candidate on its own, and adding it a second time would duplicate the row
  // and the payload item. The search marks those results 추가됨 instead of offering 추가.
  const addedEc2InstanceIds = useMemo(
    () => new Set(allCandidates.map((candidate) => candidate.resourceId)),
    [allCandidates],
  );
  const manualEc2Ids = useMemo(
    () => new Set(manualEc2.map((entry) => entry.instance.instanceId)),
    [manualEc2],
  );
  const editingEc2 = ec2EditingId === null
    ? undefined
    : manualEc2.find((entry) => entry.instance.instanceId === ec2EditingId);

  // 스캔 완료 → 목록 사이의 확인 프레임. 결과 조회가 이 프레임 뒤에서 돌기 때문에
  // 평범한 응답 시간은 프레임에 가려지고, 예전처럼 스켈레톤이 번쩍이지 않는다.
  const completion = useScanCompletionTransition();

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
    () => allCandidates.map((candidate) => ({
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
    [allCandidates, drafts, selectedIds],
  );
  const table = useApprovalTableState(approvalShaped);
  const visibleCandidates = useMemo(() => {
    const byResourceId = new Map(allCandidates.map((candidate) => [candidate.resourceId, candidate]));
    return table.visibleResources
      .map((resource) => byResourceId.get(resource.resourceId))
      .filter((candidate): candidate is CandidateResource => candidate != null);
  }, [allCandidates, table.visibleResources]);

  // 승인 요청 CTA의 비활성 사유를 데이터로 명시 — 버튼 disabled 와 호버 설명이
  // 같은 원천을 읽는다. 빈 문자열·공백 사유는 미입력으로 취급(listMissing이 trim).
  const missingReasonResources = useMemo(
    () => listMissingExclusionReasons(allCandidates, selectedIds, exclusionReasons),
    [allCandidates, selectedIds, exclusionReasons],
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
  const { popover, reasonModal, closeAll: closePicker, handleToggleSelected: pickerToggleSelected } = picker;

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

  const approval = useConfirmSubmit({
    targetSourceId,
    request: async () => {
      const input = toApprovalRequestInput(allCandidates, selectedIds, drafts, exclusionReasons);
      await createApprovalRequest(targetSourceId, input);
    },
    // 확인 프레임이 물러난 뒤에 갱신한다 — 상태가 WAITING_APPROVAL 로 바뀌는 순간
    // 이 섹션이 Step 2 로 교체되므로, 순서가 반대면 프레임이 그려지지 않는다.
    settle: async () => {
      await refreshProject();
      approvalModal.close();
      setExpandedResourceId(null);
    },
  });

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

  // The instance itself is the working-list key (an AWS instance id is unique), so adding an
  // instance that is already in the list REPLACES its connection info rather than duplicating
  // the row — which is also how the edit path saves.
  const handleEc2Save = useCallback((instance: Ec2Instance, config: Ec2ConnectionConfig) => {
    // 현재 목록에서 판정한다 — updater 안에서 플래그를 세우면 React 가 그 함수를 언제
    // 실행할지 보장하지 않아(큐가 비었을 때만 즉시 계산한다), 바로 아래에서 읽는 값이
    // 배치 상황에 따라 달라진다. 이 핸들러는 이벤트에서 불리므로 렌더 시점의 목록이
    // 곧 현재 목록이다.
    const added = !manualEc2Ids.has(instance.instanceId);
    setManualEc2((previous) => {
      const index = previous.findIndex((entry) => entry.instance.instanceId === instance.instanceId);
      // 새로 담은 것이 맨 위 — 이어서 여러 대를 담는 흐름이라, 방금 담은 행이
      // 앞서 담은 행 아래로 밀리면 추가됐다는 사실이 눈에서 사라진다.
      if (index < 0) return [{ instance, config }, ...previous];
      const next = [...previous];
      next[index] = { instance, config };
      return next;
    });
    setEc2EditingId(null);
    // 수정 저장에는 마커도, 선택도 건드리지 않는다 — 수정은 접속 정보를 고치는 일이지
    // 다시 담는 일이 아니고, "방금 추가"는 그때 틀린 말이 된다.
    if (!added) return;
    // Adding an instance IS choosing it — the user came to this modal to integrate it.
    setSelectedIds((previous) => new Set(previous).add(instance.instanceId));
    setJustAddedEc2Id(instance.instanceId);
    // 담은 행이 현재 뷰에 안 걸리면 아무 일도 일어나지 않은 화면이 된다 — 수동 행에는
    // region 이 없어 리전 필터에서 곧바로 탈락하고, 검색어·제외 필터·2페이지 이후도
    // 같은 결과다. 재스캔과 같은 이유로 같은 초기화를 한다.
    tableSearchChange('');
    tableFilterChange('all');
    tableDbTypeChange('');
    tableRegionChange('');
    tablePageChange(0);
  }, [manualEc2Ids, setSelectedIds, tableSearchChange, tableFilterChange, tableDbTypeChange, tableRegionChange, tablePageChange]);

  // 마커의 수명. 배지 애니메이션(4s)이 끝나면 상태에서도 걷어내, 이후의 정렬·필터
  // 변경이 다 끝난 신호를 다시 그리지 않게 한다.
  useEffect(() => {
    if (justAddedEc2Id === null) return undefined;
    const timer = setTimeout(() => setJustAddedEc2Id(null), 4200);
    return () => clearTimeout(timer);
  }, [justAddedEc2Id]);

  // 화면 밖 행에 거는 신호는 아무 일도 하지 않는다 — 먼저 눈에 들어오게 한다.
  // block:'nearest' 라 이미 보이는 행은 스크롤하지 않는다.
  useEffect(() => {
    if (justAddedEc2Id === null) return;
    document.querySelector('[data-just-added="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [justAddedEc2Id]);

  const handleEc2Delete = useCallback((instanceId: string) => {
    setManualEc2((previous) => previous.filter((entry) => entry.instance.instanceId !== instanceId));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(instanceId);
      return next;
    });
    // 제외 사유도 함께 지운다 — 인스턴스 id 가 키라서, 지운 인스턴스를 다시 담으면
    // 예전 사유가 그대로 붙어 살아난다.
    setExclusions((previous) => {
      if (!(instanceId in previous)) return previous;
      const next = { ...previous };
      delete next[instanceId];
      return next;
    });
  }, [setSelectedIds, setExclusions]);

  // 수동으로 담은 행의 체크를 푸는 건 "제외"가 아니라 되돌리기다 — 스캔이 제안한 것을
  // 안 쓰겠다고 말하는 게 아니라, 내가 넣은 것을 도로 빼는 것이라 사유가 없다(승인
  // payload 도 NO_INSTALL_NEEDED 를 사유 검사에서 빼 둔다). 사유 팝오버를 거치면
  // 닫는 순간 아무 일도 일어나지 않아 체크가 그대로 남는 막다른 길이 된다.
  const handleToggleSelected = useCallback(
    (resourceId: string, checked: boolean, anchor: HTMLElement) => {
      if (checked || !manualEc2Ids.has(resourceId)) {
        pickerToggleSelected(resourceId, checked, anchor);
        return;
      }
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(resourceId);
        return next;
      });
    },
    [manualEc2Ids, pickerToggleSelected, setSelectedIds],
  );

  const rowActions = useMemo<CandidateRowActions>(() => ({
    toggleSelected: handleToggleSelected,
    reasonChipClick: picker.handleReasonChipClick,
    expandToggle: handleExpandToggle,
    endpointSave: handleEndpointSave,
    selectRdsInstance: handleSelectRdsInstance,
    editManualEc2: setEc2EditingId,
    deleteManualEc2: handleEc2Delete,
  }), [handleToggleSelected, picker.handleReasonChipClick, handleExpandToggle, handleEndpointSave, handleSelectRdsInstance, handleEc2Delete]);

  const handleRequestApproval = useCallback(() => {
    if (selectedIds.size === 0) return;
    const unconfigured = allCandidates.filter(
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
    const missingReasons = listMissingExclusionReasons(allCandidates, selectedIds, exclusionReasons);
    if (missingReasons.length > 0) {
      toast.warning(
        `제외 사유 입력이 필요합니다: ${missingReasons.map((candidate) => candidate.resourceId).join(', ')}`,
      );
      return;
    }
    approval.reset();
    approvalModal.open();
  }, [approval, approvalModal, allCandidates, drafts, exclusionReasons, selectedIds, toast]);

  const beginCompletion = completion.begin;
  const handleScanComplete = useCallback(async () => {
    // 확인 프레임을 먼저 세운다. 아래 refetch 가 곧바로 loading 을 켜지만, 이 함수의
    // setState 들은 한 배치로 묶이므로(React 18) 스켈레톤을 막는 건 순서가 아니라
    // selectPhase 의 completing 우선순위다 — 여기서 순서는 읽는 사람을 위한 것이다.
    beginCompletion();
    setDrafts(EMPTY_DRAFTS);
    setExpandedResourceId(null);
    // A manually added instance was found by the scan that just got replaced — its scan
    // version, and possibly the instance itself, no longer describe what is out there.
    setManualEc2([]);
    setEc2AddOpen(false);
    setEc2EditingId(null);
    // 재스캔이면 목록이 통째로 바뀐다 — 이전 검색·필터가 새 결과를 가리지 않게 초기화.
    tableSearchChange('');
    tableFilterChange('all');
    tableDbTypeChange('');
    tableRegionChange('');
    tablePageChange(0);
    closePicker();
    refetchAfterScan();
    await refreshProject();
  }, [beginCompletion, tableSearchChange, tableFilterChange, tableDbTypeChange, tableRegionChange, tablePageChange, closePicker, refetchAfterScan, refreshProject]);

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
            // A manually added instance is a row on its own — a scan that proposed nothing
            // must still show the table once the user has put something in it.
            hasCandidates: allCandidates.length > 0,
            completing: completion.stage !== 'idle',
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
          // AWS 전용 입구, 그리고 스캔 결과 위에 서 있을 때만 — 검색이 조회하는 것은
          // "최근 스캔에서 발견된 인스턴스"라, 스캔 전에는 열어도 빈 결과뿐이다.
          const showEc2Add = provider === 'AWS' && !readonly && showStrip;
          // 버튼은 표 위 툴바가 들고 있고, 툴바는 목록 화면에만 있다 — 안내 문구는
          // 버튼이 실제로 보이는 이 조건을 그대로 따라간다.
          const ec2AddVisible = showEc2Add && phase === 'list';
          // Counts only when the list is up: with no candidates they are all zero,
          // which is noise rather than information, and the band collapses to one
          // line. All three are in the candidate-DB unit (selected + excluded = eligible).
          const funnel = phase === 'list'
            ? {
              eligible: allCandidates.length,
              selected: selectedIds.size,
              excluded: Math.max(0, allCandidates.length - selectedIds.size),
              missingReasons: missingReasonResources.length,
              filter: table.filter,
              onFilterChange: handleFilterChange,
            }
            : undefined;

          // 화면이 스스로 바뀌는 흐름(스캔 → 확인 → 목록)을 소리로도 잇는다. 각
          // 프레임의 제목에 리전을 걸면 마지막 사건인 "목록 도착"만 영영 낭독되지
          // 않는다 — 그 시점엔 제목이 이미 언마운트됐기 때문이다. 리전은 페이즈보다
          // 오래 살아야 하므로 renderBody 바깥에 상주하고, 텍스트만 갈아끼운다.
          // settling 은 직전 구간과 같은 문장을 유지해 안내를 한 번 덜 쌓는다.
          const liveMessage = ((): string => {
            switch (phase) {
              case 'scanning':
                return finalizing ? '스캔 결과를 집계하고 있어요.' : '인프라 스캔을 진행하고 있어요.';
              case 'completing':
                return completion.stage === 'settling'
                  ? '스캔 결과를 집계하고 있어요.'
                  : '인프라 스캔이 끝났어요.';
              case 'list':
                return `연동 대상 ${candidates.length}건을 불러왔어요.`;
              case 'empty':
                return neverScanned ? '' : '발견된 리소스가 없어요.';
              case 'scanFailed':
                return '인프라 스캔에 실패했어요.';
              default:
                // fetching·fetchError 는 스켈레톤과 에러 박스가 스스로 말한다.
                return '';
            }
          })();

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
                return (
                  <ScanRunningState
                    progress={progress}
                    stage={finalizing ? 'finalizing' : 'scanning'}
                  />
                );
              case 'completing':
                // 같은 히어로 블록의 마지막 두 프레임. settling 은 바가 100%에
                // 닿는 걸 보여주고(집계 꼬리를 거쳐 왔다면 이미 가득 차 있다),
                // confirming 이 완료 체크를 세운다.
                return (
                  <ScanRunningState
                    progress={100}
                    stage={completion.stage === 'settling' ? 'finalizing' : 'complete'}
                  />
                );
              case 'scanFailed':
                return <ScanErrorState onRetry={startScan} />;
              case 'list':
                // Step 2 표 스택 그대로: 툴바(검색+필터, 상단 라운드) → 무윤곽 표 →
                // Pagination 마감 바(rounded-b). 윤곽은 Header/Footer 두 세그먼트뿐이다.
                //
                // 목록이 다른 프레임(확인·스켈레톤·러닝)을 밀어내고 들어올 때마다
                // 같은 방식으로 등장한다 — 페이즈가 바뀌면 이 노드가 새로 마운트되고,
                // 검색·필터·페이지 변경은 이 노드의 마운트를 유지하므로 재생되지 않는다.
                return (
                  <div className={scanTransition.reveal}>
                    <WaitingApprovalToolbar
                      searchValue={table.searchValue}
                      onSearchChange={handleSearchChange}
                      dbType={table.dbType}
                      onDbTypeChange={handleDbTypeChange}
                      region={table.region}
                      onRegionChange={handleRegionChange}
                      dbTypeOptions={table.dbTypeOptions}
                      regionOptions={table.regionOptions}
                      // EC2는 스캔이 DB로 판정하지 못하는 호스트라 후보 목록에 없을 수
                      // 있다 — 직접 찾아 담는 입구는 결과 테이블에 최대한 붙여, 필터
                      // 왼쪽의 컴팩트 액션으로 둔다.
                      actions={showEc2Add ? (
                        <button
                          type="button"
                          onClick={() => setEc2AddOpen(true)}
                          className={idcStyles.triggerBtn.ghostSm}
                        >
                          <PlusIcon className="h-3 w-3" />
                          EC2 추가
                        </button>
                      ) : undefined}
                    />
                    <CandidateResourceTable
                      candidates={visibleCandidates}
                      selectedIds={selectedIds}
                      exclusionReasons={exclusionReasons}
                      drafts={drafts}
                      expandedResourceId={expandedResourceId}
                      readonly={readonly}
                      actions={rowActions}
                      justAddedResourceId={justAddedEc2Id}
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
                {/* 스캔이 못 찾는 것을 먼저 말하고 그다음 어디를 누르는지 말한다 —
                    버튼 이름만 알려주면 왜 눌러야 하는지는 여전히 모른다. 버튼이
                    실제로 서 있는 목록 화면에서만 띄운다(가리킬 대상이 없으면 안내가
                    아니라 오답이다).
                    위 문단과 같은 층이다 — 둘 다 "이 화면에서 무엇을 하는가"이므로
                    토큰과 강조 문법을 공유한다. 한쪽만 작아지면 EC2 경로가 본문이
                    아니라 각주로 읽힌다. 강조는 여기서도 파랑 하나.
                    간격만 제목→문단(10px)보다 좁은 4px — 같은 층의 두 문단은 한
                    덩어리로 읽혀야 하고, 같은 간격을 주면 별개의 블록으로 갈라진다. */}
                {ec2AddVisible && (
                  <p className={cn('mt-1 break-keep', cardStyles.guidance)}>
                    EC2에 직접 설치해 쓰는 데이터베이스는 스캔이 찾지 못해요. 아래 표 오른쪽 위{' '}
                    <span className={primaryColors.text}>EC2 추가</span>에서 Instance ID로 검색해
                    연동 대상에 넣을 수 있어요.
                  </p>
                )}
              </header>

              <div className={cardStyles.body}>
                <p className="sr-only" aria-live="polite">{liveMessage}</p>
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
                      총 <strong className={textColors.primary}>{allCandidates.length}</strong>건 ·{' '}
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
                        disabled={approval.pending || approvalBlockReason != null}
                        className="flex items-center gap-2 disabled:pointer-events-none"
                      >
                        {approval.pending && <LoadingSpinner />}
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
          total={allCandidates.length}
          live={selectedIds.size}
          excluded={Math.max(0, allCandidates.length - selectedIds.size)}
          phase={approval.phase}
          pending={approval.pending}
          errorReason={approval.errorReason}
          onSubmit={approval.submit}
          onRetry={approval.retry}
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

      {/* 틴트도 배지도 보지 못하는 사용자에게 같은 사실을 말한다 — 시각 신호와
          같은 자리에서 한 번만. */}
      <p aria-live="polite" className="sr-only">
        {justAddedEc2Id === null ? '' : `EC2 인스턴스 ${justAddedEc2Id}을(를) 연동 대상 목록에 추가했어요.`}
      </p>

      {/* Mounted per open so the search query, the results and the form start fresh; the
          edit path passes the row's own pair, which selects the config step. */}
      {(ec2AddOpen || editingEc2 !== undefined) && (
        <Ec2AddModal
          targetSourceId={targetSourceId}
          addedInstanceIds={addedEc2InstanceIds}
          editing={editingEc2}
          onAdd={handleEc2Save}
          onClose={() => {
            setEc2AddOpen(false);
            setEc2EditingId(null);
          }}
        />
      )}
    </>
  );
};
