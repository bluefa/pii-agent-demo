import type { Locale } from '@/lib/locale';
import { plural } from '@/lib/plural';
import {
  IDC_ACCESS_ALLOWED,
  IDC_ACCESS_DENIED,
  IDC_SOURCE_IP_TOOLTIP,
  IDC_SOURCE_LABEL,
} from '@/lib/constants/idc';
import { ERROR_MESSAGES } from '@/lib/constants/messages';

/**
 * Every fixed string the IDC install flow renders, in both languages. Values that come from
 * the contract (hosts, ports, engine names, exclusion reasons a user typed, upstream
 * `message` fields) are not in here — only the chrome around them.
 *
 * `lib/constants/idc.ts` and `lib/constants/messages.ts` stay locale-agnostic (plain constant
 * modules, no locale threaded through them), so the strings they own are localized HERE, at
 * the dictionary the render sites read.
 */

/**
 * Widens a shared constant's literal type. `const en: typeof ko` is what makes the compiler
 * catch a key English forgot, and a literal-typed Korean value would force English to repeat
 * it verbatim. Korean keeps reading the constant, so the two cannot drift — the access
 * verdicts in particular are quoted by the guide copy and must stay one string.
 */
const shared = (value: string): string => value;

/** `IDC_SOURCE_IP_TOOLTIP` packs a title and a body into one `\n`-separated string. */
const [SRC_TIP_TITLE, ...SRC_TIP_BODY] = IDC_SOURCE_IP_TOOLTIP.split('\n');

const ko = {
  // --- shared words -------------------------------------------------------
  step: (n: number) => `${n}단계`,
  count: (n: number) => `${n}건`,
  /** Counting unit rendered on its own, after a number the markup emphasises separately. */
  unitCount: '건',
  charUnit: '자',
  save: '저장',
  cancel: '취소',
  add: '추가',
  edit: '수정',
  delete: '삭제',
  ok: '확인',
  load: '불러오기',
  request: '요청하기',
  manage: '관리하기',
  tryAgain: '다시 시도',
  /** Names the shared 다시 요청하기 button on the step-2 card (WaitingApprovalCancelButton). */
  retryRequest: '다시 요청하기',
  notSet: '미설정',
  required: '*필수',
  prevPage: '이전',
  nextPage: '다음',
  pageN: (n: number) => `${n} 페이지`,
  copyOf: (label: string) => `${label} 복사`,

  // --- table chrome -------------------------------------------------------
  colEndpoint: '접속 주소',
  /** Step-2/3 verdict column. Its 116px floor is the ledger's tightest — keep it short. */
  colTarget: '요청 대상 여부',
  colReason: '제외 사유',
  colConn: '연결 상태',
  /** Load-previous-request preview column, carrying the 대상/비대상 verdict. */
  colIntegrated: '연동 여부',
  colAllowed: '허용 여부',
  groupLogicalDb: '연동 논리 DB',
  colLogicalTarget: '대상',
  colLogicalExcluded: '제외',
  colLogicalManage: '관리',
  sourceLabel: shared(IDC_SOURCE_LABEL),
  srcTipTitle: SRC_TIP_TITLE,
  srcTipBody: SRC_TIP_BODY.join(' '),
  searchPlaceholder: 'Host 또는 IP 검색',
  filterEmpty: '조건에 맞는 결과가 없어요.',
  noTargetsToShow: '표시할 연동 대상이 없습니다.',
  loadFailed: '연동 대상을 불러오지 못했습니다.',

  // --- cells --------------------------------------------------------------
  collapseIps: '접기 ▴',
  showMoreIps: (n: number) => `IP ${n}개 더보기 ▾`,
  accessAllowed: shared(IDC_ACCESS_ALLOWED),
  accessDenied: shared(IDC_ACCESS_DENIED),
  accessChecking: '허용 확인 중',
  accessBdcCheck: 'BDC측 확인 필요',
  isTarget: '대상',
  notTarget: '비대상',
  credRequired: '자격 증명 필요',
  connSuccess: '성공',
  connFail: '실패',
  connRunning: '진행 중',
  connPending: '대기',
  credEditLabel: (name: string, current: string) => `${name} Credential 수정 — 현재 ${current}`,
  logicalTargetLabel: (name: string) => `${name} 연동 대상 논리 DB`,
  logicalExcludedLabel: (name: string) => `${name} 연동 제외 논리 DB`,
  logicalManageLabel: (name: string) => `${name} 연동 논리 DB 관리하기`,

  // --- exclusion reason ---------------------------------------------------
  exclPick: '제외 사유 선택',
  exclCustom: '사유 직접 입력',
  /** Presets are stored values (`lib/constants/idc.ts`), so only the label is localized. */
  exclPresetLabel: (preset: string) => preset,
  exclCustomTitle: '제외 사유 직접 입력',
  exclCustomDescBefore: '리소스 제외 사유는 ',
  exclCustomDescEm: '관리자 승인 시 함께 전달',
  exclCustomDescAfter: '돼요.',
  exclReasonPlaceholder:
    '예: Stg 환경 DB이며 운영 데이터가 아닌 익명화된 샘플 데이터만 보관하고 있어 제외합니다.',
  editReason: '제외 사유 수정',
  targetToggleLabel: '연동 대상 여부',

  // --- 승인 요청 modal (step 1) --------------------------------------------
  approvalSentTitle: '승인 요청을 보냈어요',
  approvalSendFailedTitle: '승인 요청을 보내지 못했어요',
  submitSuccessDesc: '잠시 후 승인 대기 단계로 이동해요.',
  submitErrorDesc: '연동 대상은 그대로 남아 있어요.',
  submitTitle: '연동 대상을 승인 요청할까요?',
  submitDescBefore: (total: number) => `전체 ${total}건 중`,
  submitDescEm: (live: number) => `${live}건을 연동 대상으로 요청해요`,
  submitDescAfter: '요청 후에는 관리자 검토가 시작되고, 변경하려면 취소 후 다시 요청해야 해요.',
  statTotalRequested: '전체 요청',
  statRequestedTargets: '연동 요청 대상',
  statRequestedExcluded: '연동 요청 제외대상',

  // --- 완료 승인 요청 modal (step 5) ---------------------------------------
  reqApprovalSuccessDesc: '잠시 후 관리자 승인 대기 단계로 이동해요.',
  reqApprovalErrorDesc: '연결 테스트 결과와 논리 DB 설정은 그대로 남아 있어요.',
  reqApprovalTitle: '연동 완료 승인을 요청할까요?',
  reqApprovalDescEm: (total: number) => `연동 대상 ${total}건의 연결 테스트 결과로 완료 승인을 요청해요`,
  reqApprovalDescAfter:
    '. 요청 후에는 관리자 검토가 시작되고, 변경하려면 요청을 취소하고 다시 제출해야 해요.',
  statTargets: '연동 대상',
  statConnOk: '연결 성공',
  statConnWaiting: '연결 대기',

  // --- 접근 허용 확인 modal -------------------------------------------------
  fwTitle: '접근 허용 확인',
  fwSubtitle: (source: string) => `${source} → 접속 주소 접근 허용 여부를 확인합니다.`,
  fwEmpty: '확인할 연동 대상이 없습니다.',

  // --- 기존 연동 정보 불러오기 modal ----------------------------------------
  loadTitle: '기존 연동 정보를 불러올까요?',
  loadSubtitle: '현재 입력한 정보는 모두 사라지고 아래 기존 연동 정보를 불러옵니다.',
  loadEmptyTitle: '불러올 연동 대상이 없어요',
  loadEmptyDesc: '이전에 요청한 연동 대상이 있을 때만 불러올 수 있어요',
  loadCountLead: '불러올 연동 대상 ',
  loadCountLive: '연동',
  loadCountExcluded: '제외',
  loadRange: (from: number, to: number, total: number) => `${from}–${to} / 전체 ${total}건`,

  // --- 연동 대상 추가/수정 form --------------------------------------------
  formEditTitle: '연동 대상 수정',
  formAddTitle: '연동 대상 추가',
  formSubtitle: 'PII 모니터링 모듈 연동이 필요한 IDC DB의 접속 정보를 입력해주세요.',
  formSection1: '입력 방식 선택',
  formInputMode: '입력 방식',
  formIpDesc: '고정 IP로 DB에 접속 (권장)',
  formDomainDesc: 'DB IP가 유동적으로 변경되는 경우에만 권장',
  formSection2: '접속 정보',
  formIpLabel: 'IP 주소',
  formIpHint: 'IPv4만 등록할 수 있어요',
  formIpPlaceholder: '예: 10.20.30.40',
  formRemoveIp: 'IP 삭제',
  formIpMax: (max: number) => `IP는 최대 ${max}개까지 등록할 수 있어요`,
  formAddIp: 'IP 추가',
  formMultiIpWarnBefore: '여러 IP 등록은 멀티 노드 구성(예: Oracle RAC)에서만 권장돼요. 가능하면 ',
  formMultiIpWarnEm: '단일 IP',
  formMultiIpWarnAfter: '로 등록해주세요.',
  formTrailingSpace: '입력값 끝에 공백 문자가 포함되어 있어요. 공백을 제거해주세요.',
  formIpFormatErr: '올바른 IPv4 형식으로 입력해주세요 (예: 10.20.30.40)',
  formIpDupErr: '중복된 IP가 있어요. 같은 IP는 한 번만 입력할 수 있어요',
  formDomainPlaceholder: '예: db.svc-a.io',
  formDomainErr: '올바른 도메인 형식으로 입력해주세요 (예: db.svc-a.io)',
  formDomainWarn1: 'Web Server가 아닌 ',
  formDomainWarnEm1: 'DB에 대한 주소',
  formDomainWarn2: '를 입력해야 해요. DB에 Domain을 연결하는 것은',
  formDomainWarnEm2: 'DB IP가 유동적으로 변경되는 경우에만',
  formDomainWarn3: ' 권장돼요.',
  formSection3: 'DB Type 선택',
  formDbTypePlaceholder: 'DB Type 선택…',
  formSidPlaceholder: '예: ORCL',
  formSidErr: 'Oracle 선택 시 SID는 필수예요',
  formPortPlaceholder: '예: 3306',
  formPortErr: '1–65535 범위의 정수 포트를 입력해주세요',

  // --- step 1 -------------------------------------------------------------
  step1Title: '연동 대상 DB 입력',
  step1GuideBefore: 'PII Agent 연동이 필요한 DB 정보를 ',
  step1GuideAfter: '에서 입력해주세요. 연동 대상 승인 요청으로 제출한 결과는 관리자 승인 후 최종 확정돼요.',
  step1LoadGuideBefore: '설치 절차를 다시 진행하는 상황이라면 ',
  step1LoadGuideAfter: '에서 과거에 입력한 정보를 불러올 수 있어요.',
  loadPrevCta: '기존 연동 요청 정보 불러오기',
  addTarget: '연동 대상 추가',
  step1EmptyTitle: '연동 대상을 추가해주세요',
  step1EmptyDesc: 'IP 또는 Domain 기반의 DB 접속 정보를 등록할 수 있어요',
  hintTotal: '총',
  hintLive: '연동',
  hintExcluded: '제외',
  step1SubmitCta: '연동 대상 승인 요청',
  step1BlockedTitle: '연동할 DB가 없어요',
  step1BlockedBody: '1건 이상을 연동 대상으로 남기면 승인을 요청할 수 있어요.',
  submitAcceptedRefresh: '승인 요청은 접수됐어요. 화면을 새로고침해 최신 상태를 확인해 주세요.',

  // --- step 2 -------------------------------------------------------------
  step2Title: '연동 대상 승인 대기',
  badgePending: '승인 대기',
  step2GuideEm: '관리자가 제출된 연동 대상 DB를 확인하고 있어요.',
  step2GuideRest:
    '평균 1일 이내(주말·공휴일 제외)에 확인이 완료되며, 이슈가 없으면 다음 단계로 넘어가요. 반려된 경우, 사유를 확인한 후 다시 제출해주세요.',
  step2RetryBefore: '제출한 연동 대상 DB 정보를 수정하고 싶다면 ',
  step2RetryAfter: '를 눌러주세요.',
  metaRequestedAt: '요청일시',
  metaRequestedBy: '요청자',

  // --- step 3 -------------------------------------------------------------
  step3Title: '연동 대상 반영중',
  badgeApplying: '반영중',
  step3GuideEm: '제출한 연동 대상 DB가 승인 완료됐어요.',
  step3GuideRest: 'PII Agent 설치에 필요한 준비를 진행하고 있어요.',
  step3GuideEta: '평균 1일 이내(주말·공휴일 제외)에 완료돼요.',
  metaApprovedAt: '승인일시',
  metaApprover: '승인자',

  // --- step 4 -------------------------------------------------------------
  step4CxTitle: 'BDC CX 영역',
  step4BdpTitle: 'BDC BDP 영역',
  step4BdcSide: 'BDC측 리소스 생성',
  step4TerraformDesc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
  step4FirewallTitle: '접근 허용',
  step4ServiceSide: '서비스측 확인',
  step4FirewallAction: (source: string) => `${source}에서 연동 대상으로의 접근을 허용한 뒤 확인해 주세요.`,
  step4FirewallDesc: (source: string) => `${source} → 연동 대상 접근 허용 여부를 점검하는 단계입니다.`,
  step4StatusCheckFailed: '상태 확인 실패',

  // --- step 5 -------------------------------------------------------------
  step5Title: '연결 테스트',
  step5GuideBefore: '연동 대상 DB에 접근하기 위한 PII Agent 리소스가 생성됐어요.',
  step5GuideEm: 'Credential을 등록한 다음 리소스별 Key를 지정하면 연결 테스트',
  step5GuideAfter: '를 진행할 수 있어요. 테스트가 모두 성공하면 완료 승인 요청을 진행할 수 있어요.',
  step5LogicalGuide:
    'DB 내에 연동이 불필요한 논리 DB가 있다면 해당 논리 DB는 연동에서 제외할 수 있어요. 이 절차는 연결 테스트 완료 후에 진행할 수 있어요.',
  runHistory: '실행 이력',
  step5NoTargets: '연동 대상이 없어 연결 테스트를 실행할 수 없어요. 2단계에서 대상을 확정해 주세요.',
  credMissingTip: (n: number) => `Credential 미설정 ${n}건 — 지정해야 연결 테스트를 실행할 수 있습니다`,
  credSaveFailed: 'Credential 변경에 실패했습니다.',
  tcFetchFailed: shared(ERROR_MESSAGES.TEST_CONNECTION_FETCH_FAILED),
  tcCompletionFetchFailed: shared(ERROR_MESSAGES.TEST_CONNECTION_COMPLETION_FETCH_FAILED),

  // --- step 6 -------------------------------------------------------------
  step6Title: '완료 여부 관리자 승인 대기',
  step6GuideEm: 'PII Agent 설치 완료 승인을 위해 동작을 점검하고 있어요.',
  step6GuideRest: '승인이 완료되면 PII Agent 연동이 완료돼요.',
  step6RetestBefore: '논리 DB 연동 대상을 수정하거나 연결 테스트를 다시 수행하고 싶다면 ',
  step6RetestAfter: '을 눌러주세요.',
  retestCta: '연결 테스트 재실행',
  retestFailed: '연결 테스트 재실행 요청에 실패했습니다.',

  // --- step 7 -------------------------------------------------------------
  step7Title: 'PII 모니터링 모듈 연동',
  badgeComplete: '연동 완료',
  step7GuideEm: 'PII Agent 연동 절차가 완료되었어요.',
  step7GuideBefore: 'PII Agent 연동 대상 인프라가 바뀌었다면',
  step7GuideBetween: '을, 연결 상태를 다시 점검하고 싶다면',
  step7GuideAfter: '을 눌러 연동 절차를 다시 진행할 수 있어요.',
  step7Hint: '※ 인프라 변경은 1단계, 연결 테스트 재실행은 5단계로 되돌아가 프로세스를 다시 진행해요.',
  changeInfra: '인프라 변경',
};

const en: typeof ko = {
  // --- shared words -------------------------------------------------------
  step: (n: number) => `Step ${n}`,
  count: (n: number) => `${n}`,
  unitCount: '',
  charUnit: '',
  save: 'Save',
  cancel: 'Cancel',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
  ok: 'OK',
  load: 'Load',
  request: 'Request',
  manage: 'Manage',
  tryAgain: 'Try again',
  retryRequest: 'Try again',
  notSet: 'Not set',
  required: '*required',
  prevPage: 'Previous page',
  nextPage: 'Next page',
  pageN: (n: number) => `Page ${n}`,
  copyOf: (label: string) => `Copy ${label}`,

  // --- table chrome -------------------------------------------------------
  colEndpoint: 'Endpoint',
  colTarget: 'Requested',
  colReason: 'Reason',
  colConn: 'Status',
  colIntegrated: 'Target',
  colAllowed: 'Allowed',
  groupLogicalDb: 'Logical DB',
  colLogicalTarget: 'Target',
  colLogicalExcluded: 'Excluded',
  colLogicalManage: 'Manage',
  sourceLabel: 'BDC source',
  srcTipTitle: 'Access must be allowed',
  srcTipBody:
    'This is the source IP the BDC Agent connects from. Your side has to allow BDC source → integration target (IP:Port) before the connection test can pass.',
  searchPlaceholder: 'Search by host or IP',
  filterEmpty: 'No results match these filters.',
  noTargetsToShow: 'No integration targets to show.',
  loadFailed: 'Could not load the integration targets.',

  // --- cells --------------------------------------------------------------
  collapseIps: 'Show less ▴',
  showMoreIps: (n: number) => `${n} more ${plural(n, 'IP', 'IPs')} ▾`,
  accessAllowed: 'Access allowed',
  accessDenied: 'Access not allowed',
  accessChecking: 'Checking access',
  accessBdcCheck: 'BDC check needed',
  isTarget: 'Target',
  notTarget: 'Excluded',
  credRequired: 'Credential needed',
  connSuccess: 'Succeeded',
  connFail: 'Failed',
  connRunning: 'In progress',
  connPending: 'Pending',
  credEditLabel: (name: string, current: string) => `Edit the credential for ${name} — currently ${current}`,
  logicalTargetLabel: (name: string) => `Logical DBs integrated for ${name}`,
  logicalExcludedLabel: (name: string) => `Logical DBs excluded for ${name}`,
  logicalManageLabel: (name: string) => `Manage the Logical DBs for ${name}`,

  // --- exclusion reason ---------------------------------------------------
  exclPick: 'Select an exclusion reason',
  exclCustom: 'Write your own reason',
  exclPresetLabel: (preset: string) => (preset === '임시DB' ? 'Temporary DB' : preset),
  exclCustomTitle: 'Write your own exclusion reason',
  exclCustomDescBefore: 'The exclusion reason is ',
  exclCustomDescEm: 'sent to the admin with the approval request',
  exclCustomDescAfter: '.',
  exclReasonPlaceholder:
    'e.g. A staging DB that holds anonymised sample data only, not production data.',
  editReason: 'Edit the exclusion reason',
  targetToggleLabel: 'Integration target',

  // --- 승인 요청 modal (step 1) --------------------------------------------
  approvalSentTitle: 'Approval request sent',
  approvalSendFailedTitle: 'Could not send the approval request',
  submitSuccessDesc: 'You move to the pending-approval step shortly.',
  submitErrorDesc: 'Your integration targets are unchanged.',
  submitTitle: 'Request approval for these integration targets?',
  submitDescBefore: (total: number) => `Of ${total} in total,`,
  submitDescEm: (live: number) =>
    `${live} ${plural(live, 'is', 'are')} requested as ${plural(live, 'an integration target', 'integration targets')}`,
  submitDescAfter:
    'An admin review starts once you request it. To change anything, cancel and request again.',
  // Short on purpose: the three sit in a 1/3-width tile under a 40px number, and the modal's
  // own title and sentence already say these are the integration targets being requested.
  statTotalRequested: 'Total',
  statRequestedTargets: 'Targets',
  statRequestedExcluded: 'Excluded',

  // --- 완료 승인 요청 modal (step 5) ---------------------------------------
  reqApprovalSuccessDesc: 'You move to the admin approval step shortly.',
  reqApprovalErrorDesc: 'Your connection test results and Logical DB settings are unchanged.',
  reqApprovalTitle: 'Request approval to complete the integration?',
  reqApprovalDescEm: (total: number) =>
    `Request completion approval with the connection test results for ${total} integration ${plural(total, 'target', 'targets')}`,
  reqApprovalDescAfter:
    '. An admin review starts once you request it, and to change anything you have to cancel the request and submit again.',
  statTargets: 'Integration targets',
  statConnOk: 'Connected',
  statConnWaiting: 'Awaiting connection',

  // --- 접근 허용 확인 modal -------------------------------------------------
  fwTitle: 'Check access',
  fwSubtitle: (source: string) => `Check whether ${source} is allowed to reach each endpoint.`,
  fwEmpty: 'There are no integration targets to check.',

  // --- 기존 연동 정보 불러오기 modal ----------------------------------------
  loadTitle: 'Load the previous integration details?',
  loadSubtitle:
    'Everything you have entered is discarded and replaced with the previous details below.',
  loadEmptyTitle: 'Nothing to load',
  loadEmptyDesc: 'You can only load this when you have requested integration targets before',
  loadCountLead: 'Integration targets to load ',
  loadCountLive: 'integrated',
  loadCountExcluded: 'excluded',
  loadRange: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,

  // --- 연동 대상 추가/수정 form --------------------------------------------
  formEditTitle: 'Edit integration target',
  formAddTitle: 'Add integration target',
  formSubtitle:
    'Enter the connection details of the IDC DB that needs the PII monitoring module.',
  formSection1: 'Choose an input method',
  formInputMode: 'Input method',
  formIpDesc: 'Reach the DB at a fixed IP (recommended)',
  formDomainDesc: 'Recommended only when the DB IP changes',
  formSection2: 'Connection details',
  formIpLabel: 'IP address',
  formIpHint: 'IPv4 only',
  formIpPlaceholder: 'e.g. 10.20.30.40',
  formRemoveIp: 'Remove IP',
  formIpMax: (max: number) => `You can register up to ${max} IPs`,
  formAddIp: 'Add IP',
  formMultiIpWarnBefore:
    'Several IPs are only recommended for a multi-node setup (e.g. Oracle RAC). Where you can, register ',
  formMultiIpWarnEm: 'a single IP',
  formMultiIpWarnAfter: '.',
  formTrailingSpace: 'The value ends with a space. Remove it.',
  formIpFormatErr: 'Enter a valid IPv4 address (e.g. 10.20.30.40)',
  formIpDupErr: 'This IP is duplicated. Each IP can only be entered once',
  formDomainPlaceholder: 'e.g. db.svc-a.io',
  formDomainErr: 'Enter a valid domain (e.g. db.svc-a.io)',
  formDomainWarn1: 'Enter the address of the ',
  formDomainWarnEm1: 'DB itself',
  formDomainWarn2: ', not a web server. Pointing a domain at a DB is recommended',
  formDomainWarnEm2: 'only when the DB IP changes',
  formDomainWarn3: '.',
  formSection3: 'Choose a DB type',
  formDbTypePlaceholder: 'Select a DB type…',
  formSidPlaceholder: 'e.g. ORCL',
  formSidErr: 'SID is required when Oracle is selected',
  formPortPlaceholder: 'e.g. 3306',
  formPortErr: 'Enter an integer port between 1 and 65535',

  // --- step 1 -------------------------------------------------------------
  step1Title: 'Enter the target DBs',
  step1GuideBefore: 'Enter the DBs that need PII Agent under ',
  step1GuideAfter:
    '. What you submit with Request target approval is final once an admin approves it.',
  step1LoadGuideBefore: 'If you are going through the install again, ',
  step1LoadGuideAfter: ' brings back what you entered last time.',
  loadPrevCta: 'Load a previous request',
  addTarget: 'Add integration target',
  step1EmptyTitle: 'Add an integration target',
  step1EmptyDesc: 'You can register DB connection details by IP or by domain',
  hintTotal: 'Total',
  hintLive: 'integrated',
  hintExcluded: 'excluded',
  step1SubmitCta: 'Request target approval',
  step1BlockedTitle: 'No DB to integrate',
  step1BlockedBody: 'Keep at least one row as an integration target to request approval.',
  submitAcceptedRefresh: 'Your approval request went through. Refresh the page to see its status.',

  // --- step 2 -------------------------------------------------------------
  step2Title: 'Waiting for target approval',
  badgePending: 'Pending',
  step2GuideEm: 'An admin is reviewing the target DBs you submitted.',
  step2GuideRest:
    'Review usually finishes within a day (weekends and holidays excluded), and you move to the next step if nothing comes up. If it is rejected, read the reason and submit again.',
  step2RetryBefore: 'To change the target DBs you submitted, press ',
  step2RetryAfter: '.',
  metaRequestedAt: 'Requested at',
  metaRequestedBy: 'Requested by',

  // --- step 3 -------------------------------------------------------------
  step3Title: 'Applying the targets',
  badgeApplying: 'Applying',
  step3GuideEm: 'The target DBs you submitted are approved.',
  step3GuideRest: 'We are preparing what PII Agent needs in order to install.',
  step3GuideEta: 'This usually finishes within a day (weekends and holidays excluded).',
  metaApprovedAt: 'Approved at',
  metaApprover: 'Approved by',

  // --- step 4 -------------------------------------------------------------
  step4CxTitle: 'BDC CX zone',
  step4BdpTitle: 'BDC BDP zone',
  step4BdcSide: 'BDC creates the resources',
  step4TerraformDesc: 'BDC runs the Terraform that sets PII Agent up.',
  step4FirewallTitle: 'Allow access',
  step4ServiceSide: 'The service confirms',
  step4FirewallAction: (source: string) =>
    `Allow access from ${source} to your integration targets, then confirm it.`,
  step4FirewallDesc: (source: string) =>
    `This step checks whether ${source} is allowed to reach the integration targets.`,
  step4StatusCheckFailed: 'Status check failed',

  // --- step 5 -------------------------------------------------------------
  step5Title: 'Connection test',
  step5GuideBefore: 'The PII Agent resources that reach your target DBs are ready.',
  step5GuideEm: 'Register a credential, assign a key to each resource, and the connection test',
  step5GuideAfter:
    ' can run. Once every test succeeds you can request completion approval.',
  step5LogicalGuide:
    'If a DB holds Logical DBs you do not need to integrate, you can exclude them. That comes after the connection test passes.',
  runHistory: 'Run history',
  step5NoTargets:
    'There is no integration target, so the connection test cannot run. Confirm the targets in Step 2.',
  credMissingTip: (n: number) => `${n} without a credential — assign one to run the connection test`,
  credSaveFailed: 'Could not change the credential.',
  tcFetchFailed: 'Could not load the connection test results. Please try again in a moment.',
  tcCompletionFetchFailed:
    'Could not load the connection test completion status. Please try again in a moment.',

  // --- step 6 -------------------------------------------------------------
  step6Title: 'Waiting for admin completion approval',
  step6GuideEm: 'We are checking how PII Agent behaves before the install is approved as complete.',
  step6GuideRest: 'Once it is approved, the PII Agent integration is done.',
  step6RetestBefore: 'To change which Logical DBs are integrated, or to test the connection again, press ',
  step6RetestAfter: '.',
  retestCta: 'Rerun the connection test',
  retestFailed: 'Could not request a connection test rerun.',

  // --- step 7 -------------------------------------------------------------
  step7Title: 'PII monitoring module integration',
  badgeComplete: 'Integration complete',
  step7GuideEm: 'The PII Agent integration is complete.',
  step7GuideBefore: 'If the infrastructure PII Agent covers has changed, press',
  step7GuideBetween: '. To check the connection again, press',
  step7GuideAfter: '. Either one starts the integration process over.',
  step7Hint:
    '※ Change infrastructure goes back to Step 1 and Rerun the connection test goes back to Step 5, and the process runs again from there.',
  changeInfra: 'Change infrastructure',
};

export const IDC_COPY: Record<Locale, typeof ko> = { ko, en };

/** The IDC dictionary, so module-level label maps can take it as a parameter. */
export type IdcCopy = (typeof IDC_COPY)['ko'];
