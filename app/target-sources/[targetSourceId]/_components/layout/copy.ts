import { ERROR_MESSAGES } from '@/lib/constants/messages';
import type { Locale } from '@/lib/locale';

/**
 * Fixed UI strings for the shared install shell — the step cards (2·3·5·6·7), the
 * approval table and its toolbar, and the modals that hang off them. This is the AWS
 * and Azure path: neither provider has a directory of its own, so these words are what
 * an AWS or Azure reader actually sees.
 *
 * Values that come from the contract (resource ids, regions, engine names, upstream
 * `message` fields, admin-written reasons) are NOT in here — only the chrome around them.
 *
 * A sentence that wraps one clause in emphasis is stored as `{ lead, tail }` plus the
 * emphasised token, which is itself a key: the two languages put the emphasis in
 * different places, and each declares its own halves rather than sharing a frame.
 */
const ko = {
  common: {
    ok: '확인',
    cancel: '취소',
    save: '저장',
    tryAgain: '다시 시도',
    collapse: '접기',
    expand: '펼치기',
    all: '전체',
    /** N단계 — the step tag on every card head, and the token the confirm dialogs emphasise. */
    step: (n: number): string => `${n}단계`,
    filterEmpty: '조건에 맞는 결과가 없어요.',
    genericFailure: '처리에 실패했습니다. 다시 시도해주세요.',
    requestedAt: '요청일시',
    requester: '요청자',
    /** The two-tier head both count columns stand under. */
    logicalDbGroup: '연동 논리 DB',
    /** Counting units. English drops them — see `app/notices/_components/copy.ts`. */
    unitCases: '건',
    unitItems: '개',
    unitChars: '자',
  },

  /** Step 3 — ApplyingApprovedCard. */
  applying: {
    fetchError: '반영 정보를 불러오지 못했습니다.',
    title: '연동 대상 반영중',
    badge: '반영중',
    approvedLead: '제출한 연동 대상 DB가 승인 완료됐어요.',
    approvedTail: 'PII Agent 설치에 필요한 준비를 진행하고 있어요.',
    eta: '평균 1일 이내(주말·공휴일 제외)에 완료돼요.',
    approvedAt: '승인일시',
    approver: '승인자',
  },

  /** Step 2, integration-unavailable verdict — ApprovalUnavailableCard. */
  unavailable: {
    title: '연동 대상 연동 불가',
    subtitle: '관리자가 요청하신 연동 대상을 연동할 수 없다고 판정했어요.',
    badge: '연동 불가',
    bannerStrong: '선택하신 연동 대상은 연동할 수 없습니다.',
    reasonPrefix: '사유: ',
    guidance: '연동 대상 DB 선택 단계로 돌아가 대상을 다시 구성해주세요.',
    goBack: '뒤로 이동',
    confirmTitle: '연동 불가 사유를 확인하셨나요?',
  },

  /** The step-flow confirm grammar: one cause→effect sentence around a step name. */
  rewindTo: {
    /** …로 돌아가, 연동 대상 DB 선택부터 다시 진행해요. */
    targetDb: { lead: '확인을 누르면 ', tail: '로 돌아가, 연동 대상 DB 선택부터 다시 진행해요.' },
    /** …로 돌아가, 연결 테스트부터 다시 진행해요. */
    connectionTest: { lead: '확인을 누르면 ', tail: '로 돌아가, 연결 테스트부터 다시 진행해요.' },
    /** …로 돌아가, 연동 대상 정의부터 다시 진행해요. */
    targetDefinition: { lead: '확인을 누르면 ', tail: '로 돌아가, 연동 대상 정의부터 다시 진행해요.' },
    /** 승인 요청이 취소되고, …부터 다시 진행해요. */
    afterCancel: { lead: '확인을 누르면 승인 요청이 취소되고, ', tail: '부터 다시 진행해요.' },
  },

  /** Step 5's completion-approval dialog — CloudReqApprovalModal. */
  cloudApproval: {
    successTitle: '승인 요청을 보냈어요',
    successDescription: '잠시 후 관리자 승인 대기 단계로 이동해요.',
    errorTitle: '승인 요청을 보내지 못했어요',
    errorDescription: '연결 테스트 결과와 논리 DB 설정은 그대로 남아 있어요.',
    title: '연동 완료 승인을 요청할까요?',
    descriptionStrong: (count: number): string =>
      `연동 대상 ${count}건의 연결 테스트 결과로 완료 승인을 요청해요`,
    descriptionTail:
      '. 요청 후에는 관리자 검토가 시작되고, 변경하려면 요청을 취소하고 다시 제출해야 해요.',
    confirmLabel: '요청하기',
    tileTargets: '연동 대상',
    tileLogicalDb: '연동 논리 DB',
    tileExcluded: '제외한 논리 DB',
    colLogicalDb: '연동 논리 DB',
    colExcluded: '연동 제외',
    databaseCount: (count: number): string => `데이터베이스 ${count}개`,
    countLabelTarget: '연동 논리 DB',
    countLabelExcluded: '연동 제외 논리 DB',
  },

  /** ConfirmRewindModal — the three rewinds share one dialog. */
  rewind: {
    retestTitle: '연결 테스트를 다시 실행할까요?',
    infraTitle: '인프라를 변경할까요?',
    infraNote: '이미 끝난 Agent 설치와 승인은 모두 사라져요.',
    sduRedefineTitle: '연동 대상을 수정할까요?',
    sduRedefineNote: '지금까지의 확인 내역과 등록한 S3 Access Key 수신자가 모두 사라져요.',
    reasonLabel: '초기화 사유',
    reasonPlaceholder: '예: 운영 DB를 신규 VPC로 이전해 연동 대상 구성을 다시 잡아야 합니다.',
  },

  /** useRewindStep — what failed, told in the words of the action that failed. */
  rewindFailure: {
    infra: '인프라 변경(연동 상태 초기화)에 실패했습니다.',
    retest: '연결 테스트 재실행 요청에 실패했습니다.',
    sduRedefine: '연동 대상 수정(연동 상태 초기화)에 실패했습니다.',
    infraRefresh: '인프라 변경은 처리됐지만 화면을 갱신하지 못했어요. 새로고침해 주세요.',
    retestRefresh: '연결 테스트 재실행은 처리됐지만 화면을 갱신하지 못했어요. 새로고침해 주세요.',
    sduRedefineRefresh: '연동 대상 수정은 처리됐지만 화면을 갱신하지 못했어요. 새로고침해 주세요.',
  },

  /** ConfirmedResourcesSlot. */
  confirmedSlot: {
    title: '연동 대상 정보',
    subtitle: '관리자 확정된 연동 대상 DB 목록입니다.',
  },

  /** Step 5 — ConnectionTestCard. */
  tc: {
    credentialTip:
      '해당 DB에 접속할 때 사용할 계정 정보예요. Credentials 메뉴에서 등록한 것 중에서 고르고, 불필요로 표시된 대상은 이 단계에서 지정하지 않아요.',
    credentialTipLabel: 'Credential 설명',
    colConn: '연결 상태',
    colTarget: '대상',
    colExcluded: '제외',
    colManage: '관리',
    title: '연결 테스트',
    introLead: '연동 대상 DB에 접근하기 위한 PII Agent 리소스가 생성됐어요. ',
    introStrong: 'Credential을 등록한 다음 리소스별 Key를 지정하면 연결 테스트',
    introTail: '를 진행할 수 있어요. 테스트가 모두 성공하면 완료 승인 요청을 진행할 수 있어요.',
    exclusionNote:
      'DB 내에 연동이 불필요한 논리 DB가 있다면 해당 논리 DB는 연동에서 제외할 수 있어요. 이 절차는 연결 테스트 완료 후에 진행할 수 있어요.',
    runBlocked: (missing: number): string =>
      `Credential 미설정 ${missing}건 — 지정해야 연결 테스트를 실행할 수 있습니다`,
    credChangeFailed: 'Credential 변경에 실패했습니다.',
    runHistory: '실행 이력',
    /**
     * `lib/constants/messages.ts` has no React and keeps its Korean; the render site is this
     * card, so the English lands here — the same handling `provider-mapping.ts` got in the
     * wizard, and the same two sentences the IDC step-5 card prints.
     */
    fetchFailed: ERROR_MESSAGES.TEST_CONNECTION_FETCH_FAILED as string,
    completionFetchFailed: ERROR_MESSAGES.TEST_CONNECTION_COMPLETION_FETCH_FAILED as string,
    regionFold: (region: string, open: boolean): string =>
      `${region} 데이터베이스 목록 ${open ? '접기' : '펼치기'}`,
    credEdit: (name: string, current: string): string =>
      `${name} Credential 수정 — 현재 ${current}`,
    credUnset: '미설정',
    credNotRequired: '불필요',
    countLabelTarget: (row: string): string => `${row} 연동 대상 논리 DB`,
    countLabelExcluded: (row: string): string => `${row} 연동 제외 논리 DB`,
    manageLabel: (row: string): string => `${row} 연동 논리 DB 관리하기`,
    manage: '관리하기',
  },

  /** Step 6 — ConnectionVerifiedStep. */
  verified: {
    retestFailed: '연결 테스트 재실행 요청에 실패했습니다.',
    retest: '연결 테스트 재실행',
    title: '완료 여부 관리자 승인 대기',
    badge: '승인 대기',
    guidanceStrong: 'PII Agent 설치 완료 승인을 위해 동작을 점검하고 있어요.',
    guidanceTail: '승인이 완료되면 PII Agent 연동이 완료돼요.',
    retestHintLead: '논리 DB 연동 대상을 수정하거나 연결 테스트를 다시 수행하고 싶다면 ',
    retestHintTail: '을 눌러주세요.',
  },

  /** CredentialPickModal. */
  credentialPick: {
    title: 'DB Credential 지정',
    subtitle: '사용할 DB 접속 자격 증명을 선택하세요.',
    emptyTitle: '등록된 Credential이 없어요',
    emptyDescription:
      'DB 접속 자격 증명이 아직 하나도 등록되지 않았어요. 관리자에게 등록을 요청해 주세요.',
    currentPick: '현재 선택',
    noPick: '선택된 Credential이 없어요',
    searchPlaceholder: 'User ID 또는 Credential 이름 검색',
    searchLabel: 'Credential 검색',
    selectHeader: '선택',
    nameColumn: 'Credential 이름',
    updatedColumn: '최종 수정일',
    noResults: '검색 결과가 없어요.',
  },

  /** Step 7 — InstallationCompleteStep. */
  complete: {
    actionHint: '※ 인프라 변경은 1단계, 연결 테스트 재실행은 5단계로 되돌아가 프로세스를 다시 진행해요.',
    changeInfra: '인프라 변경',
    retest: '연결 테스트 재실행',
    title: 'PII 모니터링 모듈 연동',
    badge: '연동 완료',
    guidanceStrong: 'PII Agent 연동 절차가 완료되었어요.',
    rewindLead: 'PII Agent 연동 대상 인프라가 바뀌었다면 ',
    rewindMid: '을, 연결 상태를 다시 점검하고 싶다면 ',
    rewindTail: '을 눌러 연동 절차를 다시 진행할 수 있어요.',
  },

  /** Step 2, rejected — RejectedTargetRecord. */
  rejectedRecord: {
    title: '이 요청에 포함된 연동 대상',
    open: '목록 보기',
    countAll: '전체',
    countTarget: '연동 대상',
    countExcluded: '제외',
  },

  /** Step 2, rejected — RejectionVerdict. */
  verdict: {
    processedAt: '반려일시',
    processedBy: '처리자',
    reasonTag: '반려 사유',
    noReason: '관리자가 승인 요청을 반려했어요. 연동 대상을 다시 선택한 뒤 승인을 다시 요청해주세요.',
  },

  /** TargetConfirmationInstructionCard. */
  instruction: {
    awsTitle: '수행 절차',
    otherTitle: '안내',
    awsStep1: '[리소스 스캔] 버튼을 클릭하여 AWS 계정의 RDS, S3 등 리소스를 조회하세요',
    awsStep2: '스캔 결과에서 PII Agent를 연동할 리소스를 선택하세요',
    awsStep3: 'EC2(VM) 포함이 필요한 경우 필터에서 VM 포함을 선택하세요',
    awsStep4: '선택 완료 후 [연동 대상 확정] 버튼을 클릭하세요',
    otherStep: '리소스를 스캔하고 연동할 대상을 선택한 뒤 확정해주세요',
    awsRoleNote: '리소스가 조회되지 않으면 AWS Console > IAM에서 스캔 Role이 등록되어 있는지 확인해주세요',
  },

  /** Step 2 — WaitingApprovalCard and the two buttons that dock on it. */
  waiting: {
    fetchError: '승인 요청 정보를 불러오지 못했습니다.',
    title: '연동 대상 승인 대기',
    badgePending: '승인 대기',
    badgeRejected: '반려',
    guidanceStrong: '관리자가 제출된 연동 대상 DB를 확인하고 있어요.',
    guidanceTail:
      '평균 1일 이내(주말·공휴일 제외)에 확인이 완료되며, 이슈가 없으면 다음 단계로 넘어가요. 반려된 경우, 사유를 확인한 후 다시 제출해주세요.',
    reRequestLead: '제출한 연동 대상 DB 정보를 수정하고 싶다면 ',
    reRequestTail: '를 눌러주세요.',
    cancelFailed: '승인 요청 취소에 실패했습니다. 다시 시도해주세요.',
    reRequest: '다시 요청하기',
    cancelTitle: '승인 요청을 취소할까요?',
    reselect: '연동 대상 다시 선택하기',
    reselectTitle: '반려 사유를 확인하셨나요?',
  },

  /** WaitingApprovalStats — the three tiles that double as the filter. */
  stats: {
    filterLabel: '대상 필터',
    total: '전체 요청',
    target: '연동 요청 대상',
    excluded: '연동 요청 제외대상',
  },

  /** WaitingApprovalTable — shared by steps 2·3·4·6·7 and by the IDC/admin tables. */
  table: {
    empty: '표시할 리소스가 없습니다.',
    /** 논리 DB 라는 개념이 없는 엔진의 답. */
    noLogicalDb: '설정 불필요',
    /** 같은 엔진의 `연동 제외` 칸이 내는 답 — `0개` 가 아니다. */
    noExclusion: '제외 불가',
    pillIneligible: '연동 불가',
    pillTarget: '대상',
    pillExcluded: '제외',
    colKind: '종류',
    colTarget: '대상',
    colExcluded: '제외',
    colRequested: '요청 대상 여부',
    colReason: '제외 사유',
    colStatus: '상태',
    unknownType: '유형 미상',
    instanceFold: (name: string, open: boolean): string =>
      `${name} 인스턴스 목록 ${open ? '접기' : '펼치기'}`,
    regionFold: (engine: string, region: string, open: boolean): string =>
      `${engine} ${region} 데이터베이스 목록 ${open ? '접기' : '펼치기'}`,
    countLabelTarget: (row: string): string => `${row} 연동 논리 DB 목록 보기`,
    countLabelExcluded: (row: string): string => `${row} 연동 제외 대상 보기`,
  },

  /** WaitingApprovalToolbar — the shell other tables wear too. */
  toolbar: {
    filter: '필터',
    filterOptions: '필터 옵션',
    groupFilter: (group: string): string => `${group} 필터`,
    searchPlaceholder: 'Resource ID 또는 Resource Name 검색',
    searchLabel: '리소스 검색',
  },
};

const en: typeof ko = {
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    tryAgain: 'Try again',
    collapse: 'Collapse',
    expand: 'Expand',
    all: 'All',
    step: (n: number): string => `Step ${n}`,
    filterEmpty: 'No results match your filters.',
    genericFailure: 'That did not go through. Try again.',
    requestedAt: 'Requested at',
    requester: 'Requested by',
    logicalDbGroup: 'Logical DB',
    unitCases: '',
    unitItems: '',
    unitChars: '',
  },

  applying: {
    fetchError: 'Could not load the approved targets.',
    title: 'Applying the targets',
    badge: 'Applying',
    approvedLead: 'The target DBs you submitted are approved.',
    approvedTail: 'We are preparing what PII Agent needs in order to install.',
    eta: 'This usually finishes within a day (weekends and holidays excluded).',
    approvedAt: 'Approved at',
    approver: 'Approved by',
  },

  unavailable: {
    title: 'Targets cannot be connected',
    subtitle: 'An admin decided the targets you requested cannot be connected.',
    badge: 'Ineligible',
    bannerStrong: 'The targets you selected cannot be connected.',
    reasonPrefix: 'Reason: ',
    guidance: 'Go back to the target DB step and put the targets together again.',
    goBack: 'Go back',
    confirmTitle: 'Have you read why they cannot be connected?',
  },

  rewindTo: {
    targetDb: { lead: 'Press OK to go back to ', tail: ' and start again from choosing target DBs.' },
    connectionTest: {
      lead: 'Press OK to go back to ',
      tail: ' and start again from the connection test.',
    },
    targetDefinition: {
      lead: 'Press OK to go back to ',
      tail: ' and start again from defining the targets.',
    },
    afterCancel: {
      lead: 'Press OK and the approval request is cancelled, and you start again from ',
      tail: '.',
    },
  },

  cloudApproval: {
    successTitle: 'Approval request sent',
    successDescription: 'You move to the admin approval step shortly.',
    errorTitle: 'Could not send the approval request',
    errorDescription: 'Your connection test results and Logical DB settings are unchanged.',
    title: 'Request approval to complete the integration?',
    descriptionStrong: (count: number): string =>
      `Request completion approval with the connection test results for ${count} targets`,
    descriptionTail:
      '. An admin review starts once you request it, and to change anything you have to cancel the request and submit again.',
    confirmLabel: 'Request',
    tileTargets: 'Integration targets',
    tileLogicalDb: 'Logical DB',
    tileExcluded: 'Excluded Logical DBs',
    colLogicalDb: 'Logical DB',
    colExcluded: 'Excluded',
    databaseCount: (count: number): string => `${count} databases`,
    countLabelTarget: 'Logical DB',
    countLabelExcluded: 'Excluded Logical DBs',
  },

  rewind: {
    retestTitle: 'Run the connection test again?',
    infraTitle: 'Change the infrastructure?',
    infraNote: 'The Agent install and the approval you already finished are both discarded.',
    sduRedefineTitle: 'Edit the integration targets?',
    sduRedefineNote:
      'Everything you have confirmed so far and the S3 Access Key recipients you registered are discarded.',
    reasonLabel: 'Reset reason',
    reasonPlaceholder:
      'Example: the production DB moved to a new VPC, so the target set has to be put together again.',
  },

  rewindFailure: {
    infra: 'Could not change the infrastructure (reset the integration state).',
    retest: 'Rerun connection test',
    sduRedefine: 'Could not edit the integration targets (reset the integration state).',
    infraRefresh: 'The infrastructure change went through, but the screen could not refresh. Reload the page.',
    retestRefresh:
      'The connection test re-run went through, but the screen could not refresh. Reload the page.',
    sduRedefineRefresh:
      'The target change went through, but the screen could not refresh. Reload the page.',
  },

  confirmedSlot: {
    title: 'Target information',
    subtitle: 'The target DBs an admin confirmed.',
  },

  tc: {
    credentialTip:
      'The account used to reach this DB. Pick one of the credentials registered in the Credentials menu; rows marked Not required are not set at this step.',
    credentialTipLabel: 'About Credential',
    colConn: 'Status',
    colTarget: 'Target',
    colExcluded: 'Excluded',
    colManage: 'Manage',
    title: 'Connection test',
    introLead: 'The PII Agent resources that reach your target DBs are ready. ',
    introStrong: 'Register a credential, assign a key to each resource, and the connection test',
    introTail: ' can run. Once every test succeeds you can request completion approval.',
    exclusionNote:
      'If a DB holds Logical DBs you do not need to integrate, you can exclude them. That comes after the connection test passes.',
    runBlocked: (missing: number): string =>
      `${missing} without a Credential — assign one before the connection test can run`,
    credChangeFailed: 'Could not change the credential.',
    runHistory: 'Run history',
    fetchFailed: 'Could not load the connection test results. Please try again in a moment.',
    completionFetchFailed:
      'Could not load the connection test completion status. Please try again in a moment.',
    regionFold: (region: string, open: boolean): string =>
      `${open ? 'Collapse' : 'Expand'} the database list for ${region}`,
    credEdit: (name: string, current: string): string =>
      `Edit the Credential for ${name} — currently ${current}`,
    credUnset: 'Not set',
    credNotRequired: 'Not required',
    countLabelTarget: (row: string): string => `Target Logical DBs for ${row}`,
    countLabelExcluded: (row: string): string => `Excluded Logical DBs for ${row}`,
    manageLabel: (row: string): string => `Manage the Logical DBs for ${row}`,
    manage: 'Manage',
  },

  verified: {
    retestFailed: 'Could not request a connection test rerun.',
    retest: 'Rerun connection test',
    title: 'Waiting for admin completion approval',
    badge: 'Pending',
    guidanceStrong: 'We are checking how PII Agent behaves before the install is approved as complete.',
    guidanceTail: 'Once it is approved, the PII Agent integration is done.',
    retestHintLead: 'To change which Logical DBs are integrated, or to test the connection again, press ',
    retestHintTail: '.',
  },

  credentialPick: {
    title: 'Assign a DB Credential',
    subtitle: 'Choose the DB credential to use.',
    emptyTitle: 'No Credential is registered',
    emptyDescription: 'No DB credential has been registered yet. Ask an admin to register one.',
    currentPick: 'Selected',
    noPick: 'No Credential selected',
    searchPlaceholder: 'Search by User ID or Credential name',
    searchLabel: 'Search credentials',
    selectHeader: 'Select',
    nameColumn: 'Credential name',
    updatedColumn: 'Last modified',
    noResults: 'No search results.',
  },

  complete: {
    actionHint:
      '※ Change infrastructure goes back to Step 1 and Rerun the connection test goes back to Step 5, and the process runs again from there.',
    changeInfra: 'Change infrastructure',
    retest: 'Rerun connection test',
    title: 'PII monitoring module integration',
    badge: 'Integration complete',
    guidanceStrong: 'The PII Agent integration is complete.',
    rewindLead: 'If the infrastructure PII Agent covers has changed, press ',
    rewindMid: '. To check the connection again, press ',
    rewindTail: '. Either one starts the integration process over.',
  },

  rejectedRecord: {
    title: 'Targets in this request',
    open: 'View list',
    countAll: 'All',
    countTarget: 'Integration targets',
    countExcluded: 'Excluded',
  },

  verdict: {
    processedAt: 'Rejected at',
    processedBy: 'Processed by',
    reasonTag: 'Rejection reason',
    noReason: 'An admin rejected the approval request. Choose the targets again and request approval again.',
  },

  instruction: {
    awsTitle: 'What to do',
    otherTitle: 'Notice',
    awsStep1: 'Click [Scan resources] to list the RDS, S3 and other resources in the AWS account',
    awsStep2: 'Pick the resources to connect the PII Agent to from the scan results',
    awsStep3: 'If you need EC2 (VM) included, choose Include VM in the filter',
    awsStep4: 'When the selection is done, click [Confirm targets]',
    otherStep: 'Scan the resources, pick the targets to connect, and confirm them',
    awsRoleNote:
      'If no resources come back, check in AWS Console > IAM that the scan Role is registered',
  },

  waiting: {
    fetchError: 'Could not load the approval request.',
    title: 'Waiting for target approval',
    badgePending: 'Pending',
    badgeRejected: 'Rejected',
    guidanceStrong: 'An admin is reviewing the target DBs you submitted.',
    guidanceTail:
      'Review usually finishes within a day (weekends and holidays excluded), and you move to the next step if nothing comes up. If it is rejected, read the reason and submit again.',
    reRequestLead: 'To change the target DBs you submitted, press ',
    reRequestTail: '.',
    cancelFailed: 'Could not cancel the approval request. Try again.',
    reRequest: 'Try again',
    cancelTitle: 'Cancel the approval request?',
    reselect: 'Choose targets again',
    reselectTitle: 'Have you read the rejection reason?',
  },

  stats: {
    filterLabel: 'Target filter',
    total: 'Total',
    target: 'Targets',
    excluded: 'Excluded',
  },

  table: {
    empty: 'No resources to show.',
    noLogicalDb: 'Not needed',
    noExclusion: 'Cannot exclude',
    /**
     * `Ineligible`, not `Cannot connect`. Two reasons, and the second is a hard constraint.
     *
     * It is the verdict column — `Target` / `Excluded` / `Ineligible` are one register, and
     * the codebase already calls this state `ineligible` (`INSTALL_INELIGIBLE`). "Cannot
     * connect" names a reason, and not always the right one.
     *
     * And it has to fit: `APPROVAL_COLUMN_WIDTHS.target` is 116, measured against the KOREAN
     * header. Measured in the browser at 14px semibold with the icon and its 6px gap —
     * `Cannot connect` needs 119.48 + 36 padding + the 1px rail = 156.48 and overflowed the
     * cell by 39.5px; `Ineligible` needs 112.32 and clears it. For scale, `Excluded` ships
     * with 1.74px of room, so this is not the tight one.
     */
    pillIneligible: 'Ineligible',
    pillTarget: 'Target',
    pillExcluded: 'Excluded',
    colKind: 'Kind',
    colTarget: 'Target',
    colExcluded: 'Excluded',
    colRequested: 'Requested',
    colReason: 'Reason',
    colStatus: 'Status',
    unknownType: 'Unknown type',
    instanceFold: (name: string, open: boolean): string =>
      `${open ? 'Collapse' : 'Expand'} the instance list for ${name}`,
    regionFold: (engine: string, region: string, open: boolean): string =>
      `${open ? 'Collapse' : 'Expand'} the ${engine} ${region} database list`,
    countLabelTarget: (row: string): string => `View the Logical DBs for ${row}`,
    countLabelExcluded: (row: string): string => `View what is excluded for ${row}`,
  },

  toolbar: {
    filter: 'Filter',
    filterOptions: 'Filter options',
    groupFilter: (group: string): string => `${group} filter`,
    searchPlaceholder: 'Search by Resource ID or Resource Name',
    searchLabel: 'Search resources',
  },
};

export const LAYOUT_COPY: Record<Locale, typeof ko> = { ko, en };

/** So a module-level helper can take the dictionary as a typed parameter. */
export type LayoutCopy = typeof ko;
