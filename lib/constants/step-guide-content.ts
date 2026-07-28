/**
 * Step guide content — hardcoded; the end-user guide rail renders these
 * strings directly (no CMS fetch). Content is written against the REAL
 * step UI and the admin console flows, with one goal: users should be
 * able to self-resolve without contacting the operations team.
 *
 * Editorial rules (derived from admin-side reality — keep them on edit):
 * - Only reference buttons/labels that actually render (e.g. 스캔 시작,
 *   연동 대상 승인 요청, Run Test, 완료 승인 요청, 연결 테스트 재실행).
 * - No email promises (no email notification path exists), no fixed retry
 *   counts (retries are per-task config), no placeholder links.
 * - Step pages do not auto-poll (except scan/connection-test runs), so
 *   waiting steps tell the user to refresh.
 * - Escalation threshold matches the admin alert board: warn ≈ 1 day.
 * - Escalation channel is the 협업 채널 card at the top of this rail.
 *
 * Markup must satisfy `validateGuideHtml` (h4/p/br/ul/ol/li/strong/em/
 * code/a only) — asserted by `__tests__/step-guide-content.test.ts`.
 */

import type { GuideName } from '@/lib/types/guide';

// ---------------------------------------------------------------------------
// Step 1 — target selection
// ---------------------------------------------------------------------------

// GCP has no VM integration (docs/cloud-provider-states.md) — the VM row
// guidance is emitted only for providers that scan VMs (AWS/Azure).
const step1Cloud = (resources: string, { vmRows = true }: { vmRows?: boolean } = {}): string =>
  '<h4>연동 대상 DB를 선택해 주세요</h4>' +
  `<p><strong>스캔 시작</strong>으로 ${resources} 리소스를 조회한 뒤, PII 모니터링이 필요한 DB를 선택하고 <strong>연동 대상 승인 요청</strong>을 눌러 주세요.</p>` +
  '<ul>' +
  '<li>스캔은 평균 5분 이내 완료돼요. 방금 스캔했다면 5분 안에는 다시 실행되지 않아요.</li>' +
  '<li>선택하지 않는 리소스에는 <strong>제외 사유</strong>를 입력해 주세요. 미선택 리소스가 모두 제외 확정되면 관리자 승인 없이 자동 승인돼요.</li>' +
  (vmRows
    ? '<li>VM 리소스는 행을 펼쳐 <strong>데이터베이스 설정</strong>(타입·Host·포트)을 저장해야 선택할 수 있어요.</li>'
    : '') +
  '<li>리소스가 안 보이거나 스캔이 실패하면 스캔 권한(Role) 설정을 확인하고 <strong>다시 시도</strong>해 주세요.</li>' +
  '</ul>';

const IDC_TARGET_INPUT_HTML =
  '<h4>연동 대상 DB 접속 정보를 입력해 주세요</h4>' +
  '<p>IDC는 자동 스캔이 지원되지 않아요. <strong>연동 대상 추가</strong>로 IP 또는 Domain·Port·Database Type을 등록한 뒤 <strong>연동 대상 승인 요청</strong>을 눌러 주세요.</p>' +
  '<ul>' +
  '<li>Oracle처럼 SID가 필요한 DB는 Service ID를 함께 입력해 주세요.</li>' +
  '<li>이전에 요청한 적이 있다면 <strong>기존 연동 요청 정보 불러오기</strong>로 목록을 한 번에 채울 수 있어요.</li>' +
  '<li>연동하지 않을 대상은 제외로 두고 사유를 남겨 주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 2 — approval pending (shared)
// ---------------------------------------------------------------------------

const STEP_2_HTML =
  '<h4>관리자가 요청을 검토하고 있어요</h4>' +
  '<p>요청하신 연동 대상 목록을 관리자가 확인하고 있어요. 결과는 이 화면에 반영되며, 새로고침으로 최신 상태를 확인할 수 있어요.</p>' +
  '<ul>' +
  '<li>반려되면 이 화면에 <strong>반려 사유</strong>가 표시돼요. 사유에 맞춰 대상을 다시 구성해 재요청하면 돼요.</li>' +
  '<li>요청 내용을 바꾸고 싶다면 <strong>전체 요청 취소</strong>로 1단계로 돌아갈 수 있어요. 관리자에게 따로 연락할 필요 없어요.</li>' +
  '<li>1영업일 이상 응답이 없으면 상단 <strong>협업 채널</strong>로 문의해 주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 3 — applying (shared)
// ---------------------------------------------------------------------------

const STEP_3_HTML =
  '<h4>승인된 대상을 시스템에 반영하고 있어요</h4>' +
  '<p>승인 완료 후 Agent 설치를 위한 사전 작업이 자동으로 진행돼요. 별도 조치는 필요 없어요.</p>' +
  '<ul>' +
  '<li>평균 5분 내외 소요되며, 완료되면 다음 단계로 넘어가요. 새로고침으로 진행 상황을 확인해 주세요.</li>' +
  '<li>이 단계에서는 실제 데이터가 아닌 메타데이터만 동기화돼요.</li>' +
  '<li>하루 이상 이 단계에 머물러 있으면 상단 <strong>협업 채널</strong>로 문의해 주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 4 — install (per provider)
// ---------------------------------------------------------------------------

const AWS_AUTO_INSTALLING_HTML =
  '<h4>PII Agent가 자동 설치되고 있어요</h4>' +
  '<p>운영 시스템이 Terraform으로 권한 확인 → 서비스 측 → BDC 측 순서대로 리소스를 설치해요. 사용자가 할 일은 없어요.</p>' +
  '<ul>' +
  '<li>진행 상태는 자동 갱신되지 않아요. 새로고침하면 최신 상태를 확인할 수 있어요.</li>' +
  '<li>Terraform 실행 권한(TerraformExecutionRole)이 등록되지 않았다면 설치가 시작되지 않아요. 계정의 Role 등록 상태를 먼저 확인해 주세요.</li>' +
  '<li>작업이 <strong>실패</strong>로 표시되면 운영팀이 확인 후 재시작해요. 하루 이상 지속되면 상단 <strong>협업 채널</strong>로 알려 주세요.</li>' +
  '</ul>';

const AWS_MANUAL_INSTALLING_HTML =
  '<h4>서비스 측 Terraform을 직접 적용해 주세요</h4>' +
  '<p>Terraform 실행 권한이 없는 계정이라 <strong>서비스 측 리소스</strong>는 담당자가 전달한 Terraform Script를 직접 적용해야 해요. BDC 측 리소스는 운영 시스템이 설치해요.</p>' +
  '<ul>' +
  '<li>올바른 AWS 계정으로 인증됐는지 확인한 뒤 <code>terraform plan</code> 결과를 검토하고 <code>apply</code>를 실행해 주세요.</li>' +
  '<li>적용이 완료되면 설치 상태에 반영돼요. 새로고침으로 확인해 주세요.</li>' +
  '<li>Script 전달이나 적용 과정에 문제가 있으면 상단 <strong>협업 채널</strong>로 문의해 주세요.</li>' +
  '</ul>';

const AZURE_INSTALLING_HTML =
  '<h4>PII Agent를 설치하고 있어요</h4>' +
  '<p>서비스 측 사전 구성 → BDC 측 리소스 → Private Link 순서로 설치가 진행돼요. 완료된 카드를 누르면 리소스별 현황을 볼 수 있어요.</p>' +
  '<ul>' +
  '<li>서비스 측 Subnet·NSG 구성은 Azure 권한 제약으로 서비스 담당 부서가 직접 준비해야 해요.</li>' +
  '<li>Private Endpoint 연결 요청이 오면 Azure Portal에서 승인해 주세요.</li>' +
  '<li>진행 상태는 자동 갱신되지 않아요 — 새로고침으로 확인해 주세요. 실패가 지속되면 상단 <strong>협업 채널</strong>로 알려 주세요.</li>' +
  '</ul>';

const GCP_INSTALLING_HTML =
  '<h4>PII Agent를 설치하고 있어요</h4>' +
  '<p>모니터링용 Subnet 생성 → 서비스 측 구성 → BDC 측 리소스 순서로 자동 설치돼요. 각 카드를 누르면 리소스별 진행 현황을 볼 수 있어요.</p>' +
  '<ul>' +
  '<li>Subnet 생성을 선택한 경우 Subnet(10.30.0.0/22)·VPC Peering·방화벽 구성까지 시스템이 자동으로 처리해요. 사용자가 할 일은 없어요.</li>' +
  '<li>진행 상태는 자동 갱신되지 않아요 — 새로고침으로 확인해 주세요.</li>' +
  '<li>작업이 <strong>실패</strong>로 표시되면 운영팀이 확인 후 재시작해요. 하루 이상 지속되면 상단 <strong>협업 채널</strong>로 알려 주세요.</li>' +
  '</ul>';

const IDC_INSTALLING_HTML =
  '<h4>BDC 설치와 방화벽 오픈을 확인해 주세요</h4>' +
  '<p>BDC망에 수집 모듈이 설치되는 동안, 서비스 측에서는 <strong>Source IP → 연동 대상(IP:Port)</strong> 방화벽을 열어 주셔야 해요.</p>' +
  '<ul>' +
  '<li><strong>방화벽 확인</strong> 카드를 누르면 대상별 오픈 여부를 볼 수 있어요. 모든 대상이 열려야 다음 단계로 진행돼요.</li>' +
  // Plain quotes only — HTML entities split text nodes differently between
  // linkedom (SSR) and DOMParser (client) and cause hydration mismatches.
  "<li>'방화벽 오픈되지 않음'으로 표시된 대상은 서비스 측 방화벽에 허용 규칙을 등록해 주세요.</li>" +
  '<li>진행 상태는 자동 갱신되지 않아요 — 새로고침으로 확인해 주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 5 — connection test
// ---------------------------------------------------------------------------

const STEP_5_CLOUD_HTML =
  '<h4>DB 연결을 테스트해 주세요</h4>' +
  '<p>각 리소스의 <strong>DB Credential</strong>을 선택한 뒤 <strong>Run Test</strong>를 눌러 주세요. 모든 대상이 Success가 되면 <strong>완료 승인 요청</strong>으로 다음 단계로 넘어가요.</p>' +
  '<ul>' +
  '<li>Credential이 비어 있는 리소스가 있으면 Run Test가 비활성화돼요. 먼저 전부 선택해 주세요.</li>' +
  '<li>테스트 결과는 자동으로 갱신돼요. 실패한 대상은 Credential과 네트워크(방화벽·보안 그룹)를 점검한 뒤 다시 실행하면 돼요. 횟수 제한은 없어요.</li>' +
  '<li>Success인 대상은 <strong>논리 DB 확인</strong>에서 모니터링에서 제외할 논리 DB를 정리할 수 있어요.</li>' +
  '</ul>';

const STEP_5_IDC_HTML =
  '<h4>DB 연결을 테스트해 주세요</h4>' +
  '<p>각 연동 대상의 <strong>DB Credential</strong>을 선택한 뒤 <strong>Run Test</strong>를 눌러 주세요. 모든 대상이 Success가 되면 <strong>완료 승인 요청</strong>으로 다음 단계로 넘어가요.</p>' +
  '<ul>' +
  '<li>Credential이 비어 있는 대상이 있으면 Run Test가 비활성화돼요. 먼저 전부 선택해 주세요.</li>' +
  '<li>테스트 결과는 자동으로 갱신돼요. 실패하면 Credential과 <strong>Source IP → 연동 대상(IP:Port)</strong> 방화벽을 점검한 뒤 다시 실행하면 돼요.</li>' +
  '<li>Success인 대상은 <strong>논리 DB 관리</strong>에서 모니터링에서 제외할 논리 DB를 정리할 수 있어요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 6 — final admin approval (shared)
// ---------------------------------------------------------------------------

const STEP_6_HTML =
  '<h4>운영팀이 최종 확인하고 있어요</h4>' +
  '<p>연결이 확인된 대상에 대해 운영팀이 마지막 점검을 진행하고 있어요. 승인되면 바로 모니터링이 시작돼요.</p>' +
  '<ul>' +
  '<li>결과는 이 화면에 반영돼요. 새로고침으로 최신 상태를 확인해 주세요.</li>' +
  '<li>테스트를 다시 하고 싶다면 <strong>연결 테스트 재실행</strong>으로 직접 5단계로 돌아갈 수 있어요. 관리자 요청이 필요 없어요.</li>' +
  '<li>운영팀이 재실행을 요청하면 사유가 함께 표시돼요. 사유에 맞춰 조치 후 다시 테스트해 주세요.</li>' +
  '<li>1영업일 이상 지연되면 상단 <strong>협업 채널</strong>로 문의해 주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 7 — complete (shared)
// ---------------------------------------------------------------------------

const STEP_7_HTML =
  '<h4>연동이 완료되었습니다</h4>' +
  '<p>PII Agent가 동작 중이에요. 아래에서 각 DB의 연동 상태를 확인할 수 있어요.</p>' +
  '<ul>' +
  '<li>각 DB의 <strong>Status</strong>로 연동 상태를 확인할 수 있어요. 비정상이면 Credential과 Agent 상태를 점검해 주세요.</li>' +
  '<li>인프라가 변경되거나 새 리소스가 생기면 재연동이 필요해요. 상단 <strong>협업 채널</strong>로 요청해 주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Assembly — one entry per GuideName
// ---------------------------------------------------------------------------

const AWS_STEP_1_HTML = step1Cloud('AWS 계정의 RDS·S3 등');
const AZURE_STEP_1_HTML = step1Cloud('Azure Subscription의 SQL Database·Cosmos DB·Storage 등');
const GCP_STEP_1_HTML = step1Cloud('GCP Project의 Cloud SQL·BigQuery 등', { vmRows: false });

export const STEP_GUIDE_HTML: Record<GuideName, string> = {
  // AWS (8) — AUTO/MANUAL share every step except step 4.
  AWS_TARGET_CONFIRM: AWS_STEP_1_HTML,
  AWS_APPROVAL_PENDING: STEP_2_HTML,
  AWS_APPLYING: STEP_3_HTML,
  AWS_AUTO_INSTALLING: AWS_AUTO_INSTALLING_HTML,
  AWS_MANUAL_INSTALLING: AWS_MANUAL_INSTALLING_HTML,
  AWS_CONNECTION_TEST: STEP_5_CLOUD_HTML,
  AWS_ADMIN_APPROVAL: STEP_6_HTML,
  AWS_COMPLETED: STEP_7_HTML,
  // AZURE (7)
  AZURE_TARGET_CONFIRM: AZURE_STEP_1_HTML,
  AZURE_APPROVAL_PENDING: STEP_2_HTML,
  AZURE_APPLYING: STEP_3_HTML,
  AZURE_INSTALLING: AZURE_INSTALLING_HTML,
  AZURE_CONNECTION_TEST: STEP_5_CLOUD_HTML,
  AZURE_ADMIN_APPROVAL: STEP_6_HTML,
  AZURE_COMPLETED: STEP_7_HTML,
  // GCP (7)
  GCP_TARGET_CONFIRM: GCP_STEP_1_HTML,
  GCP_APPROVAL_PENDING: STEP_2_HTML,
  GCP_APPLYING: STEP_3_HTML,
  GCP_INSTALLING: GCP_INSTALLING_HTML,
  GCP_CONNECTION_TEST: STEP_5_CLOUD_HTML,
  GCP_ADMIN_APPROVAL: STEP_6_HTML,
  GCP_COMPLETED: STEP_7_HTML,
  // IDC (7) — manual input at step 1, BDC install + firewall at step 4.
  IDC_TARGET_INPUT: IDC_TARGET_INPUT_HTML,
  IDC_APPROVAL_PENDING: STEP_2_HTML,
  IDC_APPLYING: STEP_3_HTML,
  IDC_INSTALLING: IDC_INSTALLING_HTML,
  IDC_CONNECTION_TEST: STEP_5_IDC_HTML,
  IDC_CONNECTION_VERIFIED: STEP_6_HTML,
  IDC_COMPLETE: STEP_7_HTML,
};
