/**
 * 설치 상태 — whose move it is, folded from installation-status alone.
 *
 * The 인프라 작업 tab used to list InfraManager's own Terraform job records
 * (terraform-status). That answers "what did we run", never "who has to do what
 * now", and the wire enum names (AWS_BDC_SERVICE_COMMON …) meant nothing to the
 * operator reading them. This fold reads the CSP-side install status instead —
 * one owner per step, one verdict per target (docs/ux/benchmark/infra-install-state.md).
 *
 * Owner rules (2026-09-13):
 *   - installation-status is the ONLY source. The install mode (자동/수동) comes
 *     from the target detail the screen already holds.
 *   - A cell that is not COMPLETED/SKIP means 조치 필요. IN_PROGRESS is NOT
 *     "running": the real BE capture sends IN_PROGRESS for every unfinished cell,
 *     including ones nobody has started. Whether a run is live is the 현재 작업
 *     card's job, not this fold's.
 *   - The first unsettled step in execution order is the one to act on; the ones
 *     after it are 대기 (derived from order, the wire cannot say it).
 *   - FAIL is not a state of its own: same verdict, the row reads 조회 실패 (the
 *     owner's word for it — the contract does not say what failed) and the
 *     resource carries its guide.
 *   - The resources still open on a step are listed by id (`open`), so the card
 *     can name WHICH database is left instead of only how many
 *     (docs/ux/benchmark/idc-install-state-rows.md). The role check is
 *     target-level and lists nothing.
 *   - A step that is SKIP on every resource (or has no cell anywhere) is dropped —
 *     no row, no state. GCP without the Subnet option and Azure without a VM lose a
 *     step this way, and AWS 수동 has no role check.
 *   - Not read (fetch failed, `installation_status_unavailable`, FAILED last_check,
 *     zero resources) is 「확인 불가」, never 「할 일 없음」.
 */
import {
  isSettledInstallStatus,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallStepCell,
  type InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';

export type InstallSide = '서비스' | '관리자';

export type InstallStateKind = 'svc' | 'me' | 'done' | 'unk';

export type InstallStepState = 'done' | 'now' | 'wait' | 'fail';

/** One resource whose cell on a step is not settled. */
export interface InstallOpenResource {
  resourceId: string;
  /** The CSP-side name when the wire carries one (IDC does not). */
  resourceName: string | null;
  failed: boolean;
  guide: string | null;
}

export interface InstallStateStep {
  id: string;
  title: string;
  side: InstallSide;
  state: InstallStepState;
  /** Settled cells (COMPLETED or SKIP) out of `total`. */
  done: number;
  total: number;
  /** FAIL cells out of `total`. */
  failed: number;
  /** Resources not yet settled on this step, in wire order. Empty for the role check. */
  open: InstallOpenResource[];
  /** Whether the card draws `open` as rows. True for the Azure service steps and IDC 접근 허용 only. */
  listResources: boolean;
  /** The state an open (not failed) resource row prints. */
  openLabel: string;
}

export interface InstallStateView {
  kind: InstallStateKind;
  sentence: string;
  steps: InstallStateStep[];
}

export interface InstallStateInput {
  /** Already normalized by the screen (`pipelineProviderKey`). */
  provider: string;
  /** AWS only — the service applies the script itself (no role check, service owns step 1). */
  manualInstall: boolean;
  /**
   * True while the first read is still in flight. With no snapshot yet the fold
   * returns `null` instead of 「확인 불가」 — a read that has not answered is not a
   * read that failed, and the card draws its skeleton for `null` + loading.
   */
  loading?: boolean;
  /** The adapter output. `null` = not read yet, or the fetch failed. */
  detail: {
    lastCheck: InstallLastCheck | null;
    unavailable: boolean;
    resources: readonly InstallDetailResource[];
    /** AWS `terraform_execution_role_verify.status` — a target-level cell. */
    roleVerify?: InstallStepValue | null;
  } | null;
}

interface ChainStep {
  id: string;
  title: string;
  side: InstallSide;
  /** The verdict sentence when THIS step is the first unsettled one. */
  sentence: string;
  /** False: the card lists no resources under this step (AWS, GCP, every BDC-side step) — counts and guides only. */
  listResources?: false;
  /** What an open resource row says for THIS step when it is not 조치 필요 (owner wording). */
  openLabel?: string;
}

const ME = '관리자가 Terraform을 적용할 차례입니다';
const ME_IDC = '관리자가 BDC Terraform을 적용할 차례입니다';

/** The role check is target-level, so it is keyed apart from the resource cells. */
export const ROLE_STEP_ID = 'role';

// AWS never lists resources under a step (owner 2026-09-15): counts and guides only.
const AWS_BDC: ChainStep[] = [
  { id: 'bdcCommon', title: 'BDC 공통 영역', side: '관리자', sentence: ME, listResources: false },
  { id: 'bdcService', title: 'BDC 서비스 영역', side: '관리자', sentence: ME, listResources: false },
];

/** Execution order per provider (service-side TF → BDC common → BDC service is the confirmed AWS order). */
const CHAINS: Record<string, ChainStep[]> = {
  awsAuto: [
    {
      id: ROLE_STEP_ID,
      title: 'Terraform 권한 부여 확인',
      side: '서비스',
      sentence: '서비스 담당자가 Terraform 권한을 부여해야 합니다',
      listResources: false,
    },
    { id: 'service', title: '서비스 계정 Terraform 적용', side: '관리자', sentence: ME, listResources: false },
    ...AWS_BDC,
  ],
  awsManual: [
    {
      id: 'service',
      title: '서비스 측 Terraform 적용',
      side: '서비스',
      sentence: '서비스 담당자가 Terraform을 직접 적용해야 합니다',
      listResources: false,
    },
    ...AWS_BDC,
  ],
  // GCP lists no resources either (owner 2026-09-15); Azure is the one cloud that does.
  gcp: [
    {
      id: 'subnet',
      title: 'PSC용 Subnet 생성',
      side: '서비스',
      sentence: '서비스 담당자가 PSC용 Subnet을 만들어야 합니다',
      listResources: false,
    },
    // Named after the project it lands in, applied by BDC — so the operator's move.
    { id: 'service', title: '서비스측 Terraform 적용', side: '관리자', sentence: ME, listResources: false },
    { id: 'bdc', title: 'BDC측 Terraform 적용', side: '관리자', sentence: ME, listResources: false },
  ],
  azure: [
    {
      id: 'vmSubnet',
      title: 'VM Subnet 생성',
      side: '서비스',
      sentence: '서비스 담당자가 VM 리소스를 만들어야 합니다',
    },
    {
      id: 'vmApply',
      title: 'VM Terraform 적용',
      side: '서비스',
      sentence: '서비스 담당자가 VM Terraform을 적용해야 합니다',
    },
    // The BDC side says done / not done only, as on IDC (owner 2026-09-15).
    { id: 'bdc', title: 'BDC측 Terraform 적용', side: '관리자', sentence: ME, listResources: false },
    // The second service turn: BDC's apply raises the connection request, the
    // service approves it in the Azure portal.
    {
      id: 'pe',
      title: 'Private Endpoint 승인',
      side: '서비스',
      sentence: '서비스 담당자가 Private Endpoint 연결을 승인해야 합니다',
    },
  ],
  // The contract fixes no order here; BDC first is the owner's reading (the
  // firewall opens toward a source IP that exists only after BDC's apply).
  // The BDC side says done / not done only — no database IPs under it (owner 2026-09-15).
  // The IPs belong to 접근 허용: that is where the service owner opens one at a time.
  idc: [
    { id: 'cx', title: 'BDC CX 영역', side: '관리자', sentence: ME_IDC, listResources: false },
    { id: 'bdp', title: 'BDC BDP 영역', side: '관리자', sentence: ME_IDC, listResources: false },
    {
      id: 'firewall',
      title: '접근 허용',
      side: '서비스',
      sentence: '서비스 담당자가 접근 허용을 확인해야 합니다',
      openLabel: '서비스측 방화벽 확인 요청 필요',
    },
  ],
};

const chainFor = (provider: string, manualInstall: boolean): ChainStep[] | null => {
  if (provider === 'aws') return manualInstall ? CHAINS.awsManual : CHAINS.awsAuto;
  return CHAINS[provider] ?? null;
};

export const DONE_SENTENCE = '모든 단계가 완료됐습니다';
export const UNKNOWN_SENTENCE = '설치 상태를 확인하지 못했습니다';

const UNKNOWN: InstallStateView = { kind: 'unk', sentence: UNKNOWN_SENTENCE, steps: [] };

/** `null` = this target has no install status in this console (SDU, unknown provider). */
export function installStateView({
  provider,
  manualInstall,
  detail,
  loading = false,
}: InstallStateInput): InstallStateView | null {
  const chain = chainFor(provider, manualInstall);
  if (!chain) return null;
  if (loading && detail === null) return null;
  if (
    detail === null ||
    detail.unavailable ||
    detail.lastCheck?.status === 'FAILED' ||
    detail.resources.length === 0
  ) {
    return UNKNOWN;
  }

  const steps: InstallStateStep[] = [];
  for (const step of chain) {
    const cells: Array<{ resource: InstallDetailResource | null } & InstallStepCell> =
      step.id === ROLE_STEP_ID
        ? detail.roleVerify
          ? [{ resource: null, status: detail.roleVerify, guide: null }]
          : []
        : detail.resources.flatMap((r) =>
            r.cells[step.id] ? [{ resource: r, ...r.cells[step.id] }] : [],
          );
    // No cell anywhere, or SKIP everywhere: the step does not exist for this target.
    if (cells.length === 0 || cells.every((c) => c.status === 'SKIP')) continue;

    const openCells = cells.filter((c) => !isSettledInstallStatus(c.status));
    steps.push({
      id: step.id,
      title: step.title,
      side: step.side,
      state: 'wait',
      done: cells.length - openCells.length,
      total: cells.length,
      failed: openCells.filter((c) => c.status === 'FAIL').length,
      listResources: step.listResources !== false,
      openLabel: step.openLabel ?? '조치 필요',
      open: openCells.flatMap((c) =>
        c.resource
          ? [
              {
                resourceId: c.resource.resourceId,
                resourceName: c.resource.resourceName,
                failed: c.status === 'FAIL',
                guide: c.guide,
              },
            ]
          : [],
      ),
    });
  }
  if (steps.length === 0) return UNKNOWN;

  const firstOpen = steps.findIndex((s) => s.done < s.total);
  for (const [i, s] of steps.entries()) {
    if (s.failed > 0) s.state = 'fail';
    else if (s.done === s.total) s.state = 'done';
    else s.state = i === firstOpen ? 'now' : 'wait';
  }

  if (firstOpen === -1) return { kind: 'done', sentence: DONE_SENTENCE, steps };
  const chainStep = chain.find((c) => c.id === steps[firstOpen].id) as ChainStep;
  return {
    kind: chainStep.side === '서비스' ? 'svc' : 'me',
    sentence: chainStep.sentence,
    steps,
  };
}
