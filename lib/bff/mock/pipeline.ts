/**
 * In-memory, stateful mock of the pipeline-orchestrator (LIN-25 Phase A).
 *
 * Everything here is authored in WIRE FORMAT (snake_case, ISO-8601 strings,
 * upstream enum constant names) and returned as `{ status, body }` VERBATIM —
 * the pipeline BFF domain never throws on non-2xx (contract). Business rules
 * (unique active run → 409, two-phase cancel, statistics, recipe preview) mirror
 * the upstream semantics documented in docs/api/pipeline-orchestrator-bff.md and
 * verified against pipeline-orchestrator source (enums / DTOs / recipes).
 *
 * FIDELITY NOTES (deviations from design/pipeline/admin-pipeline.html, justified):
 *  - Task/recipe names use the REAL backend catalog (RecipeDefinition /
 *    TaskDefinition / TaskOperation), not the design's invented names. As a
 *    result GCP/Azure recipes have NO condition-check step — NETWORK_READY_V1 is
 *    the only CONDITION_CHECK and appears only in AWS_INSTALL_V1.
 *  - The app seeds no IDC target-source, so the design's IDC pipeline is remapped
 *    to an AWS target. Fixture target_source_ids reference REAL mock seeds so the
 *    pipeline pages join up with the services / target-source pages.
 *  - Fixture timestamps are anchored relative to module-load NOW so the 1h/1d/7d
 *    period windows never rot.
 */
import { getProjectByTargetSourceId } from '@/lib/mock-data';
import type {
  CloudProvider,
  ErrorCode,
  LivePipelineStatistics,
  OrchestratorErrorBody,
  OrchestratorRawResponse,
  PipelineDetail,
  PipelineStatistics,
  PipelineStatus,
  PipelineSummary,
  PipelineType,
  RecipePreview,
  RecipePreviewStep,
  SpringPage,
  SpringSort,
  StatisticsPeriodToken,
  TaskAttemptView,
  TaskCatalogEntry,
  TaskCatalogResponse,
  TaskCheckView,
  TaskDefinitionView,
  TaskDetail,
  TaskKind,
  TaskOperation,
  TaskStatus,
  TaskSummary,
  TerraformJobResultDetail,
  TerraformJobResultSummary,
  TerraformJobStateDetail,
  TerraformJobStateSummary,
} from '@/lib/pipeline/types';

// ═══════════════════════════════════════════════════════════════════════════
// Task catalog (25 TaskDefinitions) — faithful to pipeline-orchestrator source
// ═══════════════════════════════════════════════════════════════════════════

type JobType = 'PLAN' | 'APPLY' | 'DESTROY';

interface CatalogDef {
  name: string;
  provider: CloudProvider;
  operation: TaskOperation;
  kind: TaskKind;
  displayName: string;
  description: string;
  dispatchApi?: string;
  statusApi: string;
  resultApi?: string;
  successPolicy: string;
  resultStorage: string;
}

const SUCCESS_STATE: Record<JobType, string> = { PLAN: 'COMPLETED', APPLY: 'COMPLETED', DESTROY: 'DESTROYED' };
const FAILED_STATE = 'FAILED';

const terraformSuccessPolicy = (jobType: JobType): string =>
  '디스패치가 만든 모든 job을 polling_interval 간격으로 상태 API로 폴링한다. 모든 job의 terraformState가 '
  + `${SUCCESS_STATE[jobType]}이면 성공이다. 하나라도 ${FAILED_STATE}이면 나머지 job이 종결될 때까지 기다린 뒤 `
  + 'JOB_FAILED로 판정한다. attempt 시작 후 execution_timeout에 도달하면 더 기다리지 않고 그때까지 '
  + `${FAILED_STATE} 관측이 있으면 JOB_FAILED, 없으면 EXECUTION_TIMEOUT으로 판정한다. 두 실패 판정과 호출 오류는 `
  + 'fail_count로 누적되며, max_fail_count에 도달할 때까지 멱등 재디스패치로 재시도한다.';

const TERRAFORM_RESULT_STORAGE =
  '판정이 내려지는 turn에 종결된 job마다 result API로 terraform log를 조회해 terraform_result 테이블에 job당 1행으로 '
  + '저장한다. 저장 상한을 넘는 본문은 앞부분을 절단하고 truncated로 표시하며, 조회에 실패한 job은 본문 없이 '
  + 'result_path만 남긴다. 이 저장은 관찰 전용이라 태스크 판정에는 영향을 주지 않는다.';

const CONDITION_SUCCESS_POLICY =
  '디스패치 없이 조건 확인 API를 polling_interval 간격으로 호출한다. 조건 충족이 관측되면 성공이고, 미충족과 호출 '
  + '오류는 fail_count로 누적돼 max_fail_count에 도달하면 실패한다(execution_timeout 대신 재시도 예산으로 경계된다).';

const CONDITION_RESULT_STORAGE =
  '별도 result 저장은 없다 — 폴 관찰(호출 횟수, 마지막 외부 상태)은 task_check에 남는다.';

const tf = (
  name: string,
  provider: CloudProvider,
  operation: TaskOperation,
  displayName: string,
  description: string,
  jobType: JobType,
  dispatchApi: string,
  statusApi: string,
  resultApi: string,
): CatalogDef => ({
  name,
  provider,
  operation,
  kind: 'TERRAFORM_JOB',
  displayName,
  description,
  dispatchApi,
  statusApi,
  resultApi,
  successPolicy: terraformSuccessPolicy(jobType),
  resultStorage: TERRAFORM_RESULT_STORAGE,
});

const CATALOG_DEFS: CatalogDef[] = [
  // ── AWS Service Level ──
  tf('AWS_SERVICE_PLAN_V1', 'AWS', 'AWS_SERVICE_TF_PLAN', 'AWS Service Level 테라폼 Plan',
    '대상 AWS service level 인프라의 Terraform plan을 실행해 변경 내용을 산출한다.', 'PLAN',
    'POST /infra/target-sources/{targetSourceId}/terraform-jobs/plan',
    'GET /infra/terraform-jobs/plan/{terraformJobId}',
    'GET /infra/terraform-jobs/plan/{terraformJobId}/result'),
  tf('AWS_SERVICE_APPLY_V1', 'AWS', 'AWS_SERVICE_TF_APPLY', 'AWS Service Level 테라폼 Apply',
    '대상의 AWS service level 인프라를 Terraform apply로 구성한다.', 'APPLY',
    'POST /infra/target-sources/{targetSourceId}/terraform-jobs/apply',
    'GET /infra/terraform-jobs/apply/{terraformJobId}',
    'GET /infra/terraform-jobs/apply/{terraformJobId}/result'),
  tf('AWS_SERVICE_DESTROY_V1', 'AWS', 'AWS_SERVICE_TF_DESTROY', 'AWS Service Level 테라폼 Destroy',
    '대상의 AWS service level 인프라를 Terraform destroy로 제거한다.', 'DESTROY',
    'DELETE /infra/target-sources/{targetSourceId}/terraform-jobs/destroy',
    'GET /infra/terraform-jobs/destroy/{terraformJobId}',
    'GET /infra/terraform-jobs/destroy/{terraformJobId}/result'),
  // ── AWS BDC Common ──
  tf('AWS_BDC_COMMON_PLAN_V1', 'AWS', 'AWS_BDC_COMMON_TF_PLAN', 'AWS BDC Common 테라폼 Plan',
    'AWS BDC service level common 인프라의 Terraform plan을 실행해 변경 내용을 산출한다.', 'PLAN',
    'POST /infra/target-sources/{targetSourceId}/aws/service/level/common/terraform/plan',
    'GET /infra/aws/service/level/common/terraform/{terraformJobId}?jobType=PLAN',
    'GET /infra/aws/service/level/common/terraform/{terraformJobId}/result?jobType=PLAN'),
  tf('AWS_BDC_COMMON_APPLY_V1', 'AWS', 'AWS_BDC_COMMON_TF_APPLY', 'AWS BDC Common 테라폼 Apply',
    'AWS BDC service level common 인프라를 Terraform apply로 구성한다.', 'APPLY',
    'POST /infra/target-sources/{targetSourceId}/aws/service/level/common/terraform/apply',
    'GET /infra/aws/service/level/common/terraform/{terraformJobId}?jobType=APPLY',
    'GET /infra/aws/service/level/common/terraform/{terraformJobId}/result?jobType=APPLY'),
  tf('AWS_BDC_COMMON_DESTROY_V1', 'AWS', 'AWS_BDC_COMMON_TF_DESTROY', 'AWS BDC Common 테라폼 Destroy',
    'AWS BDC service level common 인프라를 Terraform destroy로 제거한다.', 'DESTROY',
    'POST /infra/target-sources/{targetSourceId}/aws/service/level/common/terraform/destroy',
    'GET /infra/aws/service/level/common/terraform/{terraformJobId}?jobType=DESTROY',
    'GET /infra/aws/service/level/common/terraform/{terraformJobId}/result?jobType=DESTROY'),
  // ── AWS BDC Service Level ──
  tf('AWS_BDC_SERVICE_LEVEL_PLAN_V1', 'AWS', 'AWS_BDC_SERVICE_LEVEL_TF_PLAN', 'AWS BDC Service Level 테라폼 Plan',
    'AWS BDC service level 인프라의 Terraform plan을 실행해 변경 내용을 산출한다.', 'PLAN',
    'POST /infra/target-sources/{targetSourceId}/bdc-service-level-terraform-jobs/plan',
    'GET /infra/bdc-service-level-terraform-jobs/plan/{terraformJobId}',
    'GET /infra/bdc-service-level-terraform-jobs/plan/{terraformJobId}/result'),
  tf('AWS_BDC_SERVICE_LEVEL_APPLY_V1', 'AWS', 'AWS_BDC_SERVICE_LEVEL_TF_APPLY', 'AWS BDC Service Level 테라폼 Apply',
    'AWS BDC service level 인프라를 Terraform apply로 구성한다.', 'APPLY',
    'POST /infra/target-sources/{targetSourceId}/bdc-service-level-terraform-jobs/apply',
    'GET /infra/bdc-service-level-terraform-jobs/action/{terraformJobId}?jobType=APPLY',
    'GET /infra/bdc-service-level-terraform-jobs/action/{terraformJobId}/result?jobType=APPLY'),
  tf('AWS_BDC_SERVICE_LEVEL_DESTROY_V1', 'AWS', 'AWS_BDC_SERVICE_LEVEL_TF_DESTROY', 'AWS BDC Service Level 테라폼 Destroy',
    'AWS BDC service level 인프라를 Terraform destroy로 제거한다.', 'DESTROY',
    'DELETE /infra/target-sources/{targetSourceId}/bdc-service-level-terraform-jobs/remove',
    'GET /infra/bdc-service-level-terraform-jobs/action/{terraformJobId}?jobType=DESTROY',
    'GET /infra/bdc-service-level-terraform-jobs/action/{terraformJobId}/result?jobType=DESTROY'),
  // ── GCP Service ──
  tf('GCP_SERVICE_PLAN_V1', 'GCP', 'GCP_SERVICE_TF_PLAN', 'GCP Service 테라폼 Plan',
    'GCP 서비스 인프라의 Terraform plan을 실행해 변경 내용을 산출한다.', 'PLAN',
    'POST /infra/target-sources/{targetSourceId}/gcp/service-terraform-jobs?jobType=PLAN',
    'GET /infra/gcp/service-terraform-jobs/{terraformJobId}?jobType=PLAN',
    'GET /infra/gcp/service-terraform-jobs/{terraformJobId}/result?jobType=PLAN'),
  tf('GCP_SERVICE_APPLY_V1', 'GCP', 'GCP_SERVICE_TF_APPLY', 'GCP Service 테라폼 Apply',
    'GCP 서비스 인프라를 Terraform apply로 구성한다. BDC apply보다 먼저 수행돼야 한다(서버 강제).', 'APPLY',
    'POST /infra/target-sources/{targetSourceId}/gcp/service-terraform-jobs?jobType=APPLY',
    'GET /infra/gcp/service-terraform-jobs/{terraformJobId}?jobType=APPLY',
    'GET /infra/gcp/service-terraform-jobs/{terraformJobId}/result?jobType=APPLY'),
  tf('GCP_SERVICE_DESTROY_V1', 'GCP', 'GCP_SERVICE_TF_DESTROY', 'GCP Service 테라폼 Destroy',
    'GCP 서비스 인프라를 Terraform destroy로 제거한다. BDC destroy 이후에 수행돼야 한다(서버 강제).', 'DESTROY',
    'POST /infra/target-sources/{targetSourceId}/gcp/service-terraform-jobs?jobType=DESTROY',
    'GET /infra/gcp/service-terraform-jobs/{terraformJobId}?jobType=DESTROY',
    'GET /infra/gcp/service-terraform-jobs/{terraformJobId}/result?jobType=DESTROY'),
  // ── GCP BDC ──
  tf('GCP_BDC_PLAN_V1', 'GCP', 'GCP_BDC_TF_PLAN', 'GCP BDC 테라폼 Plan',
    'GCP BDC 인프라의 Terraform plan을 실행해 변경 내용을 산출한다.', 'PLAN',
    'POST /infra/target-sources/{targetSourceId}/gcp/bdc-terraform-jobs?jobType=PLAN',
    'GET /infra/gcp/bdc-terraform-jobs/{terraformJobId}?jobType=PLAN',
    'GET /infra/gcp/bdc-terraform-jobs/{terraformJobId}/result?jobType=PLAN'),
  tf('GCP_BDC_APPLY_V1', 'GCP', 'GCP_BDC_TF_APPLY', 'GCP BDC 테라폼 Apply',
    'GCP BDC 인프라를 Terraform apply로 구성한다. 서비스 apply 이후에 수행돼야 한다(서버 강제).', 'APPLY',
    'POST /infra/target-sources/{targetSourceId}/gcp/bdc-terraform-jobs?jobType=APPLY',
    'GET /infra/gcp/bdc-terraform-jobs/{terraformJobId}?jobType=APPLY',
    'GET /infra/gcp/bdc-terraform-jobs/{terraformJobId}/result?jobType=APPLY'),
  tf('GCP_BDC_DESTROY_V1', 'GCP', 'GCP_BDC_TF_DESTROY', 'GCP BDC 테라폼 Destroy',
    'GCP BDC 인프라를 Terraform destroy로 제거한다. 서비스 destroy보다 먼저 수행돼야 한다(서버 강제).', 'DESTROY',
    'POST /infra/target-sources/{targetSourceId}/gcp/bdc-terraform-jobs?jobType=DESTROY',
    'GET /infra/gcp/bdc-terraform-jobs/{terraformJobId}?jobType=DESTROY',
    'GET /infra/gcp/bdc-terraform-jobs/{terraformJobId}/result?jobType=DESTROY'),
  // ── Azure BDC ──
  tf('AZURE_BDC_PLAN_V1', 'AZURE', 'AZURE_BDC_TF_PLAN', 'Azure BDC 테라폼 Plan',
    'Azure BDC 인프라의 Terraform plan을 실행해 변경 내용을 산출한다.', 'PLAN',
    'POST /infra/azure/target-sources/{targetSourceId}/azure/terraform-jobs/plan',
    'GET /infra/azure/terraform-jobs/plan/{terraformJobId}',
    'GET /infra/azure/terraform-jobs/plan/{terraformJobId}/result'),
  tf('AZURE_BDC_APPLY_V1', 'AZURE', 'AZURE_BDC_TF_APPLY', 'Azure BDC 테라폼 Apply',
    'Azure BDC 인프라를 Terraform apply로 구성한다.', 'APPLY',
    'POST /infra/azure/target-sources/{targetSourceId}/azure/terraform-jobs/apply',
    'GET /infra/azure/terraform-jobs/apply/{terraformJobId}',
    'GET /infra/azure/terraform-jobs/apply/{terraformJobId}/result'),
  tf('AZURE_BDC_DESTROY_V1', 'AZURE', 'AZURE_BDC_TF_DESTROY', 'Azure BDC 테라폼 Destroy',
    'Azure BDC 인프라를 Terraform destroy로 제거한다.', 'DESTROY',
    'DELETE /infra/target-sources/{targetSourceId}/azure/terraform-jobs/destroy',
    'GET /infra/azure/terraform-jobs/destroy/{terraformJobId}',
    'GET /infra/azure/terraform-jobs/destroy/{terraformJobId}/result'),
  // ── IDC CX ──
  tf('IDC_CX_PLAN_V1', 'IDC', 'IDC_CX_TF_PLAN', 'IDC CX 테라폼 Plan',
    'IDC CX 인프라의 Terraform plan을 실행해 변경 내용을 산출한다.', 'PLAN',
    'POST /infra/target-sources/{targetSourceId}/idc/terraform/action?jobType=PLAN&idcTerraformType=CX',
    'GET /infra/idc/terraform/{terraformJobId}?jobType=PLAN',
    'GET /infra/idc/terraform/{terraformJobId}/result?jobType=PLAN'),
  tf('IDC_CX_APPLY_V1', 'IDC', 'IDC_CX_TF_APPLY', 'IDC CX 테라폼 Apply',
    'IDC CX 인프라를 Terraform apply로 구성한다. BDP apply보다 먼저 수행돼야 한다(서버 강제).', 'APPLY',
    'POST /infra/target-sources/{targetSourceId}/idc/terraform/action?jobType=APPLY&idcTerraformType=CX',
    'GET /infra/idc/terraform/{terraformJobId}?jobType=APPLY',
    'GET /infra/idc/terraform/{terraformJobId}/result?jobType=APPLY'),
  tf('IDC_CX_DESTROY_V1', 'IDC', 'IDC_CX_TF_DESTROY', 'IDC CX 테라폼 Destroy',
    'IDC CX 인프라를 Terraform destroy로 제거한다.', 'DESTROY',
    'POST /infra/target-sources/{targetSourceId}/idc/terraform/action?jobType=DESTROY&idcTerraformType=CX',
    'GET /infra/idc/terraform/{terraformJobId}?jobType=DESTROY',
    'GET /infra/idc/terraform/{terraformJobId}/result?jobType=DESTROY'),
  // ── IDC BDP ──
  tf('IDC_BDP_PLAN_V1', 'IDC', 'IDC_BDP_TF_PLAN', 'IDC BDP 테라폼 Plan',
    'IDC BDP 인프라의 Terraform plan을 실행해 변경 내용을 산출한다.', 'PLAN',
    'POST /infra/target-sources/{targetSourceId}/idc/terraform/action?jobType=PLAN&idcTerraformType=BDP',
    'GET /infra/idc/terraform/{terraformJobId}?jobType=PLAN',
    'GET /infra/idc/terraform/{terraformJobId}/result?jobType=PLAN'),
  tf('IDC_BDP_APPLY_V1', 'IDC', 'IDC_BDP_TF_APPLY', 'IDC BDP 테라폼 Apply',
    'IDC BDP 인프라를 Terraform apply로 구성한다. CX apply 이후에 수행돼야 한다(서버 강제).', 'APPLY',
    'POST /infra/target-sources/{targetSourceId}/idc/terraform/action?jobType=APPLY&idcTerraformType=BDP',
    'GET /infra/idc/terraform/{terraformJobId}?jobType=APPLY',
    'GET /infra/idc/terraform/{terraformJobId}/result?jobType=APPLY'),
  tf('IDC_BDP_DESTROY_V1', 'IDC', 'IDC_BDP_TF_DESTROY', 'IDC BDP 테라폼 Destroy',
    'IDC BDP 인프라를 Terraform destroy로 제거한다. pod 삭제를 동반한다.', 'DESTROY',
    'POST /infra/target-sources/{targetSourceId}/idc/terraform/action?jobType=DESTROY&idcTerraformType=BDP',
    'GET /infra/idc/terraform/{terraformJobId}?jobType=DESTROY',
    'GET /infra/idc/terraform/{terraformJobId}/result?jobType=DESTROY'),
  // ── CONDITION_CHECK (only one; provider AWS) ──
  {
    name: 'NETWORK_READY_V1',
    provider: 'AWS',
    operation: 'NETWORK_READY',
    kind: 'CONDITION_CHECK',
    displayName: '네트워크 준비 확인',
    description: '네트워크가 준비 완료 상태가 될 때까지 조건을 확인한다.',
    statusApi: 'GET /infra/network/ready?target={target} (실제 API 미확정 — 가정 엔드포인트)',
    successPolicy: CONDITION_SUCCESS_POLICY,
    resultStorage: CONDITION_RESULT_STORAGE,
  },
];

const CATALOG: Map<string, CatalogDef> = new Map(CATALOG_DEFS.map((d) => [d.name, d]));

const consumesSlot = (def: CatalogDef): boolean => def.kind === 'TERRAFORM_JOB';

const toDefinitionView = (def: CatalogDef): TaskDefinitionView => ({
  name: def.name,
  display_name: def.displayName,
  description: def.description,
  ...(def.dispatchApi !== undefined ? { dispatch_api: def.dispatchApi } : {}),
  status_api: def.statusApi,
  ...(def.resultApi !== undefined ? { result_api: def.resultApi } : {}),
  success_policy: def.successPolicy,
  result_storage: def.resultStorage,
});

// ═══════════════════════════════════════════════════════════════════════════
// Recipe catalog (8 RecipeDefinitions) — step order faithful to source
// ═══════════════════════════════════════════════════════════════════════════

interface RecipeDef {
  name: string;
  provider: CloudProvider;
  type: PipelineType;
  displayName: string;
  description: string;
  steps: string[];
}

const RECIPES: RecipeDef[] = [
  {
    name: 'AWS_INSTALL_V1', provider: 'AWS', type: 'INSTALL', displayName: 'AWS 인프라 설치',
    description: 'AWS 서비스, BDC common, BDC service level 인프라를 단위별 Terraform plan·apply로 구성한다.'
      + ' 서비스 apply 후 네트워크 준비를 확인하고 BDC 단위로 넘어간다.',
    steps: ['AWS_SERVICE_PLAN_V1', 'AWS_SERVICE_APPLY_V1', 'NETWORK_READY_V1', 'AWS_BDC_COMMON_PLAN_V1',
      'AWS_BDC_COMMON_APPLY_V1', 'AWS_BDC_SERVICE_LEVEL_PLAN_V1', 'AWS_BDC_SERVICE_LEVEL_APPLY_V1'],
  },
  {
    name: 'AWS_DELETE_V1', provider: 'AWS', type: 'DELETE', displayName: 'AWS 인프라 삭제',
    description: 'AWS BDC service level, BDC common, 서비스 인프라를 설치의 역순으로 Terraform destroy로 제거한다.',
    steps: ['AWS_BDC_SERVICE_LEVEL_DESTROY_V1', 'AWS_BDC_COMMON_DESTROY_V1', 'AWS_SERVICE_DESTROY_V1'],
  },
  {
    name: 'GCP_INSTALL_V1', provider: 'GCP', type: 'INSTALL', displayName: 'GCP 인프라 설치',
    description: 'GCP 서비스와 BDC 인프라를 단위별 Terraform plan·apply로 구성한다. apply 순서는 서비스 → BDC(서버 강제).',
    steps: ['GCP_SERVICE_PLAN_V1', 'GCP_SERVICE_APPLY_V1', 'GCP_BDC_PLAN_V1', 'GCP_BDC_APPLY_V1'],
  },
  {
    name: 'GCP_DELETE_V1', provider: 'GCP', type: 'DELETE', displayName: 'GCP 인프라 삭제',
    description: 'GCP BDC와 서비스 인프라를 Terraform destroy로 제거한다. destroy 순서는 BDC → 서비스(서버 강제).',
    steps: ['GCP_BDC_DESTROY_V1', 'GCP_SERVICE_DESTROY_V1'],
  },
  {
    name: 'AZURE_INSTALL_V1', provider: 'AZURE', type: 'INSTALL', displayName: 'Azure 인프라 설치',
    description: 'Azure BDC 인프라를 Terraform plan·apply로 구성한다.',
    steps: ['AZURE_BDC_PLAN_V1', 'AZURE_BDC_APPLY_V1'],
  },
  {
    name: 'AZURE_DELETE_V1', provider: 'AZURE', type: 'DELETE', displayName: 'Azure 인프라 삭제',
    description: 'Azure BDC 인프라를 Terraform destroy로 제거한다.',
    steps: ['AZURE_BDC_DESTROY_V1'],
  },
  {
    name: 'IDC_INSTALL_V1', provider: 'IDC', type: 'INSTALL', displayName: 'IDC 인프라 설치',
    description: 'IDC CX와 BDP 인프라를 단위별 Terraform plan·apply로 구성한다. apply 순서는 CX → BDP(서버 강제).',
    steps: ['IDC_CX_PLAN_V1', 'IDC_CX_APPLY_V1', 'IDC_BDP_PLAN_V1', 'IDC_BDP_APPLY_V1'],
  },
  {
    name: 'IDC_DELETE_V1', provider: 'IDC', type: 'DELETE', displayName: 'IDC 인프라 삭제',
    description: 'IDC BDP와 CX 인프라를 Terraform destroy로 제거한다(BDP destroy는 pod 삭제 동반, 순서는 설치의 역순 가정).',
    steps: ['IDC_BDP_DESTROY_V1', 'IDC_CX_DESTROY_V1'],
  },
];

const findRecipe = (provider: CloudProvider, type: PipelineType): RecipeDef | undefined =>
  RECIPES.find((r) => r.provider === provider && r.type === type);

// Effective settings (constants — ADR-016 global defaults, no per-task override in mock).
const POLLING_INTERVAL = 'PT10M';
const TERRAFORM_TIMEOUT = 'PT30M';
const TERRAFORM_MAX_FAIL = 1;
const CONDITION_MAX_FAIL = 6;

const defaultMaxFail = (def: CatalogDef): number =>
  def.kind === 'CONDITION_CHECK' ? CONDITION_MAX_FAIL : TERRAFORM_MAX_FAIL;

// ═══════════════════════════════════════════════════════════════════════════
// Internal fixture representation (superset of the wire task; wire derived below)
// ═══════════════════════════════════════════════════════════════════════════

interface MockCheck {
  call_count: number;
  not_met_count: number;
  api_error_count: number;
  call_timeout_count: number;
  last_external_status: string | null;
  last_checked_at: string | null;
}

interface MockAttempt {
  attempt_number: number;
  status: TaskStatus;
  error_code: ErrorCode | null;
  response: string | null;
  failure_detail: string | null;
  started_at: string | null;
  finished_at: string | null;
  check: MockCheck | null;
  terraform_results: TerraformJobResultSummary[];
  job_states: TerraformJobStateSummary[];
  /** Attempt genuinely observed no terraform jobs (e.g. the dispatch call failed before any
   *  job id came back). Suppresses the placeholder job synthesis so the zero-job state is real. */
  no_jobs?: boolean;
}

interface MockTask {
  task_id: number;
  sequence: number;
  task_definition: string;
  status: TaskStatus;
  fail_count: number;
  error_code: ErrorCode | null;
  started_at: string | null;
  ready_at: string | null;
  finished_at: string | null;
  next_check_at: string | null;
  effective_max_fail_count: number;
  description: string | null;
  attempts: MockAttempt[];
}

interface MockPipeline {
  pipeline_id: number;
  type: PipelineType;
  target_source_id: string;
  service_code: string;
  service_name: string;
  cloud_provider: CloudProvider;
  /** null for CUSTOM pipelines — upstream serializes no catalog recipe (PipelinePlan.custom). */
  recipe_definition: string | null;
  status: PipelineStatus;
  created_at: string;
  last_activity_at: string;
  next_due_at: string | null;
  leased: boolean;
  cancel_requested: boolean;
  due_lag_millis: number;
  tasks: MockTask[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Fixture seed — anchored relative to module-load NOW so period windows never rot
// ═══════════════════════════════════════════════════════════════════════════

function seedPipelines(): MockPipeline[] {
  const now = Date.now();
  const ago = (minutes: number): string => new Date(now - minutes * 60_000).toISOString();
  const ahead = (minutes: number): string => new Date(now + minutes * 60_000).toISOString();

  const check = (
    callCount: number,
    notMet: number,
    apiErr: number,
    callTimeout: number,
    lastStatus: string | null,
    checkedMinAgo: number,
  ): MockCheck => ({
    call_count: callCount,
    not_met_count: notMet,
    api_error_count: apiErr,
    call_timeout_count: callTimeout,
    last_external_status: lastStatus,
    last_checked_at: ago(checkedMinAgo),
  });

  // Build a task from a recipe-step definition name + fixture overrides.
  const mkTask = (
    pipelineId: number,
    sequence: number,
    defName: string,
    status: TaskStatus,
    overrides: Partial<MockTask> = {},
  ): MockTask => {
    const def = CATALOG.get(defName);
    return {
      task_id: pipelineId * 100 + sequence,
      sequence,
      task_definition: defName,
      status,
      fail_count: 0,
      error_code: null,
      started_at: null,
      ready_at: null,
      finished_at: null,
      next_check_at: null,
      effective_max_fail_count: def ? defaultMaxFail(def) : TERRAFORM_MAX_FAIL,
      description: null,
      attempts: [],
      ...overrides,
    };
  };

  const attempt = (
    n: number,
    status: TaskStatus,
    errorCode: ErrorCode | null,
    startedMinAgo: number,
    response: string | null,
    finishedMinAgo: number | null,
    chk: MockCheck | null = null,
    extra: {
      failure_detail?: string | null;
      terraform_results?: TerraformJobResultSummary[];
      job_states?: TerraformJobStateSummary[];
      no_jobs?: boolean;
    } = {},
  ): MockAttempt => ({
    attempt_number: n,
    status,
    error_code: errorCode,
    response,
    failure_detail: extra.failure_detail ?? null,
    started_at: ago(startedMinAgo),
    finished_at: finishedMinAgo === null ? null : ago(finishedMinAgo),
    check: chk,
    terraform_results: extra.terraform_results ?? [],
    job_states: extra.job_states ?? [],
    no_jobs: extra.no_jobs ?? false,
  });

  return [
    // ── 131 FAILED (dispatch call failed — zero jobs) — AWS target 1006 (red path). ──
    //     The terraform execute (dispatch) API itself failed on every attempt, so no job id
    //     ever came back: each attempt carries error_code + failure_detail but NO job rows.
    //     `no_jobs` suppresses the placeholder synth, exercising AttemptDetail's "실패 원인"
    //     fallback (the per-job log viewer is unreachable when there are zero jobs).
    {
      pipeline_id: 131, type: 'INSTALL', target_source_id: '1006', ...resolveService('1006'), cloud_provider: 'AWS',
      recipe_definition: 'AWS_INSTALL_V1', status: 'FAILED',
      // Older than the RUNNING 128 on the same target — this install failed first, then 128 retried.
      created_at: ago(95), last_activity_at: ago(78), next_due_at: null,
      leased: false, cancel_requested: false, due_lag_millis: 0,
      tasks: [
        mkTask(131, 0, 'AWS_SERVICE_PLAN_V1', 'DONE', {
          started_at: ago(95), finished_at: ago(93),
          attempts: [attempt(1, 'DONE', null, 95, '{"job_id":"tf-e00","terraformState":"COMPLETED"}', 93)],
        }),
        mkTask(131, 1, 'AWS_SERVICE_APPLY_V1', 'FAILED', {
          fail_count: 2, error_code: 'CHECK_ERROR', effective_max_fail_count: 2,
          started_at: ago(93), finished_at: ago(78),
          attempts: [
            attempt(1, 'FAILED', 'CHECK_ERROR', 93, null, 91, null, {
              failure_detail:
                'infra-manager call failed: 503 Service Unavailable (POST /infra/aws/service-terraform-jobs/action)',
              no_jobs: true,
            }),
            attempt(2, 'FAILED', 'CHECK_ERROR', 85, null, 78, null, {
              failure_detail:
                'infra-manager call failed: 503 Service Unavailable (POST /infra/aws/service-terraform-jobs/action)',
              no_jobs: true,
            }),
          ],
        }),
        mkTask(131, 2, 'AWS_BDC_COMMON_PLAN_V1', 'BLOCKED'),
        mkTask(131, 3, 'AWS_BDC_COMMON_APPLY_V1', 'BLOCKED'),
      ],
    },
    // ── 130 RUNNING — SDU target 1099 (cloud_provider AWS → surfaced as "SDU"). ──
    //     DONE tasks carry attempts so 시도 횟수 reads the real attempt count.
    {
      pipeline_id: 130, type: 'INSTALL', target_source_id: '1099', ...resolveService('1099'), cloud_provider: 'AWS',
      recipe_definition: 'AWS_INSTALL_V1', status: 'RUNNING',
      created_at: ago(30), last_activity_at: ago(2), next_due_at: ahead(6), leased: true,
      cancel_requested: false, due_lag_millis: 0,
      tasks: [
        mkTask(130, 0, 'AWS_SERVICE_PLAN_V1', 'DONE', {
          started_at: ago(30), finished_at: ago(28),
          attempts: [attempt(1, 'DONE', null, 30, '{"job_id":"tf-b10","terraformState":"COMPLETED"}', 28)],
        }),
        mkTask(130, 1, 'AWS_SERVICE_APPLY_V1', 'IN_PROGRESS', {
          started_at: ago(28),
          attempts: [attempt(1, 'IN_PROGRESS', null, 28, '{"job_id":"tf-b11","terraformState":"RUNNING"}', null)],
        }),
        mkTask(130, 2, 'AWS_BDC_COMMON_PLAN_V1', 'BLOCKED'),
        mkTask(130, 3, 'AWS_BDC_COMMON_APPLY_V1', 'BLOCKED'),
      ],
    },
    // ── 129 PENDING (start-delay wait) — GCP target 1002. READY + BLOCKED. ──
    {
      pipeline_id: 129, type: 'INSTALL', target_source_id: '1002', ...resolveService('1002'), cloud_provider: 'GCP',
      recipe_definition: 'GCP_INSTALL_V1', status: 'PENDING',
      created_at: ago(6), last_activity_at: ago(6), next_due_at: ahead(24),
      leased: false, cancel_requested: false, due_lag_millis: 0,
      tasks: [
        mkTask(129, 0, 'GCP_SERVICE_PLAN_V1', 'READY', { ready_at: ago(6) }),
        mkTask(129, 1, 'GCP_SERVICE_APPLY_V1', 'BLOCKED'),
        mkTask(129, 2, 'GCP_BDC_PLAN_V1', 'BLOCKED'),
        mkTask(129, 3, 'GCP_BDC_APPLY_V1', 'BLOCKED'),
      ],
    },
    // ── 128 RUNNING (leased, full detail) — AWS target 1006. DONE + IN_PROGRESS + BLOCKED. ──
    //     Sole exercise of the CONDITION_CHECK render path (seq 3 NETWORK_READY DONE w/ check + attempt).
    {
      pipeline_id: 128, type: 'INSTALL', target_source_id: '1006', ...resolveService('1006'), cloud_provider: 'AWS',
      recipe_definition: 'AWS_INSTALL_V1', status: 'RUNNING',
      created_at: ago(45), last_activity_at: ago(4), next_due_at: ahead(6), leased: true,
      cancel_requested: false, due_lag_millis: 300,
      tasks: [
        mkTask(128, 0, 'AWS_SERVICE_PLAN_V1', 'DONE', {
          started_at: ago(45), finished_at: ago(43),
          attempts: [attempt(1, 'DONE', null, 45, '{"job_id":"tf-a90","terraformState":"COMPLETED"}', 43)],
        }),
        mkTask(128, 1, 'AWS_SERVICE_APPLY_V1', 'DONE', {
          started_at: ago(43), finished_at: ago(40),
          attempts: [attempt(1, 'DONE', null, 43, '{"job_id":"tf-a91","terraformState":"COMPLETED"}', 40)],
        }),
        mkTask(128, 2, 'NETWORK_READY_V1', 'DONE', {
          fail_count: 1, started_at: ago(40), ready_at: ago(43), finished_at: ago(34),
          attempts: [
            attempt(1, 'FAILED', 'CONDITION_NOT_MET', 40, null, 38,
              check(1, 1, 0, 0, 'NOT_READY', 38)),
            attempt(2, 'DONE', null, 36, null, 34, check(1, 0, 0, 0, 'READY', 34)),
          ],
        }),
        mkTask(128, 3, 'AWS_BDC_COMMON_PLAN_V1', 'DONE', {
          started_at: ago(34), finished_at: ago(31),
          attempts: [attempt(1, 'DONE', null, 34, '{"job_id":"tf-b21","terraformState":"COMPLETED"}', 31)],
        }),
        mkTask(128, 4, 'AWS_BDC_COMMON_APPLY_V1', 'IN_PROGRESS', {
          started_at: ago(30), ready_at: ago(31), next_check_at: ahead(6),
          // In-flight attempt — jobs still running, no results yet; logs are a
          // live read-through to InfraManager until the attempt terminates.
          attempts: [attempt(1, 'IN_PROGRESS', null, 30, '["1031","1032","1033"]', null,
            check(2, 0, 0, 0, 'RUNNING', 29), {
              job_states: [
                { job_id: '1031', last_state: 'COMPLETED', last_fail_reason: null, last_error: null,
                  poll_count: 2, last_polled_at: ago(29) },
                { job_id: '1032', last_state: 'RUNNING', last_fail_reason: null, last_error: null,
                  poll_count: 2, last_polled_at: ago(29) },
                { job_id: '1033', last_state: 'RUNNING', last_fail_reason: null, last_error: null,
                  poll_count: 2, last_polled_at: ago(29) },
              ],
            })],
        }),
        mkTask(128, 5, 'AWS_BDC_SERVICE_LEVEL_PLAN_V1', 'BLOCKED'),
        mkTask(128, 6, 'AWS_BDC_SERVICE_LEVEL_APPLY_V1', 'BLOCKED'),
      ],
    },
    // ── 127 DONE (DELETE) — AWS target 1006 (history for the running target). ──
    {
      pipeline_id: 127, type: 'DELETE', target_source_id: '1006', ...resolveService('1006'), cloud_provider: 'AWS',
      recipe_definition: 'AWS_DELETE_V1', status: 'DONE',
      created_at: ago(2 * 24 * 60), last_activity_at: ago(2 * 24 * 60 - 22), next_due_at: null,
      leased: false, cancel_requested: false, due_lag_millis: 0,
      tasks: [
        mkTask(127, 0, 'AWS_BDC_SERVICE_LEVEL_DESTROY_V1', 'DONE', {
          started_at: ago(2 * 24 * 60), finished_at: ago(2 * 24 * 60 - 9),
          attempts: [attempt(1, 'DONE', null, 2 * 24 * 60, '{"job_id":"tf-d10","terraformState":"DESTROYED"}', 2 * 24 * 60 - 9)],
        }),
        mkTask(127, 1, 'AWS_BDC_COMMON_DESTROY_V1', 'DONE', {
          started_at: ago(2 * 24 * 60 - 10), finished_at: ago(2 * 24 * 60 - 16),
          attempts: [attempt(1, 'DONE', null, 2 * 24 * 60 - 10, '{"job_id":"tf-d11","terraformState":"DESTROYED"}', 2 * 24 * 60 - 16)],
        }),
        mkTask(127, 2, 'AWS_SERVICE_DESTROY_V1', 'DONE', {
          started_at: ago(2 * 24 * 60 - 17), finished_at: ago(2 * 24 * 60 - 22),
          attempts: [attempt(1, 'DONE', null, 2 * 24 * 60 - 17, '{"job_id":"tf-d12","terraformState":"DESTROYED"}', 2 * 24 * 60 - 22)],
        }),
      ],
    },
    // ── 126 DONE (INSTALL) — GCP target 1002 (history for the pending target). ──
    {
      pipeline_id: 126, type: 'INSTALL', target_source_id: '1002', ...resolveService('1002'), cloud_provider: 'GCP',
      recipe_definition: 'GCP_INSTALL_V1', status: 'DONE',
      created_at: ago(5 * 24 * 60), last_activity_at: ago(5 * 24 * 60 - 40), next_due_at: null,
      leased: false, cancel_requested: false, due_lag_millis: 0,
      tasks: [
        mkTask(126, 0, 'GCP_SERVICE_PLAN_V1', 'DONE', {
          started_at: ago(5 * 24 * 60), finished_at: ago(5 * 24 * 60 - 6),
          attempts: [attempt(1, 'DONE', null, 5 * 24 * 60, '{"job_id":"tf-g01","terraformState":"COMPLETED"}', 5 * 24 * 60 - 6)],
        }),
        mkTask(126, 1, 'GCP_SERVICE_APPLY_V1', 'DONE', {
          started_at: ago(5 * 24 * 60 - 7), finished_at: ago(5 * 24 * 60 - 16),
          attempts: [attempt(1, 'DONE', null, 5 * 24 * 60 - 7, '{"job_id":"tf-g02","terraformState":"COMPLETED"}', 5 * 24 * 60 - 16)],
        }),
        mkTask(126, 2, 'GCP_BDC_PLAN_V1', 'DONE', {
          started_at: ago(5 * 24 * 60 - 17), finished_at: ago(5 * 24 * 60 - 24),
          attempts: [attempt(1, 'DONE', null, 5 * 24 * 60 - 17, '{"job_id":"tf-g03","terraformState":"COMPLETED"}', 5 * 24 * 60 - 24)],
        }),
        mkTask(126, 3, 'GCP_BDC_APPLY_V1', 'DONE', {
          started_at: ago(5 * 24 * 60 - 25), finished_at: ago(5 * 24 * 60 - 40),
          attempts: [attempt(1, 'DONE', null, 5 * 24 * 60 - 25, '{"job_id":"tf-g04","terraformState":"COMPLETED"}', 5 * 24 * 60 - 40)],
        }),
      ],
    },
    // ── 125 RUNNING + cancel_requested — AWS target 1007 (leased, cancel awaiting next cycle). ──
    {
      pipeline_id: 125, type: 'DELETE', target_source_id: '1007', ...resolveService('1007'), cloud_provider: 'AWS',
      recipe_definition: 'AWS_DELETE_V1', status: 'RUNNING',
      created_at: ago(38), last_activity_at: ago(3), next_due_at: ahead(4), leased: true,
      cancel_requested: true, due_lag_millis: 2400,
      tasks: [
        mkTask(125, 0, 'AWS_BDC_SERVICE_LEVEL_DESTROY_V1', 'IN_PROGRESS', {
          started_at: ago(38), ready_at: ago(38), next_check_at: ahead(4),
          attempts: [attempt(1, 'IN_PROGRESS', null, 38, '{"job_id":"tf-d20","terraformState":"IN_PROGRESS"}', null)],
        }),
        mkTask(125, 1, 'AWS_BDC_COMMON_DESTROY_V1', 'BLOCKED'),
        mkTask(125, 2, 'AWS_SERVICE_DESTROY_V1', 'BLOCKED'),
      ],
    },
    // ── 124 FAILED (JOB_FAILED, quota exceeded) — Azure target 1003 (red path). ──
    {
      pipeline_id: 124, type: 'INSTALL', target_source_id: '1003', ...resolveService('1003'), cloud_provider: 'AZURE',
      recipe_definition: 'AZURE_INSTALL_V1', status: 'FAILED',
      created_at: ago(3 * 60), last_activity_at: ago(3 * 60 - 30), next_due_at: null,
      leased: false, cancel_requested: false, due_lag_millis: 0,
      tasks: [
        mkTask(124, 0, 'AZURE_BDC_PLAN_V1', 'DONE', {
          started_at: ago(3 * 60), finished_at: ago(3 * 60 - 8),
          attempts: [attempt(1, 'DONE', null, 3 * 60, '{"job_id":"tf-z00","terraformState":"COMPLETED"}', 3 * 60 - 8)],
        }),
        mkTask(124, 1, 'AZURE_BDC_APPLY_V1', 'FAILED', {
          fail_count: 2, error_code: 'JOB_FAILED', effective_max_fail_count: 2,
          started_at: ago(3 * 60 - 9), finished_at: ago(3 * 60 - 30),
          attempts: [
            // #1 — a poll call timed out before the jobs reached a terminal state:
            // no results stored, states hold the last observation (1021 errored).
            attempt(1, 'FAILED', 'CALL_TIMEOUT', 3 * 60 - 9, '["1019","1020","1021"]', 3 * 60 - 14,
              check(4, 0, 0, 1, 'RUNNING', 3 * 60 - 14), {
                failure_detail: 'infra-manager call timed out after PT30S (GET /infra/azure/terraform-jobs/apply/1021)',
                job_states: [
                  { job_id: '1019', last_state: 'COMPLETED', last_fail_reason: null, last_error: null,
                    poll_count: 4, last_polled_at: ago(3 * 60 - 13) },
                  { job_id: '1020', last_state: 'RUNNING', last_fail_reason: null, last_error: null,
                    poll_count: 4, last_polled_at: ago(3 * 60 - 13) },
                  { job_id: '1021', last_state: null, last_fail_reason: null,
                    last_error: 'infra-manager call timed out after PT30S',
                    poll_count: 4, last_polled_at: ago(3 * 60 - 14) },
                ],
              }),
            // #2 — jobs reached terminal; 1027 FAILED → whole attempt JOB_FAILED.
            // Per-job result rows recorded at the judgment turn (1028 body missing).
            attempt(2, 'FAILED', 'JOB_FAILED', 3 * 60 - 20, '["1026","1027","1028"]', 3 * 60 - 30,
              check(6, 0, 0, 0, 'FAILED', 3 * 60 - 30), {
                failure_detail: 'jobs reported FAILED: [1027]',
                terraform_results: [
                  { job_id: '1026', succeeded: true, truncated: false, has_body: true, created_at: ago(3 * 60 - 30) },
                  { job_id: '1027', succeeded: false, truncated: true, has_body: true, created_at: ago(3 * 60 - 30) },
                  { job_id: '1028', succeeded: true, truncated: false, has_body: false, created_at: ago(3 * 60 - 30) },
                ],
                job_states: [
                  { job_id: '1026', last_state: 'COMPLETED', last_fail_reason: null, last_error: null,
                    poll_count: 6, last_polled_at: ago(3 * 60 - 31) },
                  { job_id: '1027', last_state: 'FAILED', last_fail_reason: 'mock forced failure', last_error: null,
                    poll_count: 6, last_polled_at: ago(3 * 60 - 31) },
                  { job_id: '1028', last_state: 'COMPLETED', last_fail_reason: null, last_error: null,
                    poll_count: 6, last_polled_at: ago(3 * 60 - 31) },
                ],
              }),
          ],
        }),
      ],
    },
    // ── 123 CANCELLED (INSTALL) — AWS target 1008 (cascade-cancelled tasks). ──
    {
      pipeline_id: 123, type: 'INSTALL', target_source_id: '1008', ...resolveService('1008'), cloud_provider: 'AWS',
      recipe_definition: 'AWS_INSTALL_V1', status: 'CANCELLED',
      created_at: ago(6 * 24 * 60), last_activity_at: ago(6 * 24 * 60 - 5), next_due_at: null,
      leased: false, cancel_requested: false, due_lag_millis: 0,
      tasks: [
        mkTask(123, 0, 'AWS_SERVICE_PLAN_V1', 'CANCELLED', {
          started_at: ago(6 * 24 * 60), finished_at: ago(6 * 24 * 60 - 5),
          attempts: [attempt(1, 'DONE', null, 6 * 24 * 60, '{"job_id":"tf-c01","terraformState":"COMPLETED"}', 6 * 24 * 60 - 5)],
        }),
        mkTask(123, 1, 'AWS_SERVICE_APPLY_V1', 'CANCELLED'),
        mkTask(123, 2, 'NETWORK_READY_V1', 'CANCELLED'),
        mkTask(123, 3, 'AWS_BDC_COMMON_PLAN_V1', 'CANCELLED'),
        mkTask(123, 4, 'AWS_BDC_COMMON_APPLY_V1', 'CANCELLED'),
        mkTask(123, 5, 'AWS_BDC_SERVICE_LEVEL_PLAN_V1', 'CANCELLED'),
        mkTask(123, 6, 'AWS_BDC_SERVICE_LEVEL_APPLY_V1', 'CANCELLED'),
      ],
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Store (globalThis-backed, survives HMR; resettable in tests)
// ═══════════════════════════════════════════════════════════════════════════

declare global {
  var __pipelineMockStore: MockPipeline[] | undefined;
}

const store = (): MockPipeline[] => {
  if (!globalThis.__pipelineMockStore) {
    globalThis.__pipelineMockStore = seedPipelines();
  }
  return globalThis.__pipelineMockStore;
};

/** Test hook — re-seeds the in-memory pipeline store from scratch. */
export const resetPipelineMockStore = (): void => {
  globalThis.__pipelineMockStore = undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// Wire serializers
// ═══════════════════════════════════════════════════════════════════════════

const kindOf = (defName: string): TaskKind => CATALOG.get(defName)?.kind ?? 'TERRAFORM_JOB';
const operationOf = (defName: string): TaskOperation | null => CATALOG.get(defName)?.operation ?? null;
const consumesOf = (defName: string): boolean | null => {
  const def = CATALOG.get(defName);
  return def ? consumesSlot(def) : null;
};

const doneCount = (p: MockPipeline): number => p.tasks.filter((t) => t.status === 'DONE').length;

const toTaskSummary = (t: MockTask): TaskSummary => ({
  task_id: t.task_id,
  sequence: t.sequence,
  kind: kindOf(t.task_definition),
  task_definition: t.task_definition,
  operation: operationOf(t.task_definition),
  status: t.status,
  fail_count: t.fail_count,
  error_code: t.status === 'FAILED' ? t.error_code : null,
  consumes_terraform_slot: consumesOf(t.task_definition),
  started_at: t.started_at,
  finished_at: t.finished_at,
  description: t.description,
});

/** SDU flag for a pipeline's target — joined from the app's project seed so the
 *  list/detail can surface "SDU" over the underlying CSP (passthrough). */
const sduForTarget = (targetSourceId: string): boolean =>
  getProjectByTargetSourceId(Number(targetSourceId))?.isSduType === true;

const toSummary = (p: MockPipeline): PipelineSummary => ({
  pipeline_id: p.pipeline_id,
  type: p.type,
  target_source_id: p.target_source_id,
  service_code: p.service_code,
  service_name: p.service_name,
  cloud_provider: p.cloud_provider,
  is_sdu_type: sduForTarget(p.target_source_id),
  recipe_definition: p.recipe_definition,
  status: p.status,
  done_task_count: doneCount(p),
  total_task_count: p.tasks.length,
  created_at: p.created_at,
  last_activity_at: p.last_activity_at,
});

const toDetail = (p: MockPipeline): PipelineDetail => {
  const current = p.tasks
    .filter((t) => t.status === 'READY' || t.status === 'IN_PROGRESS')
    .sort((a, b) => a.sequence - b.sequence)[0];
  const finalSeq = p.tasks.length > 0 ? Math.max(...p.tasks.map((t) => t.sequence)) : null;
  return {
    pipeline_id: p.pipeline_id,
    type: p.type,
    target_source_id: p.target_source_id,
    cloud_provider: p.cloud_provider,
    is_sdu_type: sduForTarget(p.target_source_id),
    recipe_definition: p.recipe_definition,
    status: p.status,
    created_at: p.created_at,
    last_activity_at: p.last_activity_at,
    next_due_at: p.next_due_at,
    leased: p.leased,
    cancel_requested: p.cancel_requested,
    due_lag_millis: p.due_lag_millis,
    current_task_sequence: current ? current.sequence : null,
    final_task_sequence: finalSeq,
    current_fail_count: current ? current.fail_count : null,
    current_max_fail_count: current ? current.effective_max_fail_count : null,
    done_task_count: doneCount(p),
    total_task_count: p.tasks.length,
    tasks: p.tasks.map(toTaskSummary),
  };
};

const toCheckView = (c: MockCheck): TaskCheckView => ({
  call_count: c.call_count,
  not_met_count: c.not_met_count,
  api_error_count: c.api_error_count,
  call_timeout_count: c.call_timeout_count,
  last_external_status: c.last_external_status,
  last_checked_at: c.last_checked_at,
});

// ── Synthetic per-job data ─────────────────────────────────────────────────
// Every TERRAFORM_JOB attempt should surface a Terraform Job list, but only a
// couple of tasks carry hand-written fixtures. For the rest, derive a
// deterministic 2-job set from the attempt's own outcome + timestamps. Kept in
// lockstep with the jobResult/jobState fallbacks so the log viewer resolves too.
interface SynthJobs {
  results: TerraformJobResultSummary[];
  states: TerraformJobStateSummary[];
}

const successStateFor = (defName: string): string =>
  (operationOf(defName) ?? '').includes('DESTROY') ? 'DESTROYED' : 'COMPLETED';

const synthJobIds = (taskId: number, n: number): [string, string] => [
  String(taskId * 100 + n * 10 + 1),
  String(taskId * 100 + n * 10 + 2),
];

/** An attempt with no hand-written job fixtures → synthesize a job set (unless it declares
 *  `no_jobs`, i.e. it genuinely observed none, e.g. a dispatch-call failure). */
const needsSynth = (a: MockAttempt): boolean =>
  !a.no_jobs && a.terraform_results.length === 0 && a.job_states.length === 0;

const attemptStamp = (a: MockAttempt): string =>
  a.finished_at ?? a.started_at ?? new Date().toISOString();

const synthTerraformJobs = (
  taskId: number,
  n: number,
  status: TaskStatus,
  errorCode: ErrorCode | null,
  successState: string,
  stamp: string,
): SynthJobs => {
  const [j1, j2] = synthJobIds(taskId, n);
  const st = (id: string, last_state: string | null, fail?: string): TerraformJobStateSummary => ({
    job_id: id, last_state, last_fail_reason: fail ?? null, last_error: null, poll_count: 2, last_polled_at: stamp,
  });
  const rs = (id: string, succeeded: boolean): TerraformJobResultSummary => ({
    job_id: id, succeeded, truncated: false, has_body: true, created_at: stamp,
  });
  if (status === 'DONE') {
    return { results: [rs(j1, true), rs(j2, true)], states: [st(j1, successState), st(j2, successState)] };
  }
  if (status === 'FAILED' && errorCode === 'JOB_FAILED') {
    return { results: [rs(j1, true), rs(j2, false)], states: [st(j1, successState), st(j2, 'FAILED', 'mock forced failure')] };
  }
  if (status === 'IN_PROGRESS' || status === 'READY') {
    return { results: [], states: [st(j1, successState), st(j2, 'RUNNING')] };
  }
  if (status === 'FAILED') {
    // CALL_TIMEOUT / CHECK_ERROR — timed out before terminal; last observation only.
    return { results: [], states: [st(j1, successState), st(j2, 'RUNNING')] };
  }
  if (status === 'CANCELLED') {
    return { results: [], states: [st(j1, 'RUNNING')] };
  }
  return { results: [], states: [] };
};

const synthFor = (a: MockAttempt, taskId: number, defName: string): SynthJobs =>
  synthTerraformJobs(taskId, a.attempt_number, a.status, a.error_code, successStateFor(defName), attemptStamp(a));

const toAttemptView = (a: MockAttempt, kind: TaskKind, taskId: number, defName: string): TaskAttemptView => {
  const synth = kind === 'TERRAFORM_JOB' && needsSynth(a) ? synthFor(a, taskId, defName) : null;
  return {
    attempt_number: a.attempt_number,
    status: a.status,
    error_code: a.error_code,
    response: a.response,
    failure_detail: a.failure_detail,
    started_at: a.started_at,
    finished_at: a.finished_at,
    check: a.check ? toCheckView(a.check) : null,
    terraform_results: synth ? synth.results : a.terraform_results,
    job_states: synth ? synth.states : a.job_states,
  };
};

const toTaskDetail = (pipelineId: number, t: MockTask): TaskDetail => {
  const def = CATALOG.get(t.task_definition);
  const kind = kindOf(t.task_definition);
  return {
    task_id: t.task_id,
    pipeline_id: pipelineId,
    sequence: t.sequence,
    kind,
    task_definition: t.task_definition,
    definition: def ? toDefinitionView(def) : null,
    operation: operationOf(t.task_definition),
    status: t.status,
    fail_count: t.fail_count,
    error_code: t.status === 'FAILED' ? t.error_code : null,
    consumes_terraform_slot: consumesOf(t.task_definition),
    started_at: t.started_at,
    ready_at: t.ready_at,
    finished_at: t.finished_at,
    next_check_at: t.next_check_at,
    effective_polling_interval: POLLING_INTERVAL,
    effective_execution_timeout: kind === 'CONDITION_CHECK' ? null : TERRAFORM_TIMEOUT,
    effective_max_fail_count: t.effective_max_fail_count,
    attempts: t.attempts.map((a) => toAttemptView(a, kind, t.task_id, t.task_definition)),
    description: t.description,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers — errors, paging, provider resolution
// ═══════════════════════════════════════════════════════════════════════════

const ok = (body: unknown): OrchestratorRawResponse => ({ status: 200, body });

const HTTP_STATUS_TEXT: Record<number, string> = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

const err = (status: number, code: string, message: string, path: string): OrchestratorRawResponse => {
  const body: OrchestratorErrorBody = {
    timestamp: new Date().toISOString(),
    status: `${status} ${HTTP_STATUS_TEXT[status] ?? 'ERROR'}`,
    code: `ORCHESTRATION_${code}`,
    message,
    path,
  };
  return { status, body };
};

const SORTED: SpringSort = { empty: false, sorted: true, unsorted: false };

const springPage = <T>(all: T[], page: number, size: number): SpringPage<T> => {
  const totalElements = all.length;
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;
  const start = page * size;
  const content = size > 0 ? all.slice(start, start + size) : [];
  return {
    content,
    pageable: { pageNumber: page, pageSize: size, sort: SORTED, offset: start, paged: true, unpaged: false },
    last: totalPages === 0 ? true : page >= totalPages - 1,
    totalPages,
    totalElements,
    size,
    number: page,
    sort: SORTED,
    first: page === 0,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
};

// Default order: created_at desc, then pipeline_id desc (upstream default sort).
const byCreatedDesc = (a: MockPipeline, b: MockPipeline): number => {
  const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  return diff !== 0 ? diff : b.pipeline_id - a.pipeline_id;
};

const INTERNAL_PROVIDER: Record<string, CloudProvider> = {
  AWS: 'AWS',
  GCP: 'GCP',
  AZURE: 'AZURE',
  Azure: 'AZURE',
  IDC: 'IDC',
};

/** Resolve a target-source's cloud provider from the app's mock seed. null = not found. */
const resolveProvider = (targetSourceId: string): CloudProvider | null => {
  const numericId = Number(targetSourceId);
  if (!Number.isFinite(numericId)) return null;
  const project = getProjectByTargetSourceId(numericId);
  if (!project) return null;
  return INTERNAL_PROVIDER[project.cloudProvider] ?? null;
};

/** Resolve a target-source's owning service (projectCode/name) from the app's
 *  mock seed — assumed addition to PipelineSummary (#3). Falls back to the
 *  target_source_id itself when the target isn't in the app's project seed. */
const resolveService = (targetSourceId: string): { service_code: string; service_name: string } => {
  const project = getProjectByTargetSourceId(Number(targetSourceId));
  return project
    ? { service_code: project.projectCode, service_name: project.name }
    : { service_code: targetSourceId, service_name: targetSourceId };
};

const hasActiveRun = (targetSourceId: string): boolean =>
  store().some(
    (p) => p.target_source_id === targetSourceId && (p.status === 'PENDING' || p.status === 'RUNNING'),
  );

const nextPipelineId = (): number => store().reduce((max, p) => Math.max(max, p.pipeline_id), 0) + 1;

const parseIntParam = (value: string | null, fallback: number): number => {
  if (value === null) return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

const PERIOD_WINDOW_MS: Record<StatisticsPeriodToken, number> = {
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const isPeriodToken = (value: string): value is StatisticsPeriodToken =>
  value === '1h' || value === '1d' || value === '7d';

const isPipelineStatus = (value: string): value is PipelineStatus =>
  value === 'PENDING' || value === 'RUNNING' || value === 'DONE' || value === 'FAILED' || value === 'CANCELLED';

const isCloudProvider = (value: string): value is CloudProvider =>
  value === 'AWS' || value === 'GCP' || value === 'AZURE' || value === 'IDC';

const isPipelineType = (value: string): value is PipelineType =>
  value === 'INSTALL' || value === 'DELETE' || value === 'CUSTOM';

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

// ═══════════════════════════════════════════════════════════════════════════
// Handlers (12 endpoints) — each returns { status, body } verbatim, never throws
// ═══════════════════════════════════════════════════════════════════════════

const PATH = {
  pipelines: '/api/v1/pipelines',
  taskDefinitions: '/api/v1/task-definitions',
  targetPipelines: (id: string): string => `/api/v1/target-sources/${id}/pipelines`,
};

// ═══════════════════════════════════════════════════════════════════════════
// Per-job log bodies + full state responses backing the #5a/#5b endpoints.
// Keyed `${taskId}:${attemptNumber}:${jobId}`; only jobs the seed exercises are
// present (task 12401 FAILED, task 12804 in-flight). Timestamps are anchored at
// import time — good enough for the viewer's "collected HH:MM" stamps.
// ═══════════════════════════════════════════════════════════════════════════

const jobAgo = (min: number): string => new Date(Date.now() - min * 60_000).toISOString();

// Real terraform output is ANSI-colourised; these wrap text in SGR escape codes
// so the log viewer exercises its formatting (green adds, red errors, bold
// headers) instead of showing raw `[0m` litter. ESC (0x1b) as a char code keeps
// the source pure ASCII.
const E = String.fromCharCode(27);
const green = (s: string): string => `${E}[32m${s}${E}[0m`;
const red = (s: string): string => `${E}[31m${s}${E}[0m`;
const bold = (s: string): string => `${E}[1m${s}${E}[0m`;

const RESULT_FIXTURES: Record<string, Omit<TerraformJobResultDetail, 'task_id' | 'attempt_number' | 'job_id'>> = {
  // task 12401 · attempt 1 — live read-through (no stored rows yet at timeout)
  '12401:1:1019': { succeeded: true, truncated: false, source: 'live', created_at: null, fetch_error: null,
    content: 'aws_glue_catalog_database.service_level: Creating...\n'
      + 'aws_glue_catalog_database.service_level: Creation complete after 2s\n\n'
      + 'Apply complete! Resources: 214 added, 0 changed, 0 destroyed.' },
  '12401:1:1020': { succeeded: null, truncated: false, source: 'live', created_at: null, fetch_error: null,
    content: 'aws_glue_catalog_table.bdc_common["tbl_0301"]: Creating...\n'
      + 'aws_glue_catalog_table.bdc_common["tbl_0301"]: Still creating... [1m30s elapsed]' },
  '12401:1:1021': { succeeded: null, truncated: false, source: 'live', created_at: null, content: null,
    fetch_error: 'InfraManager returned no result (call timed out after PT30S)' },
  // task 12401 · attempt 2 — stored terraform_result rows
  '12401:2:1026': { succeeded: true, truncated: false, source: 'stored', created_at: jobAgo(3 * 60 - 30), fetch_error: null,
    content: 'aws_glue_catalog_database.service_level: Creating...\n'
      + `aws_glue_catalog_database.service_level: ${green('Creation complete after 2s')} [id=svc-alpha:service_level]\n`
      + 'aws_iam_role.pii_agent_scan: Creating...\n'
      + `aws_iam_role.pii_agent_scan: ${green('Creation complete after 1s')}\n\n`
      + green(bold('Apply complete! Resources: 214 added, 0 changed, 0 destroyed.')) },
  '12401:2:1027': { succeeded: false, truncated: true, source: 'stored', created_at: jobAgo(3 * 60 - 30), fetch_error: null,
    content: 'aws_glue_catalog_table.bdc_common["tbl_0417"]: Still creating... [2m10s elapsed]\n'
      + `aws_glue_catalog_table.bdc_common["tbl_0417"]: ${green('Creation complete after 2m12s')}\n\n`
      + `${red(bold('Error:'))} ${bold('Error acquiring the state lock')}\n\n`
      + 'Error message: ConditionalCheckFailedException: The conditional request failed\n'
      + 'Lock Info:\n'
      + '  ID:        8f2a1c3e-77b4-4e01-9d2f-3a5b6c7d8e90\n'
      + '  Path:      svc-alpha/service-level/terraform.tfstate\n'
      + '  Operation: OperationTypeApply\n'
      + '  Who:       infra-manager@worker-3\n'
      + '  Created:   2026-07-09 10:42:58 UTC\n\n'
      + 'Terraform acquires a state lock to protect the state from being written\n'
      + 'by multiple users at the same time.' },
  // stored pointer row — job terminal, but the log body was never collected
  '12401:2:1028': { succeeded: true, truncated: false, source: 'stored', created_at: jobAgo(3 * 60 - 30), content: null, fetch_error: null },
  // task 12804 · attempt 1 — in-flight, live read-through
  '12804:1:1031': { succeeded: true, truncated: false, source: 'live', created_at: null, fetch_error: null,
    content: 'aws_glue_catalog_database.bdc_common: Creating...\n'
      + 'aws_glue_catalog_database.bdc_common: Creation complete after 3s\n\n'
      + 'Apply complete! Resources: 96 added, 0 changed, 0 destroyed.' },
  '12804:1:1032': { succeeded: null, truncated: false, source: 'live', created_at: null, fetch_error: null,
    content: 'aws_glue_catalog_table.bdc_common["tbl_0114"]: Creating...\n'
      + 'aws_glue_catalog_table.bdc_common["tbl_0114"]: Still creating... [40s elapsed]' },
  '12804:1:1033': { succeeded: null, truncated: false, source: 'live', created_at: null, fetch_error: null,
    content: 'Initializing the backend...\nInitializing provider plugins...\n'
      + 'Terraform has been successfully initialized!' },
};

/** Raw state-poll response body, pretty-printed as the upstream stores it. The
 *  viewer renders it verbatim (never re-parses), so the mock owns the formatting. */
const stateJson = (terraformState: string, failReason: string | null): string =>
  JSON.stringify({ terraformState, failReason }, null, 2);

const STATE_FIXTURES: Record<string, Omit<TerraformJobStateDetail, 'task_id' | 'attempt_number' | 'job_id'>> = {
  '12401:1:1019': { last_state: 'COMPLETED', last_fail_reason: null, last_error: null,
    last_response: stateJson('COMPLETED', null), poll_count: 4, last_polled_at: jobAgo(3 * 60 - 13) },
  '12401:1:1020': { last_state: 'RUNNING', last_fail_reason: null, last_error: null,
    last_response: stateJson('RUNNING', null), poll_count: 4, last_polled_at: jobAgo(3 * 60 - 13) },
  '12401:1:1021': { last_state: null, last_fail_reason: null, last_error: 'infra-manager call timed out after PT30S',
    last_response: null, poll_count: 4, last_polled_at: jobAgo(3 * 60 - 14) },
  '12401:2:1026': { last_state: 'COMPLETED', last_fail_reason: null, last_error: null,
    last_response: stateJson('COMPLETED', null), poll_count: 6, last_polled_at: jobAgo(3 * 60 - 31) },
  '12401:2:1027': { last_state: 'FAILED', last_fail_reason: 'mock forced failure', last_error: null,
    last_response: stateJson('FAILED', 'mock forced failure'), poll_count: 6, last_polled_at: jobAgo(3 * 60 - 31) },
  '12401:2:1028': { last_state: 'COMPLETED', last_fail_reason: null, last_error: null,
    last_response: stateJson('COMPLETED', null), poll_count: 6, last_polled_at: jobAgo(3 * 60 - 31) },
  '12804:1:1031': { last_state: 'COMPLETED', last_fail_reason: null, last_error: null,
    last_response: stateJson('COMPLETED', null), poll_count: 2, last_polled_at: jobAgo(29) },
  '12804:1:1032': { last_state: 'RUNNING', last_fail_reason: null, last_error: null,
    last_response: stateJson('RUNNING', null), poll_count: 2, last_polled_at: jobAgo(29) },
  '12804:1:1033': { last_state: 'RUNNING', last_fail_reason: null, last_error: null,
    last_response: stateJson('RUNNING', null), poll_count: 2, last_polled_at: jobAgo(29) },
};

// Generic log bodies for synthesized jobs (tasks without hand-written fixtures).
const LOG_OK = 'Initializing the backend...\nInitializing provider plugins...\n'
  + `aws_resource.main: Creating...\naws_resource.main: ${green('Creation complete after 3s')}\n\n`
  + green(bold('Apply complete! Resources: 12 added, 0 changed, 0 destroyed.'));
const LOG_FAIL = 'aws_resource.main: Creating...\n\n'
  + `${red(bold('Error:'))} ${bold('error applying plan')}\n\n  on main.tf line 14:\n\n`
  + 'resource creation failed: mock forced failure\n\nApply cancelled.';
const LOG_RUNNING = 'aws_resource.main: Creating...\n'
  + 'aws_resource.main: Still creating... [30s elapsed]';

/** Locate (pipeline, task, attempt) or the 404 to return. */
const resolveAttempt = (
  pipelineId: string, taskId: string, attemptNumber: string, path: string,
): { error: OrchestratorRawResponse } | { task: MockTask; attempt: MockAttempt | undefined } => {
  const pipeline = store().find((p) => String(p.pipeline_id) === pipelineId);
  if (!pipeline) return { error: err(404, 'PIPELINE_NOT_FOUND', `no pipeline ${pipelineId}`, path) };
  const task = pipeline.tasks.find((t) => String(t.task_id) === taskId);
  if (!task) return { error: err(404, 'TASK_NOT_FOUND', `no task ${taskId} in pipeline ${pipelineId}`, path) };
  return { task, attempt: task.attempts.find((a) => String(a.attempt_number) === attemptNumber) };
};

/** A synthesized job's result body (or null when the job isn't part of the attempt). */
const synthResultBody = (
  task: MockTask, attempt: MockAttempt, jobId: string, taskId: number, n: number,
): TerraformJobResultDetail | null => {
  if (kindOf(task.task_definition) !== 'TERRAFORM_JOB' || !needsSynth(attempt)) return null;
  const s = synthFor(attempt, taskId, task.task_definition);
  const result = s.results.find((r) => r.job_id === jobId);
  const state = s.states.find((x) => x.job_id === jobId);
  if (!result && !state) return null;
  const base = { task_id: taskId, attempt_number: n, job_id: jobId, truncated: false, fetch_error: null };
  if (result) {
    return { ...base, succeeded: result.succeeded, source: 'stored', created_at: result.created_at,
      content: result.succeeded ? LOG_OK : LOG_FAIL };
  }
  // State only (in-flight / timed-out) → live read-through.
  return { ...base, succeeded: null, source: 'live', created_at: null,
    content: state?.last_state === 'RUNNING' ? LOG_RUNNING : LOG_OK };
};

/** A synthesized job's state body (or null when the job isn't part of the attempt). */
const synthStateBody = (
  task: MockTask, attempt: MockAttempt, jobId: string, taskId: number, n: number,
): TerraformJobStateDetail | null => {
  if (kindOf(task.task_definition) !== 'TERRAFORM_JOB' || !needsSynth(attempt)) return null;
  const state = synthFor(attempt, taskId, task.task_definition).states.find((x) => x.job_id === jobId);
  if (!state) return null;
  return {
    task_id: taskId, attempt_number: n, job_id: jobId,
    last_state: state.last_state, last_fail_reason: state.last_fail_reason, last_error: state.last_error,
    last_response: state.last_state === null ? null : stateJson(state.last_state, state.last_fail_reason),
    poll_count: state.poll_count, last_polled_at: state.last_polled_at,
  };
};

export const mockPipeline = {
  // #1
  liveStatistics(): OrchestratorRawResponse {
    const pipelines = store();
    const running = pipelines.filter((p) => p.status === 'RUNNING');
    const body: LivePipelineStatistics = {
      running_pipeline_count: running.length,
      pending_pipeline_count: pipelines.filter((p) => p.status === 'PENDING').length,
      in_progress_terraform_task_count: pipelines
        .flatMap((p) => p.tasks)
        .filter((t) => t.status === 'IN_PROGRESS' && kindOf(t.task_definition) === 'TERRAFORM_JOB').length,
      terraform_slot_cap: 4,
      running_pipeline_cap: 10,
      active_claim_count: running.filter((p) => p.leased).length,
    };
    return ok(body);
  },

  // #2
  statistics(period: string | undefined): OrchestratorRawResponse {
    const path = `${PATH.pipelines}/statistics`;
    if (period === undefined || period === '') {
      return err(400, 'INVALID_PARAMETER', 'invalid or missing request parameter', path);
    }
    if (!isPeriodToken(period)) {
      return err(400, 'INVALID_STATISTICS_PERIOD', `unknown statistics period: ${period}`, path);
    }
    const sinceMs = Date.now() - PERIOD_WINDOW_MS[period];
    const rows = store().filter((p) => new Date(p.created_at).getTime() >= sinceMs);
    const countBy = (status: PipelineStatus): number => rows.filter((p) => p.status === status).length;
    const body: PipelineStatistics = {
      period,
      since: new Date(sinceMs).toISOString(),
      pending_count: countBy('PENDING'),
      running_count: countBy('RUNNING'),
      failed_count: countBy('FAILED'),
      done_count: countBy('DONE'),
      cancelled_count: countBy('CANCELLED'),
      total_count: rows.length,
    };
    return ok(body);
  },

  // #3
  list(query: string): OrchestratorRawResponse {
    const params = new URLSearchParams(query);
    const statusFilter = params.get('status');
    const providerFilter = params.get('provider');
    const typeFilter = params.get('type');
    const period = params.get('period');
    const page = parseIntParam(params.get('page'), 0);
    const size = parseIntParam(params.get('size'), 20);

    if (statusFilter !== null && !isPipelineStatus(statusFilter)) {
      return err(400, 'INVALID_PARAMETER', 'invalid or missing request parameter', PATH.pipelines);
    }
    if (providerFilter !== null && !isCloudProvider(providerFilter)) {
      return err(400, 'INVALID_PARAMETER', 'invalid or missing request parameter', PATH.pipelines);
    }
    if (typeFilter !== null && !isPipelineType(typeFilter)) {
      return err(400, 'INVALID_PARAMETER', 'invalid or missing request parameter', PATH.pipelines);
    }
    if (period !== null && !isPeriodToken(period)) {
      return err(400, 'INVALID_STATISTICS_PERIOD', `unknown statistics period: ${period}`, PATH.pipelines);
    }

    const sinceMs = period && isPeriodToken(period) ? Date.now() - PERIOD_WINDOW_MS[period] : null;
    const rows = store()
      .filter((p) => (statusFilter ? p.status === statusFilter : true))
      .filter((p) => (providerFilter ? p.cloud_provider === providerFilter : true))
      .filter((p) => (typeFilter ? p.type === typeFilter : true))
      .filter((p) => (sinceMs === null ? true : new Date(p.created_at).getTime() >= sinceMs))
      .sort(byCreatedDesc)
      .map(toSummary);
    return ok(springPage(rows, page, size));
  },

  // #4
  detail(pipelineId: string): OrchestratorRawResponse {
    const pipeline = store().find((p) => String(p.pipeline_id) === pipelineId);
    if (!pipeline) {
      return err(404, 'PIPELINE_NOT_FOUND', `no pipeline ${pipelineId}`, `${PATH.pipelines}/${pipelineId}`);
    }
    return ok(toDetail(pipeline));
  },

  // #5
  taskDetail(pipelineId: string, taskId: string): OrchestratorRawResponse {
    const path = `${PATH.pipelines}/${pipelineId}/tasks/${taskId}`;
    const pipeline = store().find((p) => String(p.pipeline_id) === pipelineId);
    if (!pipeline) {
      return err(404, 'PIPELINE_NOT_FOUND', `no pipeline ${pipelineId}`, path);
    }
    const task = pipeline.tasks.find((t) => String(t.task_id) === taskId);
    if (!task) {
      return err(404, 'TASK_NOT_FOUND', `no task ${taskId} in pipeline ${pipelineId}`, path);
    }
    return ok(toTaskDetail(pipeline.pipeline_id, task));
  },

  // #5a GET …/tasks/{taskId}/attempts/{attemptNumber}/jobs/{jobId}/result
  jobResult(pipelineId: string, taskId: string, attemptNumber: string, jobId: string): OrchestratorRawResponse {
    const path = `${PATH.pipelines}/${pipelineId}/tasks/${taskId}/attempts/${attemptNumber}/jobs/${jobId}/result`;
    const r = resolveAttempt(pipelineId, taskId, attemptNumber, path);
    if ('error' in r) return r.error;
    const fixture = RESULT_FIXTURES[`${taskId}:${attemptNumber}:${jobId}`];
    if (fixture) {
      return ok({ task_id: Number(taskId), attempt_number: Number(attemptNumber), job_id: jobId, ...fixture });
    }
    const synth = r.attempt
      ? synthResultBody(r.task, r.attempt, jobId, Number(taskId), Number(attemptNumber))
      : null;
    if (synth) return ok(synth);
    return err(404, 'TERRAFORM_RESULT_NOT_FOUND',
      `no terraform result for job ${jobId} (task ${taskId}, attempt ${attemptNumber})`, path);
  },

  // #5b GET …/tasks/{taskId}/attempts/{attemptNumber}/jobs/{jobId}/state
  jobState(pipelineId: string, taskId: string, attemptNumber: string, jobId: string): OrchestratorRawResponse {
    const path = `${PATH.pipelines}/${pipelineId}/tasks/${taskId}/attempts/${attemptNumber}/jobs/${jobId}/state`;
    const r = resolveAttempt(pipelineId, taskId, attemptNumber, path);
    if ('error' in r) return r.error;
    const fixture = STATE_FIXTURES[`${taskId}:${attemptNumber}:${jobId}`];
    if (fixture) {
      return ok({ task_id: Number(taskId), attempt_number: Number(attemptNumber), job_id: jobId, ...fixture });
    }
    const synth = r.attempt
      ? synthStateBody(r.task, r.attempt, jobId, Number(taskId), Number(attemptNumber))
      : null;
    if (synth) return ok(synth);
    return err(404, 'TERRAFORM_JOB_STATE_NOT_FOUND',
      `no state observation for job ${jobId} (task ${taskId}, attempt ${attemptNumber})`, path);
  },

  // #6 — two-phase cancel
  cancel(pipelineId: string): OrchestratorRawResponse {
    const pipeline = store().find((p) => String(p.pipeline_id) === pipelineId);
    if (!pipeline) {
      return err(404, 'PIPELINE_NOT_FOUND', `no pipeline ${pipelineId}`, `${PATH.pipelines}/${pipelineId}/cancel`);
    }
    const terminal = pipeline.status === 'DONE' || pipeline.status === 'FAILED' || pipeline.status === 'CANCELLED';
    if (terminal) {
      // Idempotent no-op on terminal.
      return ok(toDetail(pipeline));
    }
    if (pipeline.status === 'RUNNING' && pipeline.leased) {
      // Live lease → cooperative cancel: record the request, worker applies later.
      pipeline.cancel_requested = true;
      pipeline.last_activity_at = new Date().toISOString();
      return ok(toDetail(pipeline));
    }
    // PENDING or idle/lease-expired RUNNING → immediate CANCELLED + cascade non-terminal tasks.
    pipeline.status = 'CANCELLED';
    pipeline.leased = false;
    pipeline.next_due_at = null;
    pipeline.last_activity_at = new Date().toISOString();
    for (const task of pipeline.tasks) {
      if (task.status === 'BLOCKED' || task.status === 'READY' || task.status === 'IN_PROGRESS') {
        task.status = 'CANCELLED';
      }
    }
    return ok(toDetail(pipeline));
  },

  // #7
  listByTarget(targetSourceId: string, query: string): OrchestratorRawResponse {
    const params = new URLSearchParams(query);
    const page = parseIntParam(params.get('page'), 0);
    const size = parseIntParam(params.get('size'), 20);
    const rows = store()
      .filter((p) => p.target_source_id === targetSourceId)
      .sort(byCreatedDesc)
      .map(toSummary);
    return ok(springPage(rows, page, size));
  },

  // #8 — 204 when the target has no runs
  latestByTarget(targetSourceId: string): OrchestratorRawResponse {
    const latest = store()
      .filter((p) => p.target_source_id === targetSourceId)
      .sort(byCreatedDesc)[0];
    if (!latest) {
      return { status: 204, body: null };
    }
    return ok(toSummary(latest));
  },

  // #9
  preview(targetSourceId: string, type: string | undefined): OrchestratorRawResponse {
    const path = `${PATH.targetPipelines(targetSourceId)}/preview`;
    if (type === undefined || type === '') {
      return err(400, 'INVALID_PARAMETER', 'invalid or missing request parameter', path);
    }
    if (type === 'CUSTOM') {
      return err(400, 'UNSUPPORTED_RECIPE',
        'type CUSTOM has no catalog recipe; use the custom endpoint for custom execution', path);
    }
    if (type !== 'INSTALL' && type !== 'DELETE') {
      return err(400, 'INVALID_PARAMETER', 'invalid or missing request parameter', path);
    }
    const provider = resolveProvider(targetSourceId);
    if (!provider) {
      return err(503, 'PROVIDER_LOOKUP_FAILED', `provider lookup failed for target '${targetSourceId}'`, path);
    }
    const recipe = findRecipe(provider, type);
    if (!recipe) {
      return err(400, 'UNSUPPORTED_RECIPE', `no recipe for provider ${provider} and type ${type}`, path);
    }
    const steps: RecipePreviewStep[] = recipe.steps.map((defName, index) => {
      const def = CATALOG.get(defName)!;
      return {
        sequence: index,
        task_definition: def.name,
        kind: def.kind,
        operation: def.operation,
        display_name: def.displayName,
        consumes_terraform_slot: consumesSlot(def),
        definition: toDefinitionView(def),
      };
    });
    const body: RecipePreview = {
      type,
      provider,
      recipe_definition: recipe.name,
      display_name: recipe.displayName,
      description: recipe.description,
      steps,
    };
    return ok(body);
  },

  // #10
  create(targetSourceId: string, body: unknown): OrchestratorRawResponse {
    const path = PATH.targetPipelines(targetSourceId);
    const raw = asRecord(body);
    const type = raw.type;
    if (type === undefined || type === null || type === '') {
      return err(400, 'PIPELINE_TYPE_REQUIRED', 'type must not be null', path);
    }
    if (type === 'CUSTOM') {
      return err(400, 'UNSUPPORTED_RECIPE',
        'type CUSTOM has no catalog recipe; use the custom endpoint for custom execution', path);
    }
    if (type !== 'INSTALL' && type !== 'DELETE') {
      return err(400, 'INVALID_PARAMETER', 'invalid or missing request parameter', path);
    }
    const provider = resolveProvider(targetSourceId);
    if (!provider) {
      return err(503, 'PROVIDER_LOOKUP_FAILED', `provider lookup failed for target '${targetSourceId}'`, path);
    }
    const recipe = findRecipe(provider, type);
    if (!recipe) {
      return err(400, 'UNSUPPORTED_RECIPE', `no recipe for provider ${provider} and type ${type}`, path);
    }
    if (hasActiveRun(targetSourceId)) {
      return err(409, 'PIPELINE_ALREADY_ACTIVE', `target '${targetSourceId}' already has an active run`, path);
    }
    const created = buildPendingPipeline(targetSourceId, provider, type, recipe.name, recipe.steps);
    store().push(created);
    return ok(toDetail(created));
  },

  // #11
  createCustom(targetSourceId: string, body: unknown): OrchestratorRawResponse {
    const path = `${PATH.targetPipelines(targetSourceId)}/custom`;
    const raw = asRecord(body);
    const tasks = raw.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return err(400, 'CUSTOM_TASKS_REQUIRED', 'tasks must not be empty', path);
    }
    const parsed = tasks.map(asRecord);
    // 1) unknown task name
    for (const t of parsed) {
      const name = typeof t.name === 'string' ? t.name : '';
      if (!CATALOG.has(name)) {
        return err(400, 'UNKNOWN_TASK', `unknown task: ${name}`, path);
      }
    }
    // 2) description too long
    for (const t of parsed) {
      const description = typeof t.description === 'string' ? t.description : '';
      if (description.length > 100) {
        return err(400, 'TASK_DESCRIPTION_TOO_LONG', 'task description must be at most 100 characters', path);
      }
    }
    // 3) provider lookup
    const provider = resolveProvider(targetSourceId);
    if (!provider) {
      return err(503, 'PROVIDER_LOOKUP_FAILED', `provider lookup failed for target '${targetSourceId}'`, path);
    }
    // 4) provider mismatch
    for (const t of parsed) {
      const def = CATALOG.get(t.name as string)!;
      if (def.provider !== provider) {
        return err(400, 'TASK_PROVIDER_MISMATCH',
          `task ${def.name} provider ${def.provider} does not match target provider ${provider}`, path);
      }
    }
    // 5) active run
    if (hasActiveRun(targetSourceId)) {
      return err(409, 'PIPELINE_ALREADY_ACTIVE', `target '${targetSourceId}' already has an active run`, path);
    }
    const pipelineId = nextPipelineId();
    const now = new Date().toISOString();
    const customTasks: MockTask[] = parsed.map((t, index) => {
      const def = CATALOG.get(t.name as string)!;
      const description = typeof t.description === 'string' && t.description.length > 0 ? t.description : null;
      return {
        task_id: pipelineId * 100 + index,
        sequence: index,
        task_definition: def.name,
        status: index === 0 ? 'READY' : 'BLOCKED',
        fail_count: 0,
        error_code: null,
        started_at: null,
        ready_at: index === 0 ? now : null,
        finished_at: null,
        next_check_at: null,
        effective_max_fail_count: defaultMaxFail(def),
        description,
        attempts: [],
      };
    });
    const created: MockPipeline = {
      pipeline_id: pipelineId,
      type: 'CUSTOM',
      target_source_id: targetSourceId,
      ...resolveService(targetSourceId),
      cloud_provider: provider,
      recipe_definition: null,
      status: 'PENDING',
      created_at: now,
      last_activity_at: now,
      next_due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      leased: false,
      cancel_requested: false,
      due_lag_millis: 0,
      tasks: customTasks,
    };
    store().push(created);
    return ok(toDetail(created));
  },

  // #12
  taskDefinitions(provider: string | undefined): OrchestratorRawResponse {
    if (provider !== undefined && provider !== '' && !isCloudProvider(provider)) {
      return err(400, 'INVALID_PARAMETER', 'invalid or missing request parameter', PATH.taskDefinitions);
    }
    const entries: TaskCatalogEntry[] = CATALOG_DEFS
      .filter((def) => (provider && isCloudProvider(provider) ? def.provider === provider : true))
      .map((def) => ({
        name: def.name,
        display_name: def.displayName,
        description: def.description,
        provider: def.provider,
        kind: def.kind,
        consumes_terraform_slot: consumesSlot(def),
      }));
    const body: TaskCatalogResponse = { task_definitions: entries };
    return ok(body);
  },
};

function buildPendingPipeline(
  targetSourceId: string,
  provider: CloudProvider,
  type: PipelineType,
  recipeName: string,
  steps: string[],
): MockPipeline {
  const pipelineId = nextPipelineId();
  const now = new Date().toISOString();
  const tasks: MockTask[] = steps.map((defName, index) => {
    const def = CATALOG.get(defName)!;
    return {
      task_id: pipelineId * 100 + index,
      sequence: index,
      task_definition: defName,
      status: index === 0 ? 'READY' : 'BLOCKED',
      fail_count: 0,
      error_code: null,
      started_at: null,
      ready_at: index === 0 ? now : null,
      finished_at: null,
      next_check_at: null,
      effective_max_fail_count: defaultMaxFail(def),
      description: null,
      attempts: [],
    };
  });
  return {
    pipeline_id: pipelineId,
    type,
    target_source_id: targetSourceId,
    ...resolveService(targetSourceId),
    cloud_provider: provider,
    recipe_definition: recipeName,
    status: 'PENDING',
    created_at: now,
    last_activity_at: now,
    next_due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    leased: false,
    cancel_requested: false,
    due_lag_millis: 0,
    tasks,
  };
}
