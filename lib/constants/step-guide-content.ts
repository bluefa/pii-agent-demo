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
 *
 * ## The English twin
 *
 * Every body below is authored twice: the Korean transcription, and an `…_EN`
 * constant beside it. The English is a TRANSLATION of the Korean, never an
 * edit of it — the Korean stays the owner's verbatim transcription, so a
 * sentence that reads oddly is fixed upstream in the source screens and then
 * re-translated here, not rewritten on this side.
 *
 * Two rules the translations follow:
 * - The markup is identical. The renderer styles by TAG, so a `<mark>` that
 *   comes out as plain text in English loses the pill, not just a word.
 * - Every app control the guide names is spelled with that control's OWN
 *   English label, taken from the locale dictionaries (`lib/copy.ts`,
 *   `app/components/features/{scan,process-status}/…`, and the per-area
 *   `copy.ts` files under `app/target-sources/[targetSourceId]/_components/`).
 *   A guide that calls a button something the button does not say is worse
 *   than an untranslated guide.
 */

import { SDU_DB_TYPE_MAX, SDU_DB_TYPE_MAXLEN } from '@/lib/types/sdu';

import type { GuideName } from '@/lib/types/guide';
import type { Locale } from '@/lib/locale';

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

/**
 * ⚠️ 「VM DB 등록」 is the source document's name for the control, and no screen in this app
 * draws it: AWS step 1 offers 「EC2 추가」 / 'Add EC2' (`CANDIDATE_COPY.candidate.guideEc2Emphasis`).
 * The English keeps the source's name rather than silently repointing the sentence — the
 * mismatch is upstream's to settle, and settling it here would hide it.
 */
const step1CloudEn = ({ vmRows }: { vmRows: boolean }): string =>
  '<ol>' +
  "<li><strong>Press 'Start scan' or 'Rescan' to run the infrastructure scan.</strong>" +
  refBar('Infra Scan permission setup guide (do this when the scan cannot run)') +
  '</li>' +
  '<li><strong>Exclude any scanned DB you do not need to integrate. (Submit PRD DBs only)</strong>' +
  '<ul>' +
  '<li>Clear the checkbox, then enter an exclusion reason.' +
  '<ul><li>Dev DB / Stg DB / Temp DB / DB used by another system / Other (type it in)</li></ul></li>' +
  (vmRows
    ? '<li>The infrastructure scan does not cover a DB running on a VM. Register those target DBs ' +
      "yourself with <strong>'Register VM DB'</strong>.</li>"
    : '') +
  '</ul></li>' +
  "<li><strong>Once you have chosen the target DBs, submit them with 'Request target approval'.</strong></li>" +
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

const IDC_TARGET_INPUT_HTML_EN =
  '<h4>Enter the connection details of the DBs you want to integrate.</h4>' +
  "<blockquote>If you have made a request before, 'Load a previous request' brings those values " +
  'back.</blockquote>' +
  '<ol>' +
  "<li><strong>Click '+ Add integration target'</strong></li>" +
  '<li><strong>Choose the DB connection type (IP, Domain)</strong>' +
  '<ul>' +
  '<li><strong>Domain</strong>: DB endpoint link (only a Cloud DB on the CX network can be integrated)</li>' +
  "<li>If the DB is a cluster, <strong>'Add IP'</strong> lets you enter more IP addresses.</li>" +
  '</ul></li>' +
  '<li><strong>Enter the DB Type and Port</strong>' +
  '<ul><li>For Oracle/Tibero, also enter the SID (Service ID) used to reach the DB.</li></ul></li>' +
  '<li><strong>If any DB you entered is a dev/stg/temporary DB, clear its checkbox to leave it out ' +
  'of the integration.</strong></li>' +
  "<li><strong>Once you have chosen the target DBs, submit them with 'Request target approval'.</strong></li>" +
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

/**
 * 「(주말·공휴일 제외)」 comes out as '(weekends and holidays excluded)' rather than the
 * longer 'public holidays': that is the phrase the card beside this rail already prints
 * (`LAYOUT_COPY.applying.eta`), and one screen gets one wording for one fact.
 */
const STEP_2_HTML_EN =
  '<h4>The PII Agent owner is reviewing your request.</h4>' +
  '<p>The owner is going through the list of target DBs you submitted, one at a time. ' +
  'If the review turns up no issues, you move to the next step.</p>' +
  "<blockquote>If the wrong target DBs were submitted, press <strong>'Try again'</strong> at the " +
  'top right to go back to Step 1, re-enter them and submit again.</blockquote>' +
  '<ul>' +
  '<li>A review is done within a day on average. (weekends and holidays excluded)</li>' +
  '<li>If it is delayed more than 2 days, leave a question in the <strong>Collab channel</strong>.</li>' +
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

const STEP_3_HTML_EN =
  '<h4>The owner is setting up the environment for the integration.</h4>' +
  '<p>Once everything is ready to connect, you move to the next step.</p>' +
  '<blockquote>If this is a re-integration rather than a first integration, the system owner may ' +
  'have to act (the PII Agent resources installed earlier have to be deleted). The owner will ' +
  'contact you directly if anything is needed.</blockquote>' +
  '<ul>' +
  '<li>A first integration is done within 10 minutes on average.</li>' +
  '<li>A re-integration takes a day on average. (weekends and holidays excluded)</li>' +
  '<li>If it is delayed more than 2 days, leave a question in the <strong>Collab channel</strong>.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Step 4 — install (per provider)
// ---------------------------------------------------------------------------

const AWS_INSTALL_HEAD =
  '<h4>선택하신 설치 방식에 따라 진행해야 할 작업이 달라요.</h4>' +
  '<blockquote>설치 방식(자동 설치/수동 설치) 전환이 필요하다면, ' +
  '상단 Jira 티켓 내 코멘트를 통해 변경을 요청해주세요.</blockquote>';

const AWS_INSTALL_HEAD_EN =
  '<h4>What you have to do depends on the install method you chose.</h4>' +
  '<blockquote>To switch the install method (Automatic install / Manual install), ask for the ' +
  'change in a comment on the Jira ticket at the top.</blockquote>';

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

const AWS_INSTALL_TAIL_ITEMS_EN =
  '<li>Creating the resources on the BDC side takes 2 days on average. (weekends and holidays excluded)</li>' +
  '<li>If it is delayed more than 3 days, leave a question in the <strong>Collab channel</strong>.</li>' +
  '<li>If anything else is needed, the owner will contact you directly.</li>' +
  '<li>Once the Agent install is finished, you move to the next step.</li>';

const AWS_AUTO_INSTALLING_HTML =
  AWS_INSTALL_HEAD +
  '<p><mark>자동 설치</mark><br />가이드를 참고하여 Terraform 실행 권한을 부여해주세요.</p>' +
  '<p>Terraform 실행 권한 부여(IAM Role 생성)</p>' +
  refBar('실행 권한 부여 가이드') +
  `<ul>${AWS_INSTALL_TAIL_ITEMS}</ul>` +
  refBar('이 단계에서 어떤 작업이 진행되나요');

const AWS_AUTO_INSTALLING_HTML_EN =
  AWS_INSTALL_HEAD_EN +
  '<p><mark>Automatic install</mark><br />Follow the guide and grant Terraform execution ' +
  'permission.</p>' +
  '<p>Granting Terraform execution permission (creating an IAM Role)</p>' +
  refBar('Execution permission guide') +
  `<ul>${AWS_INSTALL_TAIL_ITEMS_EN}</ul>` +
  refBar('What happens at this step');

const AWS_MANUAL_INSTALLING_HTML =
  AWS_INSTALL_HEAD +
  '<p><mark>수동 설치</mark><br />가이드를 참고하여 Terraform을 직접 실행해주세요.</p>' +
  '<p>서비스 계정 리소스 생성(첨부된 Terraform을 통해 리소스 생성)</p>' +
  '<ul><li>아래 가이드를 참고하여 직접 script를 실행해주세요.</li></ul>' +
  refBar('Terraform Script 실행 가이드') +
  `<ul>${AWS_INSTALL_TAIL_ITEMS}</ul>` +
  refBar('이 단계에서 어떤 작업이 진행되나요');

const AWS_MANUAL_INSTALLING_HTML_EN =
  AWS_INSTALL_HEAD_EN +
  '<p><mark>Manual install</mark><br />Follow the guide and run Terraform yourself.</p>' +
  '<p>Creating the service account resources (creating them with the attached Terraform)</p>' +
  '<ul><li>Follow the guide below and run the script yourself.</li></ul>' +
  refBar('Terraform Script run guide') +
  `<ul>${AWS_INSTALL_TAIL_ITEMS_EN}</ul>` +
  refBar('What happens at this step');

const AZURE_INSTALLING_HTML =
  '<h4>VM DB 연동 여부에 따라 필요한 설치 작업이 달라집니다.</h4>' +
  '<p>VM DB를 사용하는 경우, Private Networking에 필요한 리소스(Subnet, NSG 등) 생성을 위해 ' +
  '아래 절차를 수행해주셔야 해요.</p>' +
  '<blockquote>VM DB가 없는 경우, 이 절차는 Skip됩니다.</blockquote>' +
  refBar('VM Subnet 생성을 위한 권한 부여 설정') +
  '<p><mark>Private Endpoint 승인</mark><br />Azure Portal에서 BDC가 요청한 ' +
  'Private Endpoint 연결 요청을 승인해주시는 단계입니다.</p>' +
  refBar('Private Endpoint 승인 가이드');

const AZURE_INSTALLING_HTML_EN =
  '<h4>Which install work is needed depends on whether you integrate a VM DB.</h4>' +
  '<p>If you use a VM DB, run the steps below so the resources Private Networking needs ' +
  '(Subnet, NSG and so on) can be created.</p>' +
  '<blockquote>If there is no VM DB, this is skipped.</blockquote>' +
  refBar('Permission setup for creating the VM Subnet') +
  '<p><mark>Private Endpoint approval</mark><br />At this step you approve the Private Endpoint ' +
  'connection request BDC made, in the Azure Portal.</p>' +
  refBar('Private Endpoint approval guide');

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

const GCP_INSTALLING_HTML_EN =
  '<h4>Which install work is needed depends on the DB Type.</h4>' +
  '<p>You may need only some of the 2 tasks below, or none of them.</p>' +
  '<p><mark>Service Side Subnet creation</mark><br />This checks whether the GCP Project on the ' +
  'other side has a Regional Managed Proxy Subnet.</p>' +
  '<p><mark>Service Side Terraform</mark><br />This creates PSC and its related resources in the ' +
  'GCP Project on the other side (for BIGQUERY, it grants IAM permissions).</p>' +
  '<blockquote><strong>For a PSC integration (PRIVATE_IP_MODE · PSC_MODE)</strong>, register the ' +
  'BDC project in the <code>consumerAcceptLists</code> of the Service Attachment on the other ' +
  'side at this step and it connects automatically, with no approval. If it is not registered, ' +
  'the owner on the other side has to approve it once by hand.</blockquote>';

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

/** 「Source IP」 stays the source document's word here too — see the note on the Korean above. */
const IDC_INSTALLING_HTML_EN =
  '<h4>At this step BDC creates the resources that reach the DB, and then the firewall ' +
  'registration is checked.</h4>' +
  '<p>While the collection module is being installed on the BDC side, your side has to open the ' +
  'firewall for Source IP → integration target (IP:Port).</p>' +
  '<ul>' +
  '<li>Once the BDC resources are created, the firewall registration can be checked.</li>' +
  '<li>If you have a firewall registration process other than it4u, run that one too.' +
  '<ul><li>For a DB operated by SDS, allow access through DC Manager, for example</li></ul></li>' +
  '</ul>' +
  '<blockquote>Once the firewall registration is done too, you move to the next step.</blockquote>';

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

const STEP_5_HTML_EN =
  '<h4>At this step you register the DB Credential used to access each DB yourself, and check ' +
  'that every DB can be reached.</h4>' +
  '<ol>' +
  '<li><strong>Register a DB Credential</strong>' +
  '<ul>' +
  '<li>Follow the guide to create the DB user and grant its permissions, then register the DB ' +
  'Credential.</li>' +
  extLink('Guide to creating a user per DB Type') +
  extLink('DB Credential registration page') +
  '</ul>' +
  refBar('Guide to the DB Credential registration page') +
  '</li>' +
  '<li><strong>Assign a Credential Key per DB</strong>' +
  '<ul>' +
  '<li>In the DB Credential field on the left, pick the DB credential you registered.</li>' +
  '<li>It is shown as the DB Account Name you registered.</li>' +
  '</ul></li>' +
  '<li><strong>Run the connection test</strong>' +
  '<ul>' +
  '<li>This checks that the DB can be reached with the Key you entered or picked.</li>' +
  '<li>Connection Status tells you whether it succeeded or failed.</li>' +
  '</ul></li>' +
  '<li><strong>Set up the Logical DB integration</strong>' +
  '<ul>' +
  "<li>When Connection Status is Success, press the count in the <strong>'Logical DB'</strong> " +
  'column to exclude any Logical DB you do not need to integrate.</li>' +
  '<li>These are the DBs you can exclude.' +
  '<ul><li>DEV DB, STG DB, Temp DB, DB used by another system</li></ul></li>' +
  "<li>If you changed the Logical DB settings, run the connection test again with <strong>'Run " +
  "again'</strong> before you go on to <strong>'Request approval'</strong>.</li>" +
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

const STEP_6_HTML_EN =
  '<h4>The owner is checking that PII Agent collects meta/sample data correctly.</h4>' +
  "<p>Once that is confirmed, you move to the <strong>'Complete'</strong> step.</p>" +
  '<blockquote>If anything else is needed, the owner will contact you directly.</blockquote>' +
  '<ul>' +
  '<li>This takes a day on average. (weekends and holidays excluded)</li>' +
  '<li>If there is a lot of data to collect, it can take longer.</li>' +
  '<li>If it is delayed more than 3 days, leave a question in the <strong>Collab channel</strong>.</li>' +
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

const STEP_7_HTML_EN =
  '<h4>The PII Agent integration is complete.</h4>' +
  '<p>You can check the PII monitoring integration status on this page.</p>' +
  '<ul>' +
  '<li><strong>Healthy</strong>: working normally</li>' +
  '<li><strong>Unhealthy</strong>: meta/sample data collection has been failing for more than 3 days' +
  '<ul><li>If the DB is still in use, it has to be integrated again.</li></ul></li>' +
  '</ul>' +
  '<ol>' +
  '<li><strong>If the DB Credential Key changed</strong>' +
  '<ul>' +
  "<li>To change the DB Credential Key, press <strong>'Rerun connection test'</strong> to go back " +
  "to the <strong>'Connection test'</strong> step and register it again.</li>" +
  "<li>If the password of a registered Key changed, update the Key value under <strong>'DB " +
  "Credential'</strong>.</li>" +
  extLink('DB Credential page') +
  '</ul></li>' +
  '<li><strong>If a Logical DB has to be added or removed inside a DB the Agent is installed on</strong>' +
  '<ul>' +
  "<li><strong>'Rerun connection test'</strong> takes you back to the <strong>'Connection " +
  "test'</strong> step, where you can set the Logical DBs again.</li>" +
  '<li>If a Logical DB was created after the integration, use this to integrate it.</li>' +
  '</ul></li>' +
  '<li><strong>If a DB was added or removed after the integration</strong>' +
  '<ul>' +
  "<li><strong>'Change infrastructure'</strong> takes you back to the <strong>'Select target " +
  "DBs'</strong> step — run the infrastructure scan again from there.</li>" +
  '<li>The Agent resources already installed have to be deleted and the integration redone, so ' +
  'you have to go through the Agent install again.</li>' +
  '</ul></li>' +
  '</ol>' +
  '<blockquote>An issue in the BDC infrastructure can turn the integration status Unhealthy. If ' +
  'nothing has changed about the DB or the Credential Key on the system you own, leave a question ' +
  'about the cause in the <strong>Collab channel</strong>.</blockquote>';

// ---------------------------------------------------------------------------
// SDU — the four steps the owner walks (1 · 2 · 3 · 4)
// ---------------------------------------------------------------------------

/**
 * SOURCE: `design/sdu/sdu-flow-design.html`, the 「이 단계에서 할 일」 rail lists in its
 * `#step1` / `#step4` / `#step6` sections (the storyboard numbers by the shared lattice;
 * the owner-facing steps below are 1·2·3·4). Same transcription discipline as the rest of
 * this file — the rail list IS the guide, so it is copied rather than re-written.
 *
 * SDU 연동중 and 완료 do NOT reuse the shared cards. The shared 관리자 승인 대기 card names
 * something SDU has no such thing as, and the shared 완료 card tells the reader to press
 * 인프라 변경 and land on 연동 대상 DB 선택 — SDU's 1단계 is 연동 대상 정의 and there is no
 * infrastructure to change. Sending a reader to a control that is not on their screen is
 * the exact defect the 2026-08-23 transcription existed to remove.
 */
const SDU_TARGET_DEFINE_HTML =
  '<h4>연동할 대상을 직접 정의해주세요.</h4>' +
  '<blockquote>SDU는 연동 대상 승인 절차가 없어요. 제출하면 바로 업로드 준비 단계로 넘어가요.</blockquote>' +
  '<ol>' +
  '<li><strong>권역은 연동 대상 정보를 따라요.</strong>' +
  '<ul><li>Global은 Asia · US · EU · CX, China는 China만 고를 수 있어요.</li></ul></li>' +
  '<li><strong>연동할 대상을 추가해주세요.</strong>' +
  '<ul><li>대상마다 클라우드 · Region · 업로드 IP · Database Type을 입력해요.</li></ul></li>' +
  '<li><strong>업로드 IP는 S3에 데이터를 올릴 때 사용하는 IP예요.</strong>' +
  '<ul><li>이 주소에서만 업로드가 허용되므로 정확히 입력해주세요.</li></ul></li>' +
  '<li><strong>목록에 없는 Database Type은 직접 입력할 수 있어요.</strong>' +
  // The two caps are read from the domain constants the 1단계 form validates against —
  // a guide that promises 20 where the field stops at 10 is worse than no guide.
  `<ul><li>한 대상당 최대 ${SDU_DB_TYPE_MAX}개, 이름은 ${SDU_DB_TYPE_MAXLEN}자까지예요.</li></ul></li>` +
  "<li><strong>'제출'을 누르면 업로드 준비 단계로 넘어가요.</strong></li>" +
  '</ol>';

/**
 * ⚠️ 「권역은 연동 대상 정보를 따라요」 — the source's own sentence, and the one place the English
 * had to guess at the Korean rather than at a word. 권역 is the target source's Global/China
 * scope (`SDU_COPY.define.regionFixedHint`: 「China 권역이라 Region은 China로 고정돼요」), so the
 * translation keeps the Korean's own vagueness about what 「연동 대상 정보」 names.
 */
const SDU_TARGET_DEFINE_HTML_EN =
  '<h4>Define the targets to connect yourself.</h4>' +
  '<blockquote>SDU has no target approval step. Submit and you go straight to the data upload ' +
  'step.</blockquote>' +
  '<ol>' +
  '<li><strong>The scope follows the integration target information.</strong>' +
  '<ul><li>Global can pick Asia · US · EU · CX, and China can only pick China.</li></ul></li>' +
  '<li><strong>Add the targets you want to connect.</strong>' +
  '<ul><li>Each target takes a cloud · Region · upload IP · Database Type.</li></ul></li>' +
  '<li><strong>The upload IP is the IP the data is uploaded to S3 from.</strong>' +
  '<ul><li>Uploads are allowed only from this address, so enter it exactly.</li></ul></li>' +
  '<li><strong>A Database Type that is not in the list can be typed in.</strong>' +
  `<ul><li>Up to ${SDU_DB_TYPE_MAX} per target, and a name can be up to ${SDU_DB_TYPE_MAXLEN} characters.</li></ul></li>` +
  "<li><strong>Press 'Submit' and you move to the data upload step.</strong></li>" +
  '</ol>';

const SDU_UPLOAD_HTML =
  '<h4>데이터를 업로드하고, 올라간 파일을 확인해주세요.</h4>' +
  '<blockquote>이미 마친 항목도 언제든 다시 하실 수 있어요. 연동 대상을 고치려면 ' +
  "<strong>'연동 대상 수정'</strong>으로 1단계에 다녀오세요.</blockquote>" +
  '<ol>' +
  '<li><strong>방화벽 결재가 완료되었는지 확인해주세요.</strong>' +
  '<ul><li>업로드 대상 S3 리전으로의 접근이 열려 있어야 해요.</li></ul></li>' +
  '<li><strong>S3 Access Key를 받으실 분을 등록해주세요.</strong>' +
  '<ul><li>여러 명을 등록할 수 있어요. 등록된 분들께 관리자가 메일로 키를 직접 전달해요.</li></ul></li>' +
  '<li><strong>데이터를 업로드하고 확인해주세요.</strong>' +
  '<ul><li>Region별 업로드 확인 명령 세 줄로 올라간 파일을 확인할 수 있어요.</li></ul></li>' +
  '<li><strong>BDC 측 리소스 생성이 완료되면 다음 단계로 넘어가요.</strong></li>' +
  '</ol>';

const SDU_UPLOAD_HTML_EN =
  '<h4>Upload the data, then check the files that landed.</h4>' +
  '<blockquote>You can redo anything you have already finished at any time. To change the ' +
  "targets, go to Step 1 with <strong>'Edit integration targets'</strong>.</blockquote>" +
  '<ol>' +
  '<li><strong>Check that the firewall approval is done.</strong>' +
  '<ul><li>Access to the S3 region you upload to has to be open.</li></ul></li>' +
  '<li><strong>Register the people who should receive the S3 Access Key.</strong>' +
  '<ul><li>You can register more than one. An admin emails the key to them directly.</li></ul></li>' +
  '<li><strong>Upload the data and check it.</strong>' +
  '<ul><li>The three upload-check commands for each Region show you the files that landed.</li></ul></li>' +
  '<li><strong>Once BDC has finished creating the resources, you move to the next step.</strong></li>' +
  '</ol>';

const SDU_INTEGRATING_HTML =
  '<h4>업로드하신 데이터를 연동하고 있어요.</h4>' +
  '<p>BDC 측에서 업로드된 데이터를 확인하고 연동하고 있어요. 담당자가 하실 일은 없어요.</p>' +
  '<blockquote>연동이 끝나면 완료 단계로 넘어가요.</blockquote>';

const SDU_INTEGRATING_HTML_EN =
  '<h4>We are connecting the data you uploaded.</h4>' +
  '<p>BDC is checking the uploaded data and connecting it. There is nothing for you to do.</p>' +
  '<blockquote>You move to the completed step when the integration finishes.</blockquote>';

const SDU_COMPLETE_HTML =
  '<h4>SDU 연동이 완료되었어요.</h4>' +
  '<p>업로드하신 데이터를 PII 모니터링 대상으로 연동했어요.</p>' +
  '<ul>' +
  '<li><strong>업로드할 대상이나 업로드 IP가 바뀐 경우</strong>' +
  "<ul><li>하단 <strong>'연동 대상 수정'</strong>으로 1단계에 돌아가 정의를 다시 제출해주세요.</li></ul></li>" +
  '</ul>' +
  '<blockquote>1단계로 돌아가면 지금까지의 업로드 확인 내역은 사라져요.</blockquote>';

const SDU_COMPLETE_HTML_EN =
  '<h4>The SDU integration is complete.</h4>' +
  '<p>The data you uploaded is now integrated for PII monitoring.</p>' +
  '<ul>' +
  '<li><strong>If the targets to upload or the upload IP changed</strong>' +
  "<ul><li>Press <strong>'Edit integration targets'</strong> below to go back to Step 1 and " +
  'submit the definition again.</li></ul></li>' +
  '</ul>' +
  '<blockquote>Going back to Step 1 discards everything you have confirmed about the upload so ' +
  'far.</blockquote>';

// ---------------------------------------------------------------------------
// Assembly — one entry per GuideName
// ---------------------------------------------------------------------------

const CLOUD_STEP_1_HTML = step1Cloud({ vmRows: true });
const GCP_STEP_1_HTML = step1Cloud({ vmRows: false });

const CLOUD_STEP_1_HTML_EN = step1CloudEn({ vmRows: true });
const GCP_STEP_1_HTML_EN = step1CloudEn({ vmRows: false });

const ko: Record<GuideName, string> = {
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
  // SDU (4) — 1·4·6·7 only; the road strikes 2·3·5 through, so there is no slot to fill.
  SDU_TARGET_DEFINE: SDU_TARGET_DEFINE_HTML,
  SDU_UPLOAD: SDU_UPLOAD_HTML,
  SDU_INTEGRATING: SDU_INTEGRATING_HTML,
  SDU_COMPLETE: SDU_COMPLETE_HTML,
};

/**
 * `typeof ko` rather than a fresh literal: the compiler, not a reviewer, is what catches a
 * slot English forgot. `ko` itself stays annotated `Record<GuideName, string>` so a NEW
 * guide name still fails on both sides.
 */
const en: typeof ko = {
  AWS_TARGET_CONFIRM: CLOUD_STEP_1_HTML_EN,
  AWS_APPROVAL_PENDING: STEP_2_HTML_EN,
  AWS_APPLYING: STEP_3_HTML_EN,
  AWS_AUTO_INSTALLING: AWS_AUTO_INSTALLING_HTML_EN,
  AWS_MANUAL_INSTALLING: AWS_MANUAL_INSTALLING_HTML_EN,
  AWS_CONNECTION_TEST: STEP_5_HTML_EN,
  AWS_ADMIN_APPROVAL: STEP_6_HTML_EN,
  AWS_COMPLETED: STEP_7_HTML_EN,
  AZURE_TARGET_CONFIRM: CLOUD_STEP_1_HTML_EN,
  AZURE_APPROVAL_PENDING: STEP_2_HTML_EN,
  AZURE_APPLYING: STEP_3_HTML_EN,
  AZURE_INSTALLING: AZURE_INSTALLING_HTML_EN,
  AZURE_CONNECTION_TEST: STEP_5_HTML_EN,
  AZURE_ADMIN_APPROVAL: STEP_6_HTML_EN,
  AZURE_COMPLETED: STEP_7_HTML_EN,
  GCP_TARGET_CONFIRM: GCP_STEP_1_HTML_EN,
  GCP_APPROVAL_PENDING: STEP_2_HTML_EN,
  GCP_APPLYING: STEP_3_HTML_EN,
  GCP_INSTALLING: GCP_INSTALLING_HTML_EN,
  GCP_CONNECTION_TEST: STEP_5_HTML_EN,
  GCP_ADMIN_APPROVAL: STEP_6_HTML_EN,
  GCP_COMPLETED: STEP_7_HTML_EN,
  IDC_TARGET_INPUT: IDC_TARGET_INPUT_HTML_EN,
  IDC_APPROVAL_PENDING: STEP_2_HTML_EN,
  IDC_APPLYING: STEP_3_HTML_EN,
  IDC_INSTALLING: IDC_INSTALLING_HTML_EN,
  IDC_CONNECTION_TEST: STEP_5_HTML_EN,
  IDC_CONNECTION_VERIFIED: STEP_6_HTML_EN,
  IDC_COMPLETE: STEP_7_HTML_EN,
  SDU_TARGET_DEFINE: SDU_TARGET_DEFINE_HTML_EN,
  SDU_UPLOAD: SDU_UPLOAD_HTML_EN,
  SDU_INTEGRATING: SDU_INTEGRATING_HTML_EN,
  SDU_COMPLETE: SDU_COMPLETE_HTML_EN,
};

export const STEP_GUIDE_HTML: Record<Locale, typeof ko> = { ko, en };
