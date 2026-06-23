import type { InstallTaskStatus } from '@/lib/constants/install-task';
import type { InstallTaskPipelineItem } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';

/**
 * Azure has NO per-install phase/side field — only a per-resource lifecycle
 * `step` plus an `isVm` flag. The v15 UI nonetheless renders 3 install phases
 * (service-side resources / BDC-side resources / Private Link). This module
 * derives those 3 phases from the per-resource lifecycle.
 *
 * `AzureInstallStep` is defined here (not imported from AzureInstallationInline)
 * to avoid a circular import; AzureInstallationInline's `UnifiedInstallResource`
 * is structurally compatible with `AzurePhaseResource`.
 */
export type AzureInstallStep =
  | 'SUBNET_REQUIRED'
  | 'VM_TF_REQUIRED'
  | 'PE_NOT_REQUESTED'
  | 'PE_PENDING'
  | 'PE_REJECTED'
  | 'COMPLETED';

export interface AzurePhaseResource {
  isVm: boolean;
  step: AzureInstallStep;
}

export interface AzurePhaseSummary {
  status: InstallTaskStatus;
  completedCount: number;
  activeCount: number;
}

export interface AzurePhases {
  phase1: AzurePhaseSummary;
  phase2: AzurePhaseSummary;
  phase3: AzurePhaseSummary;
}

// Per-resource classification within a phase.
type ResourceState = 'done' | 'active' | 'failed' | 'pending';

/**
 * GCP aggregate rule (see getGcpStepSummary): no participants → done;
 * all done → done; any failed → failed; any active OR partial progress
 * (0 < done < participants) → running; otherwise pending.
 */
const aggregatePhase = (states: ResourceState[]): AzurePhaseSummary => {
  const activeCount = states.length;
  const completedCount = states.filter((s) => s === 'done').length;
  const hasFailed = states.some((s) => s === 'failed');
  const hasActive = states.some((s) => s === 'active');

  let status: InstallTaskStatus;
  if (activeCount === 0) status = 'done';
  else if (completedCount === activeCount) status = 'done';
  else if (hasFailed) status = 'failed';
  else if (hasActive || completedCount > 0) status = 'running';
  else status = 'pending';

  return { status, completedCount, activeCount };
};

// Phase 1 (subnet): participants = VM resources. SUBNET_REQUIRED → pending; else done.
const classifyPhase1 = (step: AzureInstallStep): ResourceState =>
  step === 'SUBNET_REQUIRED' ? 'pending' : 'done';

// Phase 2 (VM terraform): participants = VM resources.
// SUBNET_REQUIRED / VM_TF_REQUIRED → pending; PE_* or COMPLETED → done.
const classifyPhase2 = (step: AzureInstallStep): ResourceState =>
  step === 'SUBNET_REQUIRED' || step === 'VM_TF_REQUIRED' ? 'pending' : 'done';

// Phase 3 (Private Endpoint): participants = ALL resources.
// COMPLETED → done; PE_REJECTED → failed; PE_PENDING → active (request made,
// awaiting approval = in-progress, distinct from PE_NOT_REQUESTED); else pending.
const classifyPhase3 = (step: AzureInstallStep): ResourceState => {
  if (step === 'COMPLETED') return 'done';
  if (step === 'PE_REJECTED') return 'failed';
  if (step === 'PE_PENDING') return 'active';
  return 'pending';
};

const PENDING_PHASE: AzurePhaseSummary = { status: 'pending', completedCount: 0, activeCount: 0 };

export const deriveAzurePhases = (
  resources: readonly AzurePhaseResource[]
): AzurePhases => {
  // No resources at all → nothing installed; don't render three 완료 cards.
  if (resources.length === 0) {
    return { phase1: PENDING_PHASE, phase2: PENDING_PHASE, phase3: PENDING_PHASE };
  }
  const vmResources = resources.filter((r) => r.isVm);

  return {
    phase1: aggregatePhase(vmResources.map((r) => classifyPhase1(r.step))),
    phase2: aggregatePhase(vmResources.map((r) => classifyPhase2(r.step))),
    phase3: aggregatePhase(resources.map((r) => classifyPhase3(r.step))),
  };
};

// ===== Azure Pipeline Builder =====

// Card copy verbatim from design/SIT Prototype Athena v15.html (lines 6432-6453).
const AZURE_PHASE_CARDS = [
  {
    key: 'azureServiceResources',
    title: '서비스 측 리소스 설치 진행',
    sub: '담당 부서가 Subnet / NSG / Storage 등을 사전 구성하는 단계',
  },
  {
    key: 'azureBdcResources',
    title: 'BDC 측 리소스 설치 진행',
    sub: 'PII Agent VM, IAM Role, KeyVault 연결을 자동 배포 중',
  },
  {
    key: 'azurePrivateLink',
    title: 'Private Link 모듈 설치 진행',
    sub: 'Azure Private Link를 통한 Agent ↔ N-IRP 통신 채널 구성',
  },
] as const;

export const buildAzurePipelineItems = (
  resources: readonly AzurePhaseResource[]
): InstallTaskPipelineItem[] => {
  const phases = deriveAzurePhases(resources);
  const summaries = [phases.phase1, phases.phase2, phases.phase3];

  return AZURE_PHASE_CARDS.map((card, idx) => ({
    key: card.key,
    title: card.title,
    sub: card.sub,
    status: summaries[idx].status,
    completedCount: summaries[idx].completedCount,
    activeCount: summaries[idx].activeCount,
  }));
};
