/**
 * 설치 상태 scenario fixtures — one target per verdict the ops console can show.
 *
 * The 인프라 작업 tab folds installation-status into "whose move it is"
 * (`installState.ts`, docs/ux/benchmark/infra-install-state.md). Each case below
 * pins one wire response to one target id (9101-9144) so the owner can open
 * `/pass/admin/pipelines/ops/target-sources/{id}?tab=infra` and see exactly that
 * state, instead of hunting for a demo target that happens to be in it.
 *
 * The four provider handlers ask `installScenarioResponse` first and serve the
 * scenario verbatim when the id matches; every other target keeps its derived mock.
 * Resource ids come from the target's own selected resources so the confirmed
 * integration join still works; only the step cells are scripted here.
 *
 * Patterns are per resource index (cycling), so `['FAIL', 'COMPLETED']` on four
 * resources reads FAIL · COMPLETED · FAIL · COMPLETED.
 */

type Step = 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'SKIP' | 'BDC_INSTALL_REQUIRED';
type Pattern = Step | Step[];

export type ScenarioProvider = 'aws' | 'gcp' | 'azure' | 'idc';

interface Scenario {
  provider: ScenarioProvider;
  /** AWS only — 수동 설치 (target metadata flag false). Drives the fixture, not the wire. */
  manual?: boolean;
  /** Korean label the mock project list carries. */
  label: string;
  /** How many selected resources the fixture holds (default 3). */
  resources?: number;
  /** `installation_status_unavailable` + FAILED last_check, no resources. */
  unavailable?: boolean;
  /** AWS only — `terraform_execution_role_verify.status`. */
  role?: Step;
  /** Cell patterns keyed by the wire field name of the step. */
  steps: Record<string, Pattern>;
  /** A guide sentence attached to every FAIL cell of that step. */
  guide?: { step: string; text: string };
}

const IP: Step = 'IN_PROGRESS';
const CO: Step = 'COMPLETED';
const SK: Step = 'SKIP';
const FA: Step = 'FAIL';

const AWS_STEPS = ['service_terraform', 'bdc_common_terraform', 'bdc_service_terraform'] as const;
const GCP_STEPS = [
  'service_side_subnet_creation',
  'service_side_terraform_apply',
  'bdc_side_terraform_apply',
] as const;
const AZURE_STEPS = [
  'azure_virtual_machine_subnet_creation',
  'azure_virtual_machine_terraform_apply',
  'bdc_side_terraform_apply',
  'service_side_private_endpoint_approval',
] as const;
const IDC_STEPS = [
  'bdc_side_cx_terraform_apply',
  'bdc_side_bdp_terraform_apply',
  'firewall_check',
] as const;

const cells = (keys: readonly string[], values: Pattern[]): Record<string, Pattern> =>
  Object.fromEntries(keys.map((key, i) => [key, values[i]]));

const AWS_FAIL_GUIDE = 'BDC VPC 피어링 수락 대기 중 timeout';
const AWS_MANUAL_FAIL_GUIDE =
  '서브넷 가용 IP 부족으로 ENI 생성에 실패했습니다. VPC 서브넷을 확인해 주세요.';

export const INSTALL_SCENARIOS: Record<number, Scenario> = {
  // ---- AWS 자동 설치 ---------------------------------------------------------
  9101: { provider: 'aws', label: 'AWS 자동 · 권한 부여 대기', role: IP, steps: cells(AWS_STEPS, [IP, IP, IP]) },
  9102: { provider: 'aws', label: 'AWS 자동 · 관리자 차례', role: CO, steps: cells(AWS_STEPS, [IP, IP, IP]) },
  9103: { provider: 'aws', label: 'AWS 자동 · 완료', role: CO, steps: cells(AWS_STEPS, [CO, CO, CO]) },
  9104: { provider: 'aws', label: 'AWS 자동 · 확인 불가', role: CO, unavailable: true, steps: {} },
  9105: {
    provider: 'aws',
    label: 'AWS 자동 · BDC 공통 실패',
    role: CO,
    resources: 4,
    steps: cells(AWS_STEPS, [CO, [FA, FA, CO, CO], IP]),
    guide: { step: 'bdc_common_terraform', text: AWS_FAIL_GUIDE },
  },
  // ---- AWS 수동 설치 ---------------------------------------------------------
  9111: { provider: 'aws', manual: true, label: 'AWS 수동 · 서비스 TF 대기', role: SK, steps: cells(AWS_STEPS, [IP, IP, IP]) },
  9112: { provider: 'aws', manual: true, label: 'AWS 수동 · 관리자 차례', role: SK, steps: cells(AWS_STEPS, [CO, IP, IP]) },
  9113: { provider: 'aws', manual: true, label: 'AWS 수동 · 완료', role: SK, steps: cells(AWS_STEPS, [CO, CO, CO]) },
  9114: { provider: 'aws', manual: true, label: 'AWS 수동 · 확인 불가', role: SK, unavailable: true, steps: {} },
  9115: {
    provider: 'aws',
    manual: true,
    label: 'AWS 수동 · 서비스 TF 실패',
    role: SK,
    resources: 4,
    steps: cells(AWS_STEPS, [[FA, CO, CO, CO], IP, IP]),
    guide: { step: 'service_terraform', text: AWS_MANUAL_FAIL_GUIDE },
  },
  // ---- GCP -------------------------------------------------------------------
  9121: { provider: 'gcp', label: 'GCP · Subnet 대기', steps: cells(GCP_STEPS, [IP, IP, IP]) },
  9122: { provider: 'gcp', label: 'GCP · 관리자 차례', steps: cells(GCP_STEPS, [CO, IP, IP]) },
  9123: { provider: 'gcp', label: 'GCP · 완료', steps: cells(GCP_STEPS, [CO, CO, CO]) },
  9124: { provider: 'gcp', label: 'GCP · 확인 불가', unavailable: true, steps: {} },
  9125: { provider: 'gcp', label: 'GCP · Subnet 전부 해당 없음', steps: cells(GCP_STEPS, [SK, IP, IP]) },
  9126: {
    provider: 'gcp',
    label: 'GCP · 리소스 일부만 남음',
    resources: 4,
    steps: cells(GCP_STEPS, [[CO, CO, SK, IP], [CO, CO, IP, IP], IP]),
  },
  // ---- Azure -----------------------------------------------------------------
  9131: { provider: 'azure', label: 'Azure · VM Subnet 대기', steps: cells(AZURE_STEPS, [IP, IP, IP, IP]) },
  9132: { provider: 'azure', label: 'Azure · VM TF 대기', steps: cells(AZURE_STEPS, [CO, IP, IP, IP]) },
  9133: { provider: 'azure', label: 'Azure · 관리자 차례', steps: cells(AZURE_STEPS, [CO, CO, IP, IP]) },
  9134: { provider: 'azure', label: 'Azure · PE 승인 대기', steps: cells(AZURE_STEPS, [CO, CO, CO, IP]) },
  9135: { provider: 'azure', label: 'Azure · 완료', steps: cells(AZURE_STEPS, [CO, CO, CO, CO]) },
  9136: { provider: 'azure', label: 'Azure · 확인 불가', unavailable: true, steps: {} },
  9137: { provider: 'azure', label: 'Azure · VM 없음', steps: cells(AZURE_STEPS, [SK, SK, IP, IP]) },
  // ---- IDC -------------------------------------------------------------------
  9141: { provider: 'idc', label: 'IDC · 관리자 BDC 차례', steps: cells(IDC_STEPS, [IP, IP, IP]) },
  9142: { provider: 'idc', label: 'IDC · 방화벽 확인 대기', steps: cells(IDC_STEPS, [CO, CO, IP]) },
  9143: { provider: 'idc', label: 'IDC · 완료', steps: cells(IDC_STEPS, [CO, CO, CO]) },
  9144: { provider: 'idc', label: 'IDC · 확인 불가', unavailable: true, steps: {} },
};

/** What the mock project list needs to register one scenario target. */
export interface ScenarioTarget {
  targetSourceId: number;
  provider: ScenarioProvider;
  manual: boolean;
  label: string;
  resources: number;
}

export const INSTALL_SCENARIO_TARGETS: ScenarioTarget[] = Object.entries(INSTALL_SCENARIOS).map(
  ([id, s]) => ({
    targetSourceId: Number(id),
    provider: s.provider,
    manual: s.manual === true,
    label: s.label,
    resources: s.resources ?? 3,
  }),
);

const CHECKED_AT = '2026-09-13T14:03:00+09:00';

const at = (pattern: Pattern, index: number): Step =>
  Array.isArray(pattern) ? pattern[index % pattern.length] : pattern;

const settled = (s: Step): boolean => s === 'COMPLETED' || s === 'SKIP';

export interface ScenarioResource {
  resourceId: string;
  resourceName: string | null;
}

/** The target's selected resources, in the shape the scenario rows are built from. */
export const scenarioResourcesOf = (project: {
  resources: readonly { resourceId: string; resourceName?: string; isSelected: boolean }[];
}): ScenarioResource[] =>
  project.resources
    .filter((r) => r.isSelected)
    .map((r) => ({ resourceId: r.resourceId, resourceName: r.resourceName ?? null }));

/**
 * The wire response for a scenario target, or `null` when the id is not one.
 * Callers pass the provider so an id registered for another cloud never answers.
 */
export function installScenarioResponse(
  provider: ScenarioProvider,
  targetSourceId: number,
  resources: readonly ScenarioResource[],
): Record<string, unknown> | null {
  const scenario = INSTALL_SCENARIOS[targetSourceId];
  if (!scenario || scenario.provider !== provider) return null;

  const roleVerify =
    provider === 'aws'
      ? {
          terraform_execution_role_verify: {
            status: scenario.role ?? 'COMPLETED',
            role_arn: scenario.role === 'IN_PROGRESS' ? null : 'arn:aws:iam::804656952396:role/exec',
          },
        }
      : {};

  if (scenario.unavailable) {
    return {
      last_check: {
        status: 'FAILED',
        checked_at: CHECKED_AT,
        fail_reason: '클라우드 설치 상태 조회에 실패했습니다.',
        installation_status_unavailable: true,
      },
      resources: [],
      ...roleVerify,
    };
  }

  const rows = resources.slice(0, scenario.resources ?? 3).map((resource, index) => {
    const cellsOf: Record<string, { status: Step; guide: string | null }> = {};
    for (const [key, pattern] of Object.entries(scenario.steps)) {
      const status = at(pattern, index);
      const guide =
        status === 'FAIL' && scenario.guide?.step === key ? scenario.guide.text : null;
      cellsOf[key] = { status, guide };
    }
    const statuses = Object.values(cellsOf).map((c) => c.status);
    const rollup: Step = statuses.includes('FAIL')
      ? 'FAIL'
      : statuses.every(settled)
        ? 'COMPLETED'
        : 'IN_PROGRESS';
    const pe = cellsOf.service_side_private_endpoint_approval;
    return {
      resource_id: resource.resourceId,
      resource_name: resource.resourceName,
      ...(provider === 'azure' ? { resource_type: 'AZURE_DB' } : {}),
      installation_status: rollup,
      ...cellsOf,
      // Azure's PE step carries the connection's own id and name on the wire.
      ...(pe
        ? {
            service_side_private_endpoint_approval: {
              id: `pe-${index + 1}`,
              name: `pe-${resource.resourceId}`,
              ...pe,
            },
          }
        : {}),
    };
  });

  const allDone = rows.every((r) => r.installation_status === 'COMPLETED');
  return {
    last_check: {
      status: allDone ? 'COMPLETED' : 'IN_PROGRESS',
      checked_at: CHECKED_AT,
      fail_reason: null,
      installation_status_unavailable: false,
    },
    resources: rows,
    ...roleVerify,
  };
}
