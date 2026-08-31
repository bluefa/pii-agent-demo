/**
 * 설치 확인 게이트 — per-CSP installation status folded into ONE verdict the ops
 * screen can act on: 완료 / 미완료 / 확인할 수 없음.
 *
 * The contract is provider-shaped (getAwsInstallationStatus, getGcpInstallationStatus,
 * getInstallationStatus (Azure), getIdcInstallationStatus), but every one of them is
 * resource-centric: resources[] × per-step CloudInstallationStepStatusDto. The user-side
 * Step-4 adapters already fold that into `InstallDetailResource` (cells keyed by step
 * id), so this module takes that shape and adds the ONE thing the admin screen needs and
 * the user screen does not: **which steps are a constraint on the connection test**.
 *
 * That list is the only thing that differs per CSP (owner 2026-08-31):
 *   - AWS   — all three steps. Terraform has to have applied on both sides.
 *   - Azure — ONLY the two VM steps. Private Endpoint 승인 and BDC측 Terraform are not
 *             constraints ("Azure/GCP는 설치 제약은 없다고 보자, azure vm 리소스가
 *             선행되어야 함"): a PE still pending does not make the test fail the way a
 *             missing VM subnet does.
 *   - GCP   — none. The status is shown, and it never warns.
 *   - IDC   — all three. ⚠️ ASSUMED: the owner gave no instruction for IDC, and its two
 *             Terraform steps plus the firewall check are all prerequisites of reaching
 *             the host at all. Revisit if the owner says otherwise.
 *
 * AWS `terraform_execution_role_verify` is deliberately NOT a step here — the masthead
 * already owns the Terraform Role slot (#831), and a second verdict for it on the same
 * screen would be two answers to one question.
 *
 * ⛔ `unknown` NEVER warns. A partial set cannot prove an absence: a failed fetch, a
 * FAILED last_check or `installation_status_unavailable` all mean we did not read the
 * status, not that the install is fine and not that it is broken.
 */
import {
  isSettledInstallStatus,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';

/** Admin ops is Korean-only (the language toggle does not reach this console). */
const t = INSTALL_COPY.ko;
const idcT = IDC_COPY.ko;

/** 실행 주체 — the two sides the 인프라 작업 tab already groups its Terraform tasks by. */
export type InstallSide = 'service' | 'bdc';

/** One step of one provider's install, as this screen states it. */
export interface InstallGateStepDef {
  /** Cell key inside `InstallDetailResource.cells` — the adapter's own key, not the wire field. */
  id: string;
  title: string;
  side: InstallSide;
  /** Does an unsettled cell here mean the connection test will fail on that resource? */
  required: boolean;
  /**
   * Pill wording that replaces the generic status word for this step — Azure's PE approval
   * carries domain wording on the shared buckets, and it is the adapter's own (the same
   * strings `buildAzureInstallDetail` bakes into the cells), not a second vocabulary.
   */
  labels?: Partial<Record<InstallStepValue, string>>;
}

/** A step with its aggregate over every resource. */
export interface InstallGateStep extends InstallGateStepDef {
  /** Worst cell across the resources — the pill's value. */
  worst: InstallStepValue;
  /** Settled (COMPLETED/SKIP) cells, and how many there are in total. */
  done: number;
  total: number;
  /** Every cell is SKIP — 이 단계에 해당하는 리소스가 없다. Not the same as done. */
  na: boolean;
}

export type InstallGateKind = 'complete' | 'incomplete' | 'unknown';

export interface InstallGateResult {
  kind: InstallGateKind;
  /** Every step, required or not — the card shows them all; only `required` ones warn. */
  steps: InstallGateStep[];
}

/**
 * The AWS 서비스 측 step is named after HOW it runs: in manual mode the service owner
 * applies the script by hand, in auto mode BDC applies it for them. Same step, same cell.
 */
const awsSteps = (manualInstall: boolean): InstallGateStepDef[] => [
  {
    id: 'service',
    title: manualInstall ? t.aws.serviceTitleManual : t.aws.serviceTitleAuto,
    side: 'service',
    required: true,
  },
  { id: 'bdcCommon', title: t.aws.bdcCommonTitle, side: 'bdc', required: true },
  { id: 'bdcService', title: t.aws.bdcServiceTitle, side: 'bdc', required: true },
];

const azureSteps: InstallGateStepDef[] = [
  { id: 'vmSubnet', title: t.azure.vmSubnetTitle, side: 'service', required: true },
  { id: 'vmApply', title: t.azure.vmApplyTitle, side: 'service', required: true },
  { id: 'bdc', title: t.azure.bdcTitle, side: 'bdc', required: false },
  {
    id: 'pe',
    title: t.azure.peTitle,
    side: 'service',
    required: false,
    labels: {
      COMPLETED: t.azure.peApproved,
      IN_PROGRESS: t.azure.pePending,
      FAIL: t.azure.peFailed,
      UNKNOWN: t.azure.peUnknown,
    },
  },
];

const gcpSteps: InstallGateStepDef[] = [
  { id: 'subnet', title: t.gcp.subnetTitle, side: 'service', required: false },
  { id: 'service', title: t.gcp.serviceTitle, side: 'service', required: false },
  { id: 'bdc', title: t.gcp.bdcTitle, side: 'bdc', required: false },
];

const idcSteps: InstallGateStepDef[] = [
  { id: 'cx', title: idcT.step4CxTitle, side: 'bdc', required: true },
  { id: 'bdp', title: idcT.step4BdpTitle, side: 'bdc', required: true },
  { id: 'firewall', title: idcT.step4FirewallTitle, side: 'service', required: true },
];

/**
 * Providers this gate can speak for — the four the installation-status contract covers.
 * SDU is absent on purpose: install-v1 has no SDU installation-status operation, so the
 * screen says nothing rather than guessing from the CSP underneath it.
 */
export type InstallGateProvider = 'aws' | 'azure' | 'gcp' | 'idc';

export const isInstallGateProvider = (key: string): key is InstallGateProvider =>
  key === 'aws' || key === 'azure' || key === 'gcp' || key === 'idc';

export const installGateSteps = (
  provider: InstallGateProvider,
  manualInstall: boolean,
): InstallGateStepDef[] => {
  switch (provider) {
    case 'aws':
      return awsSteps(manualInstall);
    case 'azure':
      return azureSteps;
    case 'gcp':
      return gcpSteps;
    case 'idc':
      return idcSteps;
  }
};

/**
 * Worst-wins precedence, mirroring `aggregateCells` in InstallStatusDetail: 실패가 먼저,
 * 그다음 진행중, 그다음 남의 차례(BDC 대기), 그다음 못 읽은 값. 완료와 해당 없음은
 * 둘 다 정착이지만 SKIP 이 가장 조용하다.
 */
const SEVERITY: Record<InstallStepValue, number> = {
  FAIL: 5,
  IN_PROGRESS: 4,
  BDC_INSTALL_REQUIRED: 3,
  UNKNOWN: 2,
  COMPLETED: 1,
  SKIP: 0,
};

const aggregate = (
  def: InstallGateStepDef,
  resources: readonly InstallDetailResource[],
): InstallGateStep => {
  // A resource whose adapter produced no cell for this step is not evidence of anything —
  // it is left out of both numerator and denominator rather than counted as waiting.
  const cells = resources
    .map((resource) => resource.cells[def.id])
    .filter((cell): cell is NonNullable<typeof cell> => cell != null)
    .map((cell) => cell.status);

  const done = cells.filter(isSettledInstallStatus).length;
  const worst = cells.reduce<InstallStepValue>(
    (acc, value) => (SEVERITY[value] > SEVERITY[acc] ? value : acc),
    'SKIP',
  );
  return {
    ...def,
    worst: cells.length === 0 ? 'UNKNOWN' : worst,
    done,
    total: cells.length,
    na: cells.length > 0 && cells.every((value) => value === 'SKIP'),
  };
};

export interface InstallGateInput {
  provider: InstallGateProvider;
  /** AWS only — picks the 서비스 측 step's name. Ignored elsewhere. */
  manualInstall: boolean;
  /** The adapter output. `null` = not read yet, or the fetch failed. */
  detail: {
    lastCheck: InstallLastCheck | null;
    /** `installation_status_unavailable` — the upstream said it cannot answer. */
    unavailable: boolean;
    resources: readonly InstallDetailResource[];
  } | null;
}

/**
 * The verdict + every step's aggregate.
 *
 * `complete` demands that every REQUIRED step's every cell is settled (COMPLETED or
 * SKIP). Anything else with a readable answer is `incomplete`. With nothing readable —
 * no detail, a FAILED last_check, `installation_status_unavailable`, or zero resources —
 * the answer is `unknown`, which is the one verdict that never warns.
 *
 * A provider with NO required steps (GCP) is therefore `complete` as soon as the status
 * is readable: there is no constraint to fail, so there is nothing to warn about.
 */
export const installGate = ({
  provider,
  manualInstall,
  detail,
}: InstallGateInput): InstallGateResult => {
  const defs = installGateSteps(provider, manualInstall);

  if (
    detail === null
    || detail.unavailable
    || detail.lastCheck?.status === 'FAILED'
    // 리소스가 없으면 셀 대상이 없다 — "전부 완료" 는 빈 집합에서 저절로 참이 되고,
    // 그건 확인한 사실이 아니라 확인할 것이 없었다는 뜻이다.
    || detail.resources.length === 0
  ) {
    return {
      kind: 'unknown',
      steps: defs.map((def) => ({ ...def, worst: 'UNKNOWN', done: 0, total: 0, na: false })),
    };
  }

  const steps = defs.map((def) => aggregate(def, detail.resources));
  const settled = steps
    .filter((step) => step.required)
    .every((step) => step.done === step.total);

  return { kind: settled ? 'complete' : 'incomplete', steps };
};

/** REQUIRED steps that are not settled — what the warn box lists and the confirm counts. */
export const openRequiredSteps = (result: InstallGateResult): InstallGateStep[] =>
  result.kind === 'incomplete'
    ? result.steps.filter((step) => step.required && step.done !== step.total)
    : [];

/**
 * 전체 진척 — 판정이 걸려 있는 단계만 센다. 제약이 아닌 단계의 진행이 판정을 흐리지 않는다.
 *
 * 필수 단계가 하나도 없는 프로바이더(GCP)는 전 단계를 센다: 0/0 은 진척이 아니라 세지
 * 않았다는 뜻이고, 그 화면이 말하려는 것은 「제약이 없다」이지 「아무것도 없다」가 아니다.
 */
export const requiredProgress = (result: InstallGateResult): { done: number; total: number } => {
  const required = result.steps.filter((step) => step.required);
  return (required.length > 0 ? required : result.steps).reduce(
    (acc, step) => ({ done: acc.done + step.done, total: acc.total + step.total }),
    { done: 0, total: 0 },
  );
};
