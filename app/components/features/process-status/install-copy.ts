import type { Locale } from '@/lib/locale';
import { plural } from '@/lib/plural';
import { SDU_STEP_TITLES } from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';

/**
 * Fixed UI strings for the Step-4 install-status detail — the provider-agnostic
 * master/detail frame, the AWS / Azure / GCP adapters that feed it, and the
 * Terraform panels beside it.
 *
 * Values that come from the contract are not in here: resource ids and names,
 * regions, `guide` sentences, `fail_reason` codes and upstream `message` fields
 * all render as they arrive. What this file owns is the chrome around them plus
 * the six install-status buckets, whose words the client — not the wire — picks.
 *
 * Same shape as `lib/copy.ts`: `const en: typeof ko` is what makes the compiler,
 * rather than a reviewer, catch a key English forgot.
 */
const ko = {
  /** The step-4 card header (`InstallCardHeader`). */
  card: {
    stepTag: '4단계',
    title: 'Agent 설치',
    guidance:
      '연동 대상 DB에 PII Agent를 설치하는 단계예요. BDC에서도 관련된 리소스 생성 작업을 진행할 예정이에요.',
    /**
     * Three parts, not one sentence, because the middle phrase is drawn in the
     * brand colour and the two languages put it in different places. It names
     * the rail group, so it must stay spelled exactly like `detail.groupTodo`.
     */
    actionBefore: '',
    actionHighlight: '내가 할 일에서 작업할 항목',
    actionAfter: '을 확인한 후 진행해주시고, 모든 절차가 완료되면 다음 단계로 넘어가요.',
  },

  /**
   * The six `InstallStepValue` buckets. The wire leaves the status a plain
   * string; these words are the client's, and every surface that prints a cell
   * status reads them from here.
   *
   * ⛔ `IN_PROGRESS` is "진행중" / "In progress", never "확인 중" / "Checking".
   * The enum has no not-started value, so translating it as a check in flight
   * would have the screen claim something is running that may never have run.
   * `UNKNOWN` is the normalization sink and is the one that says "확인 중".
   */
  stepValue: {
    COMPLETED: '완료',
    IN_PROGRESS: '진행중',
    FAIL: '실패',
    SKIP: '해당 없음',
    BDC_INSTALL_REQUIRED: 'BDC 설치 대기',
    UNKNOWN: '확인 중',
  },

  /** Step-aggregate words on the rail and the pane-head pill. */
  aggregate: {
    failed: '실패',
    running: '진행중',
    done: '완료',
    waiting: '대기',
  },

  /**
   * Execution-side tags. `SideText` splits on the first space and colours the
   * leading word, so the owner must stay a single token in both languages, and
   * the BDC ones must keep starting with `BDC` — that prefix picks the colour.
   */
  side: {
    serviceResource: '서비스측 리소스 생성',
    bdcResource: 'BDC측 리소스 생성',
    serviceApproval: '서비스측 승인',
    serviceCheck: '서비스측 확인',
  },

  /** The shared master/detail body (`InstallStatusDetail`). */
  detail: {
    navLabel: '설치 단계',
    groupTodo: (open: number) => `내가 할 일 (${open})`,
    groupTodoAllDone: '모두 완료',
    groupAuto: 'BDC 진행',
    groupReference: '설치 스크립트',

    summaryTitle: '설치 현황 요약',
    summaryDesc: '전체 진행 상황과, 서비스 측에서 확인해야 할 항목을 모아 보여줍니다.',

    statTotal: '전체 리소스',
    statDone: '완료',
    statRunning: '진행중',
    statFailed: '실패',

    nothingToCheck:
      '지금 서비스 측에서 확인할 항목은 없어요. 나머지 단계는 BDC가 처리 중이며, 왼쪽 목록에서 진행 상황을 볼 수 있어요.',
    actionSectionTitle: '지금 서비스 측에서 확인이 필요합니다',
    /** Counting units disappear in English — `3건` → `3`. */
    count: (n: number) => `${n}건`,
    goToStep: (title: string) => `${title} 단계로 이동`,

    lastChecked: (at: string) => `마지막 확인 ${at}`,
    statusCheckFailed: '상태 확인 실패',

    noResources: '설치 대상 리소스가 없습니다.',
    filterEmpty: '조건에 맞는 결과가 없어요.',
    naTitle: '이 단계에 해당하는 리소스가 없어요',
    tableFold: (n: number) => `연동 대상 리소스 표 · ${n}건`,
    naDesc: (total: number) =>
      `연동 대상 ${total}건 모두 이 단계에 해당하지 않아, 수행할 작업이 없습니다.`,
  },

  /** The seven-step road drawn by the installation progress bar. */
  road: {
    targetSelect: '연동 대상 DB 선택',
    targetApproval: '연동 대상 승인 대기',
    applying: '연동 대상 반영중',
    installing: 'Agent 설치',
    connectionTest: '연결 테스트',
    adminApproval: '관리자 승인 대기',
    complete: '완료',
    sdu1: SDU_STEP_TITLES[1],
    sdu2: SDU_STEP_TITLES[2],
    sdu3: SDU_STEP_TITLES[3],
    sdu4: SDU_STEP_TITLES[4],
  },

  /** Chrome the three provider inline cards share. */
  inline: {
    loading: (provider: string) => `${provider} 설치 상태 확인 중`,
    retry: '다시 시도',
    statusCheckFailed: (reason: string) => `상태 확인 실패: ${reason}`,
    statusCheckFailedFallback: '최근 설치 상태 확인에 실패했습니다.',
    confirmedLoading: '리소스 정보 불러오는 중',
    confirmedLoadingEllipsis: '리소스 정보 불러오는 중...',
    confirmedError: (message: string) => `리소스 정보 불러오기 실패: ${message}`,
    confirmedRetry: '재시도',
  },

  /** The last-check / last-verify stamp beside the card title. */
  stamp: {
    /**
     * A function, not a bare verb: Korean puts it after the elapsed span and
     * English before it. ⚠️ `elapsed` itself is produced by `fmtElapsedAgo`
     * (`lib/pipeline/format.ts`), a plain lib module outside this screen, and is
     * Korean in both locales.
     */
    checkedAgo: (elapsed: string) => `${elapsed} 확인`,
    verifiedAgo: (elapsed: string) => `${elapsed} 검증`,
    statusCheckFailed: '상태 확인 실패',
    tooltip:
      '설치 상태를 마지막으로 확인한 시각이에요. 화면에 보이는 값은 이때 확인한 결과라, 지금 상태와는 다를 수 있어요.',
  },

  /** AWS steps, the reference item, and the Terraform-script control. */
  aws: {
    serviceTitleManual: 'Terraform 직접 적용',
    serviceTitleAuto: '서비스 측 Terraform 자동 적용',
    serviceActionManual: '다운로드한 Terraform 스크립트를 서비스 AWS 계정에 직접 적용해 주세요.',
    serviceDescManual: '다운로드한 Terraform 스크립트를 서비스 AWS 계정에 직접 적용합니다.',
    serviceDescAuto:
      '리소스별 Private Endpoint / IAM Role / Glue Policy 설정을 Terraform으로 자동 배포합니다.',
    /**
     * Follows the `Terraform Script` jump link with no separator, because the
     * Korean particle attaches to the label. English needs its own leading
     * space — the component adds none.
     */
    serviceNoteManual: '에서 스크립트를 내려받을 수 있습니다.',
    serviceNoteAuto: '에서 자세한 설치 사항을 확인할 수 있습니다.',

    bdcCommonTitle: 'BDC 공통 영역',
    bdcServiceTitle: 'BDC 서비스 영역',
    bdcDesc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',

    referenceTitle: 'Terraform Script',
    /** Rendered after the jump link to the service step, separated by one space. */
    referenceDesc: '단계에서 수행하는 Terraform 작업 내역을 미리 확인할 수 있습니다.',

    permTitle: 'Terraform 권한 부여 확인',
    permAction: '대상 AWS 계정에 Terraform 실행용 IAM Role / AssumeRole 권한을 부여해 주세요.',
    permDesc:
      '대상 AWS 계정에 Terraform 실행을 위한 IAM Role / AssumeRole 권한이 부여되었는지 검증합니다.',

    downloadScript: 'Terraform Script 다운로드',
    downloading: '다운로드 중...',
    downloadFailed: '다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  },

  /**
   * The Terraform execution-role verify panel. `checking` belongs to the button
   * while a live request is in flight — it is not a translation of any wire
   * status.
   */
  rolePanel: {
    awsAccount: 'AWS 계정',
    roleArn: 'Terraform Role',
    copy: (label: string) => `${label} 복사`,
    findingLabel: '확인 필요',
    findingAnnounce: (message: string) => `확인 필요. ${message}`,
    idleLead: 'Terraform 권한 확인 필요',
    idleBody: '지금 확인하면 권한 상태와 막힌 원인까지 확인할 수 있어요.',
    passed: '방금 확인했을 때는 막힌 곳이 없었어요.',
    loadFailed: '권한 검증 결과를 불러오지 못했습니다.',
    checking: '확인 중...',
    verifyAgain: '다시 확인',
    verify: '권한 확인',
    duration: '최대 30초까지 걸릴 수 있어요',
  },

  /**
   * Role-verification findings — one sentence per frozen `fail_reason` code.
   * The codes themselves stay on the wire; an unmapped one renders raw beside
   * the fallback sentence rather than being smoothed over.
   */
  roleFinding: {
    fallback: '권한 검증에 실패했습니다. 대상 AWS 계정의 권한 설정을 확인해 주세요.',
    undetermined: '지금은 검증 결과를 확정할 수 없습니다. 설정 문제가 아닐 수 있습니다.',
    notConfigured: 'Terraform 실행 Role 이 아직 등록되지 않았습니다.',
    invalidArn: '등록된 Role ARN 형식이 올바르지 않습니다.',
    notFound: 'ARN 형식은 올바르지만 AWS IAM 에서 해당 Role 을 찾지 못했습니다.',
    notFoundNote: '대상 AWS 계정에 Role 이 그대로 남아 있는지 확인해 주세요.',
    scanNotConfigured: 'Terraform 권한을 검증하려면 Scan Role 이 먼저 등록되어야 합니다.',
    scanNotConfiguredNote: '이 단계에서 막힌 원인은 Terraform Role 이 아닙니다.',
    scanNotAssumable: 'Scan Role 을 넘겨받지 못했습니다. Role ARN 또는 신뢰 정책을 확인해 주세요.',
    scanNotAssumableNote: '등록된 Terraform Role ARN 은 원인이 아닙니다.',
    unavailableNote: 'IAM 변경 직후라면 잠시 후 다시 확인해 주세요.',
  },

  /** Azure steps and the private-endpoint pill overrides. */
  azure: {
    vmSubnetTitle: 'VM Subnet 생성',
    vmSubnetDesc: 'VM 연동용 Subnet을 생성합니다. VM이 아닌 리소스는 해당 없음으로 표시됩니다.',
    vmApplyTitle: 'VM Terraform 적용',
    vmApplyDesc: 'VM 연동에 필요한 서비스 측 리소스를 Terraform으로 적용합니다.',
    bdcTitle: 'BDC측 Terraform 적용',
    bdcDesc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
    peTitle: 'Private Endpoint 승인',
    peAction: 'Azure Portal에서 BDC가 요청한 Private Endpoint 연결을 승인해 주세요.',
    peDesc: 'BDC가 요청한 Private Endpoint 연결을 Azure Portal에서 승인하는 단계입니다.',
    peApproved: '승인 완료',
    pePending: 'Azure Portal에서 승인 필요',
    peFailed: 'BDC측 재신청 필요',
    peUnknown: 'BDC측 확인 필요',
  },

  /** GCP steps. */
  gcp: {
    subnetTitle: 'PSC용 Subnet 생성',
    subnetDesc:
      'PSC(Private Service Connect) 연결에 사용할 Subnet을 생성합니다. Region마다 하나가 필요합니다.',
    serviceTitle: '서비스측 Terraform 적용',
    serviceDesc: '서비스 프로젝트 측 리소스를 Terraform으로 적용합니다.',
    bdcTitle: 'BDC측 Terraform 적용',
    bdcDesc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
    /** PSC proxy-subnet guide (step 4 panel). */
    pscLead:
      'Regional Managed Proxy Subnet이 Region마다 하나 있어야 그 Region의 Cloud SQL에 PSC를 만들 수 있습니다. 아래 명령을 호스트 프로젝트에서 Region마다 한 번 실행해주세요. CIDR만 프로젝트 대역에 맞게 채우면 됩니다.',
    pscCidrNote: 'CIDR은 서비스 측 네트워크 대역이라 화면이 정하지 않습니다. 프로젝트에서 비어 있는 /24 대역을 넣어주세요.',
    /** The same guide read by the operator (admin 인프라 작업) — who asks, not who runs. */
    pscLeadAdmin:
      '서비스 측 담당자에게 아래 명령으로 PSC용 Regional Managed Proxy Subnet을 Region마다 하나 만들어 달라고 요청해주세요. 호스트 프로젝트에서 실행하는 명령이며, Subnet이 있어야 그 Region의 Cloud SQL에 PSC를 만들 수 있습니다.',
    pscCidrNoteAdmin: 'CIDR은 서비스 측이 프로젝트에서 비어 있는 /24 대역으로 정합니다. 화면은 값을 넣지 않습니다.',
    pscCovers: (n: number) => `Cloud SQL ${n}대`,
    pscCopy: (region: string) => `${region} 명령 복사`,
  },

  /** Permission-setup walkthrough (`TfRoleGuideModal`). */
  tfRoleGuide: {
    title: '권한 설정 가이드',
    close: '닫기',
    copy: '복사',
    intro: '자동 설치를 위해 AWS 계정에 자동 설치 권한(Role)을 등록해야 합니다.',
    step1Title: 'Step 1. AWS Console 접속',
    step1Body: 'AWS Management Console > IAM > Roles로 이동합니다.',
    step2Title: 'Step 2. Role 생성',
    step2Body: '"Create Role" 버튼을 클릭하고 다음 설정을 적용합니다:',
    step2RoleName: '자동 설치 권한(Role)',
    step3Title: 'Step 3. Policy 연결',
    step3Body: '다음 정책을 연결합니다:',
    step4Title: 'Step 4. 권한 등록 확인',
    step4Body: 'Role 생성 완료 후 아래 버튼을 클릭하여 등록 상태를 확인하세요.',
    verify: '권한 등록 확인',
    verifying: '확인 중...',
    verified: '등록 확인됨',
    notRegistered: '등록되지 않음',
  },

  /** Install-script walkthrough (`TfScriptGuideModal`). */
  tfScriptGuide: {
    title: '설치 스크립트 실행 가이드',
    close: '닫기',
    copy: '복사',
    intro: '수동 설치 모드에서는 설치 스크립트를 직접 실행해야 합니다.',
    step1Title: 'Step 1. 설치 스크립트 다운로드',
    step1Body: '설치 단계에서 설치 스크립트를 다운로드합니다.',
    step2Title: 'Step 2. 실행 환경 준비',
    step2Body: '다운로드한 파일의 압축을 해제하고 실행 환경을 준비합니다.',
    step2Cli: 'AWS CLI 인증 필요',
    step2Exec: '스크립트 실행 권한 필요',
    step3Title: 'Step 3. 스크립트 실행',
    step3Body: '다음 명령어를 순서대로 실행합니다:',
    step4Title: 'Step 4. 설치 완료 확인',
    step4Body: '스크립트 실행 완료 후, 시스템에서 자동으로 설치 상태를 확인합니다.',
    step4Delay: '설치가 반영되기까지 최대 5분이 소요될 수 있습니다.',
    warningLabel: '주의:',
    warningBody:
      '스크립트 실행 전 반드시 AWS 계정 인증이 완료되어 있어야 합니다. 잘못된 계정으로 실행 시 리소스가 다른 계정에 생성될 수 있습니다.',
  },
};

const en: typeof ko = {
  card: {
    stepTag: 'Step 4',
    title: 'Agent install',
    guidance:
      'This step installs the PII Agent on the target DBs. BDC creates the related resources on its side as well.',
    actionBefore: 'Check ',
    actionHighlight: 'the items to work on under My tasks',
    actionAfter: ', then proceed. Once every step is done, you move on to the next step.',
  },

  stepValue: {
    COMPLETED: 'Complete',
    IN_PROGRESS: 'In progress',
    FAIL: 'Failed',
    SKIP: 'Not applicable',
    BDC_INSTALL_REQUIRED: 'Waiting for BDC install',
    UNKNOWN: 'Checking',
  },

  aggregate: {
    failed: 'Failed',
    running: 'In progress',
    done: 'Complete',
    waiting: 'Waiting',
  },

  side: {
    serviceResource: 'Service-side resource creation',
    bdcResource: 'BDC-side resource creation',
    serviceApproval: 'Service-side approval',
    serviceCheck: 'Service-side check',
  },

  detail: {
    navLabel: 'Install steps',
    groupTodo: (open: number) => `My tasks (${open})`,
    groupTodoAllDone: 'All done',
    groupAuto: 'BDC in progress',
    groupReference: 'Install script',

    summaryTitle: 'Install summary',
    summaryDesc: 'Overall progress, plus everything your service needs to check, in one place.',

    statTotal: 'Total resources',
    statDone: 'Completed',
    statRunning: 'In progress',
    statFailed: 'Failed',

    nothingToCheck:
      'There is nothing for your service to check right now. BDC is handling the remaining steps, and you can follow their progress in the list on the left.',
    actionSectionTitle: 'Your service needs to check these now',
    count: (n: number) => `${n}`,
    goToStep: (title: string) => `Go to ${title}`,

    lastChecked: (at: string) => `Last checked ${at}`,
    statusCheckFailed: 'Status check failed',

    noResources: 'There are no resources to install.',
    filterEmpty: 'No results match your filters.',
    naTitle: 'No resources apply to this step',
    tableFold: (n: number) => `Resource table · ${n}`,
    naDesc: (total: number) =>
      `None of the ${total} integration ${plural(total, 'target applies', 'targets apply')} to this step, so there is nothing to do.`,
  },

  road: {
    targetSelect: 'Select target DBs',
    targetApproval: 'Pending target approval',
    applying: 'Applying approved targets',
    installing: 'Agent install',
    connectionTest: 'Connection test',
    adminApproval: 'Pending admin approval',
    complete: 'Complete',
    sdu1: 'Define integration targets',
    sdu2: 'Data upload',
    sdu3: 'SDU integration in progress',
    sdu4: 'Complete',
  },

  inline: {
    loading: (provider: string) => `Checking ${provider} install status`,
    retry: 'Try again',
    statusCheckFailed: (reason: string) => `Status check failed: ${reason}`,
    statusCheckFailedFallback: 'The most recent install status check failed.',
    confirmedLoading: 'Loading resource information',
    confirmedLoadingEllipsis: 'Loading resource information...',
    confirmedError: (message: string) => `Failed to load resource information: ${message}`,
    confirmedRetry: 'Retry',
  },

  stamp: {
    checkedAgo: (elapsed: string) => `checked ${elapsed}`,
    verifiedAgo: (elapsed: string) => `verified ${elapsed}`,
    statusCheckFailed: 'Status check failed',
    tooltip:
      'This is when the install status was last checked. What you see is the result from that moment, so it may differ from the current status.',
  },

  aws: {
    serviceTitleManual: 'Apply Terraform yourself',
    serviceTitleAuto: 'Automatic Terraform apply',
    serviceActionManual:
      "Apply the downloaded Terraform script to your service's AWS account yourself.",
    serviceDescManual:
      "Applies the downloaded Terraform script to your service's AWS account, by hand.",
    serviceDescAuto:
      'Deploys the per-resource Private Endpoint / IAM Role / Glue Policy settings automatically with Terraform.',
    serviceNoteManual: ' is where you can download the script.',
    serviceNoteAuto: ' shows the install details.',

    bdcCommonTitle: 'BDC common area',
    bdcServiceTitle: 'BDC service area',
    bdcDesc: 'BDC runs the Terraform work that configures the PII Agent.',

    referenceTitle: 'Terraform Script',
    referenceDesc: 'shows the Terraform work that step performs, so you can review it in advance.',

    permTitle: 'Terraform permission check',
    permAction:
      'Grant the IAM Role / AssumeRole permission for running Terraform on the target AWS account.',
    permDesc:
      'Verifies that the target AWS account has the IAM Role / AssumeRole permission needed to run Terraform.',

    downloadScript: 'Download Terraform Script',
    downloading: 'Downloading...',
    downloadFailed: 'Download failed. Try again in a moment.',
  },

  rolePanel: {
    awsAccount: 'AWS account',
    roleArn: 'Terraform Role',
    copy: (label: string) => `Copy ${label}`,
    findingLabel: 'Check required',
    findingAnnounce: (message: string) => `Check required. ${message}`,
    idleLead: 'Terraform permission check required',
    idleBody: 'Check now to see the permission status and what is blocking it.',
    passed: 'Nothing was blocking it when we just checked.',
    loadFailed: 'Could not load the permission check result.',
    checking: 'Checking...',
    verifyAgain: 'Check again',
    verify: 'Check permission',
    duration: 'Can take up to 30 seconds',
  },

  roleFinding: {
    fallback:
      'Permission verification failed. Check the permission settings on the target AWS account.',
    undetermined:
      'The verification result cannot be confirmed right now. This may not be a configuration problem.',
    notConfigured: 'The Terraform execution Role is not registered yet.',
    invalidArn: 'The registered Role ARN is not in a valid format.',
    notFound: 'The ARN format is valid, but the Role was not found in AWS IAM.',
    notFoundNote: 'Check that the Role still exists on the target AWS account.',
    scanNotConfigured:
      'The Scan Role must be registered before Terraform permissions can be verified.',
    scanNotConfiguredNote: 'The Terraform Role is not what is blocking this step.',
    scanNotAssumable: 'The Scan Role could not be assumed. Check the Role ARN or the trust policy.',
    scanNotAssumableNote: 'The registered Terraform Role ARN is not the cause.',
    unavailableNote: 'If you just changed IAM, check again in a moment.',
  },

  azure: {
    vmSubnetTitle: 'Create VM Subnet',
    vmSubnetDesc:
      'Creates the Subnet for VM integration. Resources that are not VMs show as Not applicable.',
    vmApplyTitle: 'Apply VM Terraform',
    vmApplyDesc: 'Applies the service-side resources needed for VM integration with Terraform.',
    bdcTitle: 'Apply BDC-side Terraform',
    bdcDesc: 'BDC runs the Terraform work that configures the PII Agent.',
    peTitle: 'Approve Private Endpoint',
    peAction: 'Approve the Private Endpoint connection BDC requested, in the Azure Portal.',
    peDesc:
      'This step approves the Private Endpoint connection BDC requested, in the Azure Portal.',
    peApproved: 'Approved',
    pePending: 'Approval required in Azure Portal',
    peFailed: 'BDC-side re-request required',
    peUnknown: 'BDC-side check required',
  },

  gcp: {
    subnetTitle: 'Create Subnet for PSC',
    subnetDesc:
      'Creates the Subnet used for the PSC (Private Service Connect) connection. One is needed per Region.',
    serviceTitle: 'Apply service-side Terraform',
    serviceDesc: "Applies the service project's resources with Terraform.",
    bdcTitle: 'Apply BDC-side Terraform',
    bdcDesc: 'BDC runs the Terraform work that configures the PII Agent.',
    pscLead:
      'Each Region needs one Regional Managed Proxy Subnet before a PSC can be created for its Cloud SQL. Run the command below in the host project, once per Region. Only the CIDR needs filling in.',
    pscCidrNote: 'The CIDR is your network range, so the screen does not pick it. Use a free /24 block in the project.',
    pscLeadAdmin:
      'Ask the service owner to create one Regional Managed Proxy Subnet per Region with the command below. It runs in the host project, and a PSC for that Region\'s Cloud SQL cannot be created until the subnet exists.',
    pscCidrNoteAdmin: 'The service side picks the CIDR, a free /24 block in their project. The screen fills in nothing.',
    pscCovers: (n: number) => `${n} Cloud SQL`,
    pscCopy: (region: string) => `Copy the ${region} command`,
  },

  tfRoleGuide: {
    title: 'Permission setup guide',
    close: 'Close',
    copy: 'Copy',
    intro:
      'To use automatic install, register the automatic-install permission (Role) on your AWS account.',
    step1Title: 'Step 1. Open the AWS Console',
    step1Body: 'Go to AWS Management Console > IAM > Roles.',
    step2Title: 'Step 2. Create the Role',
    step2Body: 'Click "Create Role" and apply the following settings:',
    step2RoleName: 'Automatic install permission (Role)',
    step3Title: 'Step 3. Attach the Policy',
    step3Body: 'Attach the following policy:',
    step4Title: 'Step 4. Confirm the permission',
    step4Body: 'Once the Role is created, click the button below to check that it is registered.',
    verify: 'Check registration',
    verifying: 'Checking...',
    verified: 'Registration confirmed',
    notRegistered: 'Not registered',
  },

  tfScriptGuide: {
    title: 'Install script guide',
    close: 'Close',
    copy: 'Copy',
    intro: 'In manual install mode you run the install script yourself.',
    step1Title: 'Step 1. Download the install script',
    step1Body: 'Download the install script from the install step.',
    step2Title: 'Step 2. Prepare the environment',
    step2Body: 'Unpack the downloaded file and prepare the environment you will run it in.',
    step2Cli: 'AWS CLI authentication required',
    step2Exec: 'Execute permission on the script required',
    step3Title: 'Step 3. Run the script',
    step3Body: 'Run the following commands in order:',
    step4Title: 'Step 4. Confirm the install',
    step4Body: 'After the script finishes, the system checks the install status automatically.',
    step4Delay: 'It can take up to 5 minutes for the install to be reflected.',
    warningLabel: 'Caution:',
    warningBody:
      'AWS account authentication must be complete before you run the script. Running it against the wrong account can create resources in another account.',
  },
};

export const INSTALL_COPY: Record<Locale, typeof ko> = { ko, en };
