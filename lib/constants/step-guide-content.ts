/**
 * Step guide content — hardcoded; the end-user guide rail renders these
 * strings directly (no CMS fetch).
 *
 * ⛔ SOURCE OF TRUTH is the owner's transcription of the live 연동 가이드 screens
 * (`compare-step1~7.html`), read 2026-08-23 and published as 「PII Agent 연동
 * 가이드 레일 문안」. Every sentence below is that document's wording. This file
 * is a transcription target, not an editorial one: where a sentence reads
 * oddly, the fix belongs upstream in the source screens.
 *
 * The transcription reverses four things this file used to state as house
 * rules, so they are gone rather than reconciled:
 * - Escalation goes to the 협업 채널 card at the top of this rail, not to 담당자.
 * - Durations read 「N일 … (주말·공휴일 제외)」, never 「N영업일」.
 * - Step 2 names the control 「다시 요청하기」 — what `WaitingApprovalCancelButton`
 *   renders, in the card header, in the PENDING sub-state this guide describes.
 *   The name it carried before, 「연동 대상 다시 선택하기」, belongs to a different
 *   control in a different place: `WaitingApprovalReselectButton`, in the verdict
 *   block at the card's foot, and only once the request has been REJECTED (the
 *   pending card deliberately renders no corner button then). That is what made
 *   the old copy's ⚠️ OPEN question a real defect rather than a wording quibble,
 *   and it is why 「연동 대상 다시 선택하기」 must not be restored here.
 * - No step tells the reader to refresh. These pages still do not poll; the
 *   instruction is dropped on the owner's authority, not by oversight.
 *
 * ## The source's shapes, and the tag each one is written with
 *
 * The guide is not prose with a few bold runs — the source draws a small visual
 * grammar, and flattening it into bullets (which the first pass did) loses the
 * screen even when every sentence survives. The renderer styles by TAG
 * (`render-guide-ast.tsx` → `guideStyles`), so the markup here stays plain HTML:
 *
 * | source            | written as                        | renders as |
 * |-------------------|-----------------------------------|------------|
 * | `.callout`        | `<blockquote>`                    | 안내 박스 |
 * | `.accordion`      | `<details><summary>…</summary>`   | 참고 가이드 바 (accent fill, ▶) |
 * | `.tag`/`.path__pill` | `<mark>`                       | 작업 이름표 pill |
 * | `.extlinks li`    | `<em>… ↗</em>`                    | accent text with the ↗ the source appends |
 * | `.s-title`        | `<strong>` opening an `<li>`      | 600-weight step title |
 *
 * Two source shapes are deliberately NOT ported, because they need width this
 * panel does not have (320px against the source's 64ch):
 * - `.branch__grid` — two branch cards side by side with 「또는」 between them.
 *   Each slot here carries one branch already, so there is no pair to place.
 * - `.path` — the card drawn around a branch. With one branch per slot it would
 *   be a box around the whole body.
 *
 * `<hr>` is dropped too; the numbered list after it already separates.
 *
 * Markup must satisfy `validateGuideHtml` under `GUIDE_VALIDATE_OPTIONS` —
 * asserted by `__tests__/step-guide-content.test.ts`.
 */

import type { GuideName } from '@/lib/types/guide';

/** 참고 가이드 바 — the source's `.accordion`, which carries a label and no body. */
const refBar = (label: string): string => `<details><summary>${label}</summary></details>`;

/** An `.extlinks` row. The ↗ is the source's, appended by CSS there and by hand here. */
const extLink = (label: string): string => `<li><em>${label} ↗</em></li>`;

// ---------------------------------------------------------------------------
// Step 1 — target selection
// ---------------------------------------------------------------------------

/**
 * AWS, AWS China and Azure share one body; GCP is the same minus the VM row.
 * GCP has no VM integration (docs/cloud-provider-states.md) and the source
 * card drops that bullet for exactly that reason.
 *
 * ⛔ The only body with no <h4>. It used to open with 「연동 대상 DB 선택」, on the reasoning
 * that the panel header only ever said 「가이드」 so the step name had to be carried here.
 * That premise expired: `GuidePanel` prints 「N단계 가이드」 (오너 지시 2026-08-23), and the
 * card head beside it prints the step's name at 20px. The heading was that string's third
 * copy, two lines under the second. Every other body opens with a sentence about what is
 * happening rather than with the step's name, so this one had nothing left to say.
 */
const step1Cloud = ({ vmRows }: { vmRows: boolean }): string =>
  '<ol>' +
  // 오너 지시 2026-08-24: name BOTH buttons. The source says 「'스캔 시작'을 눌러」, but the
  // strip renders 「스캔 시작」 only before the first scan and 「다시 스캔」 ever after
  // (`ScanStrip.tsx`), so a returning reader is told to press something that is no longer
  // on their screen. This is the one place the copy leaves the source, and on purpose.
  "<li><strong>'스캔 시작' 또는 '다시 스캔'을 눌러 인프라 스캔을 진행해주세요.</strong>" +
  refBar('Infra Scan 권한 설정 가이드(스캔 불가 시 수행)') +
  '</li>' +
  '<li><strong>스캔된 DB 중 연동이 불필요한 DB는 제외해주세요. (PRD DB만 제출해주세요)</strong>' +
  '<ul>' +
  // The reason list is nested UNDER the checkbox instruction, as in the source — it
  // enumerates what to put in that field, so as a sibling it reads as a separate step.
  '<li>체크박스 해제 후 연동 비대상 사유를 입력해주세요.' +
  '<ul><li>Dev DB / Stg DB / Temp DB / 타 시스템 사용 DB / 기타 (직접 입력)</li></ul></li>' +
  (vmRows
    ? '<li>VM에서 운영 중인 DB는 인프라 스캔을 지원하지 않아요. ' +
      "<strong>'VM DB 등록'</strong>을 통해 연동 대상 DB를 직접 등록해주세요.</li>"
    : '') +
  '</ul></li>' +
  "<li><strong>연동 대상 DB 선택을 완료하였다면 '연동 대상 승인 요청'을 통해 제출해주세요.</strong></li>" +
  '</ol>';

const IDC_TARGET_INPUT_HTML =
  '<h4>연동 대상 DB의 접속 정보를 입력해주세요.</h4>' +
  "<blockquote>이전에 요청한 적이 있다면 '기존 연동 요청 정보 불러오기'를 통해 " +
  '입력값을 불러올 수 있어요.</blockquote>' +
  '<ol>' +
  "<li><strong>'+ 연동 대상 추가' 클릭</strong></li>" +
  '<li><strong>DB 접속 정보 타입 선택(IP, Domain)</strong>' +
  '<ul>' +
  '<li><strong>Domain</strong>: DB endpoint link (CX망에 위치한 Cloud DB만 연동 가능)</li>' +
  "<li>Cluster로 구성되어 있다면 <strong>'IP 추가'</strong>를 통해 IP 정보를 추가 입력할 수 있어요.</li>" +
  '</ul></li>' +
  '<li><strong>DB Type 및 Port 정보 입력</strong>' +
  '<ul><li>Oracle/Tibero의 경우, DB 접근을 위한 SID(Service ID)를 함께 입력해주세요.</li></ul></li>' +
  '<li><strong>입력한 DB 중 dev/stg/임시 DB가 있다면, 체크박스를 해제하여 연동 대상에서 ' +
  '제외해주세요.</strong></li>' +
  "<li><strong>연동 대상 DB 선택을 완료하였다면 '연동 대상 승인 요청'을 통해 제출해주세요.</strong></li>" +
  '</ol>';

// ---------------------------------------------------------------------------
// Step 2 — approval pending (shared)
// ---------------------------------------------------------------------------

const STEP_2_HTML =
  '<h4>PII Agent 담당자의 검토를 기다리고 있어요.</h4>' +
  '<p>제출하신 DB 연동 대상 목록을 담당자가 순차적으로 검토하고 있어요. ' +
  '검토 후 이슈 없을 경우, 다음 단계로 넘어가요.</p>' +
  "<blockquote>연동 대상 DB가 잘못 제출된 상태라면 우측 상단 <strong>'다시 요청하기'</strong>를 눌러 " +
  '1단계로 돌아가 재입력 후 다시 제출할 수 있어요.</blockquote>' +
  '<ul>' +
  '<li>평균 1일 이내 검토가 완료됩니다. (주말·공휴일 제외)</li>' +
  '<li>2일 이상 지연 시 <strong>협업 채널</strong>을 통해 문의를 남겨주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 3 — applying (shared)
// ---------------------------------------------------------------------------

const STEP_3_HTML =
  '<h4>담당자가 연동을 위한 환경을 구성하고 있어요.</h4>' +
  '<p>연동할 준비가 완료되면 다음 단계로 넘어가요.</p>' +
  '<blockquote>최초 연동이 아닌 재연동인 경우, 시스템 담당자의 조치가 필요할 수도 있어요' +
  '(이전에 설치된 PII Agent 리소스 삭제 필요). 조치가 필요한 경우 담당자가 개별 연락드릴 예정입니다.</blockquote>' +
  '<ul>' +
  '<li>최초 연동일 경우, 평균 10분 이내 완료됩니다.</li>' +
  '<li>재연동일 경우, 평균 1일 소요됩니다. (주말·공휴일 제외)</li>' +
  '<li>2일 이상 지연 시 <strong>협업 채널</strong>을 통해 문의를 남겨주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 4 — install (per provider)
// ---------------------------------------------------------------------------

const AWS_INSTALL_HEAD =
  '<h4>선택하신 설치 방식에 따라 진행해야 할 작업이 달라요.</h4>' +
  '<blockquote>설치 방식(자동 설치/수동 설치) 전환이 필요하다면, ' +
  '상단 Jira 티켓 내 코멘트를 통해 변경을 요청해주세요.</blockquote>';

/**
 * The bullets the source prints BELOW the branch grid — they belong to both branches,
 * and they are items rather than a list so each branch can close its own list with them.
 * Two adjacent `<ul>`s would render as one list anyway, with a seam only the markup knows.
 */
const AWS_INSTALL_TAIL_ITEMS =
  '<li>BDC 측 리소스 생성까지 평균 2일 소요됩니다. (주말·공휴일 제외)</li>' +
  '<li>3일 이상 지연 시 <strong>협업 채널</strong>을 통해 문의를 남겨주세요.</li>' +
  '<li>별도 조치가 필요한 경우, 담당자가 개별 연락드릴 예정입니다.</li>' +
  '<li>Agent 설치가 완료되면 다음 단계로 넘어가요.</li>';

const AWS_AUTO_INSTALLING_HTML =
  AWS_INSTALL_HEAD +
  '<p><mark>자동 설치</mark><br />가이드를 참고하여 Terraform 실행 권한을 부여해주세요.</p>' +
  '<p>Terraform 실행 권한 부여(IAM Role 생성)</p>' +
  refBar('실행 권한 부여 가이드') +
  `<ul>${AWS_INSTALL_TAIL_ITEMS}</ul>` +
  refBar('이 단계에서 어떤 작업이 진행되나요');

const AWS_MANUAL_INSTALLING_HTML =
  AWS_INSTALL_HEAD +
  '<p><mark>수동 설치</mark><br />가이드를 참고하여 Terraform을 직접 실행해주세요.</p>' +
  '<p>서비스 계정 리소스 생성(첨부된 Terraform을 통해 리소스 생성)</p>' +
  '<ul><li>아래 가이드를 참고하여 직접 script를 실행해주세요.</li></ul>' +
  refBar('Terraform Script 실행 가이드') +
  `<ul>${AWS_INSTALL_TAIL_ITEMS}</ul>` +
  refBar('이 단계에서 어떤 작업이 진행되나요');

const AZURE_INSTALLING_HTML =
  '<h4>VM DB 연동 여부에 따라 필요한 설치 작업이 달라집니다.</h4>' +
  '<p>VM DB를 사용하는 경우, Private Networking에 필요한 리소스(Subnet, NSG 등) 생성을 위해 ' +
  '아래 절차를 수행해주셔야 해요.</p>' +
  '<blockquote>VM DB가 없는 경우, 이 절차는 Skip됩니다.</blockquote>' +
  refBar('VM Subnet 생성을 위한 권한 부여 설정') +
  '<p><mark>Private Endpoint 승인</mark><br />Azure Portal에서 BDC가 요청한 ' +
  'Private Endpoint 연결 요청을 승인해주시는 단계입니다.</p>' +
  refBar('Private Endpoint 승인 가이드');

const GCP_INSTALLING_HTML =
  '<h4>DB Type에 따라 필요한 설치 작업이 달라집니다.</h4>' +
  // 오너 지시 2026-08-24: drop the 「BDC Side Terraform」 block and the 「Service Side
  // Terraform 실행 가이드」 bar. The count moves with the list — a sentence that counts the
  // blocks below it goes wrong the moment one is removed, and 3 is now visibly two.
  '<p>아래 2가지 작업 중 일부만 필요하거나, 전혀 필요하지 않을 수 있어요.</p>' +
  '<p><mark>Service Side Subnet 생성</mark><br />상대측 GCP Project에 ' +
  'Regional Managed Proxy Subnet이 존재하는지 확인하는 작업입니다.</p>' +
  '<p><mark>Service Side Terraform</mark><br />상대측 GCP Project에 PSC 및 관련 리소스를 ' +
  '생성(BIGQUERY의 경우 IAM 권한 부여)하는 작업입니다.</p>' +
  '<blockquote><strong>PSC 연동(PRIVATE_IP_MODE · PSC_MODE)의 경우</strong>, 이 단계에서 상대측 ' +
  'Service Attachment의 <code>consumerAcceptLists</code>에 BDC 프로젝트를 미리 등록해두면 ' +
  '승인 절차 없이 자동으로 연결돼요. 등록되어 있지 않으면 상대측 담당자의 수동 승인이 한 번 더 필요해요.' +
  '</blockquote>';
// 오너 지시 2026-08-24 (2차): the second 안내 박스 leaves with the block it belonged to.
// It opened on the same clause as the box above and said 「연결 상태가 Pending이면 상대측
// 담당자의 승인이 필요해요」 — but the BDC-side block removed earlier was the only place
// this guide introduced a PSC Connection, so nothing left here has a 연결 상태 to read.
// Its parenthetical then pointed at 「Service Side Terraform 단계의 consumerAcceptLists」,
// a detail that lives in the box directly above it. Both facts it carried already sit
// there: register in advance and it connects itself, otherwise the far side approves by
// hand. What it alone added — Pending as the observable signal — cannot be restored
// without reintroducing the connection the owner removed.

/**
 * ⚠️ 「Source IP」 is the source document's word for the far end of the firewall
 * rule. This app's own name for it is `IDC_SOURCE_LABEL` ('BDC측 출발지'), which
 * the IDC tables and the step-5 empty state still use. The split is the owner's
 * copy, not a slip — do not silently rename either side.
 */
const IDC_INSTALLING_HTML =
  '<h4>DB 접근을 위한 리소스 생성을 BDC 측에서 진행 후 방화벽 등록 여부를 확인하는 단계입니다.</h4>' +
  '<p>BDC 측 수집 모듈이 설치되는 동안, 서비스 측에서는 Source IP → 연동 대상(IP:Port) ' +
  '방화벽을 열어주셔야 해요.</p>' +
  '<ul>' +
  '<li>BDC 리소스 생성 완료 후 방화벽 등록 여부를 점검할 수 있어요.</li>' +
  '<li>it4u 외 별도 방화벽 등록 절차가 있다면, 해당 절차도 수행해주세요.' +
  '<ul><li>SDS에서 운영하는 DB인 경우, DC Manager를 통해 접근 허용 등</li></ul></li>' +
  '</ul>' +
  '<blockquote>방화벽 등록까지 완료되면 다음 단계로 넘어가요.</blockquote>';

// ---------------------------------------------------------------------------
// Step 5 — connection test (shared)
// ---------------------------------------------------------------------------

/**
 * One body for cloud and IDC alike. The source prints a single 공통 card here;
 * the two separate constants this file used to carry are collapsed because the
 * copy no longer says anything provider-specific.
 */
const STEP_5_HTML =
  '<h4>DB에 접근하기 위한 DB Credential을 직접 등록해주시고 DB 별로 정상 접근이 가능한지 ' +
  '확인하는 단계입니다.</h4>' +
  '<ol>' +
  '<li><strong>DB Credential 등록</strong>' +
  '<ul>' +
  '<li>가이드를 참고하여 DB user 생성 및 권한 부여 후 DB Credential 등록을 진행해주세요.</li>' +
  extLink('DB Type별 user 생성 가이드') +
  extLink('DB Credential 등록 페이지') +
  '</ul>' +
  refBar('DB Credential 등록 페이지 가이드') +
  '</li>' +
  '<li><strong>DB별 Credential Key 입력</strong>' +
  '<ul>' +
  '<li>좌측 DB Credential 필드에서 등록해주신 DB credential을 선택해주세요.</li>' +
  '<li>등록해주신 DB Account Name으로 표시됩니다.</li>' +
  '</ul></li>' +
  '<li><strong>연결 테스트 진행</strong>' +
  '<ul>' +
  '<li>입력/선택해주신 Key로 DB 접근이 정상적으로 이뤄지는지 확인해요.</li>' +
  '<li>Connection Status를 통해 성공/실패 여부를 확인할 수 있어요.</li>' +
  '</ul></li>' +
  '<li><strong>논리 DB 연동 설정</strong>' +
  '<ul>' +
  "<li>Connection Status가 Success인 경우, <strong>'연동 논리 DB'</strong> 열의 건수를 눌러 " +
  '연동이 불필요한 논리 DB를 제외할 수 있어요.</li>' +
  '<li>제외 가능한 DB는 다음과 같아요.' +
  '<ul><li>DEV DB, STG DB, Temp DB, 타 시스템 사용 DB</li></ul></li>' +
  "<li>논리 DB 설정을 변경하셨다면 <strong>'다시 실행'</strong>으로 연결 테스트를 재수행한 후 " +
  "<strong>'승인 요청'</strong>을 진행할 수 있어요.</li>" +
  '</ul></li>' +
  '</ol>';

// ---------------------------------------------------------------------------
// Step 6 — final admin approval (shared)
// ---------------------------------------------------------------------------

const STEP_6_HTML =
  '<h4>PII Agent를 통해 meta/sample data가 정상 수집되는지 담당자가 확인하고 있어요.</h4>' +
  "<p>정상 수집 여부가 확인되면 <strong>'완료'</strong> 단계로 넘어가요.</p>" +
  '<blockquote>별도 조치가 필요한 경우 담당자가 개별 연락드릴 예정입니다.</blockquote>' +
  '<ul>' +
  '<li>평균 1일 소요되는 과정입니다. (주말·공휴일 제외)</li>' +
  '<li>수집해야 할 데이터가 클 경우, 더 오래 소요될 수 있어요.</li>' +
  '<li>3일 이상 지연 시 <strong>협업 채널</strong>을 통해 문의를 남겨주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 7 — complete (shared)
// ---------------------------------------------------------------------------

const STEP_7_HTML =
  '<h4>PII Agent 연동이 완료되었어요.</h4>' +
  '<p>현재 페이지에서 PII 모니터링 연동 상태를 조회할 수 있어요.</p>' +
  '<ul>' +
  '<li><strong>Healthy</strong>: 정상 동작 중</li>' +
  '<li><strong>Unhealthy</strong>: 3일 이상 meta/sample data 수집 실패' +
  '<ul><li>운영 중인 DB라면 재연동 조치가 필요해요.</li></ul></li>' +
  '</ul>' +
  '<ol>' +
  '<li><strong>DB Credential Key가 변경된 경우</strong>' +
  '<ul>' +
  "<li>DB Credential Key를 변경해야 하는 경우, <strong>'연결 테스트 재실행'</strong> 버튼을 통해 " +
  "<strong>'연결 테스트'</strong> 단계로 돌아가 재등록할 수 있어요.</li>" +
  "<li>등록된 Key의 Password가 변경된 경우, <strong>'DB Credential'</strong>에서 등록된 Key 값을 " +
  '업데이트해주세요.</li>' +
  extLink('DB Credential 페이지') +
  '</ul></li>' +
  '<li><strong>Agent가 설치된 DB 내 논리 DB 연동 추가/삭제가 필요한 경우</strong>' +
  '<ul>' +
  "<li><strong>'연결 테스트 재실행'</strong>을 통해 <strong>'연결 테스트'</strong> 단계로 돌아가 " +
  '논리 DB를 재설정할 수 있어요.</li>' +
  '<li>연동 후 생성된 논리 DB가 있다면 이 절차를 통해 재연동해주세요.</li>' +
  '</ul></li>' +
  '<li><strong>연동 후 추가/삭제된 DB가 있는 경우</strong>' +
  '<ul>' +
  "<li><strong>'인프라 변경'</strong>을 통해 <strong>'연동 대상 DB 선택'</strong> 단계로 돌아가 " +
  '인프라 스캔부터 다시 수행해주세요.</li>' +
  '<li>기 설치된 Agent 리소스를 삭제 후 재연동하는 절차가 필요하며, Agent 설치 절차를 ' +
  '다시 수행해주셔야 해요.</li>' +
  '</ul></li>' +
  '</ol>' +
  '<blockquote>BDC 인프라의 이슈로 연동 상태가 Unhealthy로 변경될 수 있어요. 담당하시는 시스템의 ' +
  'DB 또는 Credential Key의 변동사항이 없다면 걸림 사유 원인은 <strong>협업 채널</strong>을 통해 ' +
  '문의를 남겨주세요.</blockquote>';

// ---------------------------------------------------------------------------
// Assembly — one entry per GuideName
// ---------------------------------------------------------------------------

const CLOUD_STEP_1_HTML = step1Cloud({ vmRows: true });
const GCP_STEP_1_HTML = step1Cloud({ vmRows: false });

export const STEP_GUIDE_HTML: Record<GuideName, string> = {
  // AWS (8) — AUTO/MANUAL share every step except step 4.
  AWS_TARGET_CONFIRM: CLOUD_STEP_1_HTML,
  AWS_APPROVAL_PENDING: STEP_2_HTML,
  AWS_APPLYING: STEP_3_HTML,
  AWS_AUTO_INSTALLING: AWS_AUTO_INSTALLING_HTML,
  AWS_MANUAL_INSTALLING: AWS_MANUAL_INSTALLING_HTML,
  AWS_CONNECTION_TEST: STEP_5_HTML,
  AWS_ADMIN_APPROVAL: STEP_6_HTML,
  AWS_COMPLETED: STEP_7_HTML,
  // AZURE (7)
  AZURE_TARGET_CONFIRM: CLOUD_STEP_1_HTML,
  AZURE_APPROVAL_PENDING: STEP_2_HTML,
  AZURE_APPLYING: STEP_3_HTML,
  AZURE_INSTALLING: AZURE_INSTALLING_HTML,
  AZURE_CONNECTION_TEST: STEP_5_HTML,
  AZURE_ADMIN_APPROVAL: STEP_6_HTML,
  AZURE_COMPLETED: STEP_7_HTML,
  // GCP (7)
  GCP_TARGET_CONFIRM: GCP_STEP_1_HTML,
  GCP_APPROVAL_PENDING: STEP_2_HTML,
  GCP_APPLYING: STEP_3_HTML,
  GCP_INSTALLING: GCP_INSTALLING_HTML,
  GCP_CONNECTION_TEST: STEP_5_HTML,
  GCP_ADMIN_APPROVAL: STEP_6_HTML,
  GCP_COMPLETED: STEP_7_HTML,
  // IDC (7) — manual input at step 1, BDC install + firewall at step 4.
  IDC_TARGET_INPUT: IDC_TARGET_INPUT_HTML,
  IDC_APPROVAL_PENDING: STEP_2_HTML,
  IDC_APPLYING: STEP_3_HTML,
  IDC_INSTALLING: IDC_INSTALLING_HTML,
  IDC_CONNECTION_TEST: STEP_5_HTML,
  IDC_CONNECTION_VERIFIED: STEP_6_HTML,
  IDC_COMPLETE: STEP_7_HTML,
};
