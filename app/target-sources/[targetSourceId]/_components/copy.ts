import type { Locale } from '@/lib/locale';

/**
 * Fixed UI strings for the install screen's AWS page, its shared chrome (header,
 * state screens, resource-table primitives), the collab-channel card on the guide
 * rail, and the detail shell that hosts them — in both languages.
 *
 * Values that come from the contract (resource ids, engine names, regions, upstream
 * `message` fields) are NOT in here; only the chrome around them. The guide's own
 * body copy is not here either — that lives in `lib/constants/step-guide-content.ts`
 * and is out of scope.
 *
 * One file per AREA of this screen, not one per component: four other dictionaries
 * (`idc/`, `sdu/`, `layout/`, `candidate/`) cover the rest of the same route, so the
 * sub-keys below name the folders they serve.
 */
const ko = {
  aws: {
    // AwsProjectPage — the four header facts.
    notRegistered: '미등록',
    account: '계정',
    scanRole: '스캔 역할',
    terraformRole: '테라폼 역할',
    roleNotRequired: '역할 불필요',
    manualRoleHint:
      '수동 설치는 제공된 설치 스크립트를 직접 실행하므로, BDC 가 대신 수행할 Terraform 실행 Role 을 등록하지 않아요.',

    // Ec2AddModal — chrome, both steps.
    addInstance: 'EC2 인스턴스 추가',
    setConnection: '접속 정보 설정',
    editConnection: '접속 정보 수정',
    searchSubtitle: '스캔에서 발견된 EC2 인스턴스를 Instance ID로 검색해 연동 대상으로 추가해주세요.',
    configSubtitle: (instanceId: string) =>
      `${instanceId} · 데이터베이스 접속 정보를 입력해주세요.`,
    cancel: '취소',
    back: '이전',
    save: '저장',
    addDone: '추가 완료',
    close: '닫기',

    // Ec2AddModal — the connection form.
    address: '접속 주소',
    addressLabel: '접속 주소 (Private IP)',
    locked: '수정 불가',
    lockedWhy:
      'Private IP는 스캔에서 확인된 값으로 직접 수정할 수 없어요. Load Balancer를 구성해 접속하고 계시다면 담당자에게 연락 부탁드립니다.',
    dbTypePlaceholder: 'Database Type 선택…',
    requiredMark: '*필수',
    sidPlaceholder: '예: ORCL',
    portPlaceholder: '예: 3306',
    portRange: '1–65535 범위의 포트를 입력해주세요',

    // Ec2AddModal — search and its states.
    searchLabel: 'Instance ID 검색',
    searchPlaceholder: 'i-0a1b2c3d4e5f67890 형식의 Instance ID로 검색',
    clearSearch: '검색어 지우기',
    limitHint: (limit: number) => `최대 ${limit}건 표시`,
    noResults: '검색 결과가 없어요',
    noResultHint: '최근 스캔에서 발견된 인스턴스만 검색돼요',
    searching: '검색하고 있어요',
    searchError: '검색하지 못했어요',
    searchFailed: '검색에 실패했어요.',
    tryAgainLater: '잠시 후 다시 시도해주세요',
    added: '✓ 추가됨',
    noAddress: '주소 없음',
    noAddressWhy: 'Private IP가 없어 접속 주소를 만들 수 없어요',
    add: '추가',
  },

  common: {
    // ProjectPageMeta — path and the one named block.
    breadcrumb: '경로',
    installRoot: 'PII Agent 설치',
    installTarget: '설치 대상',
    intranet: '사내망',
    accountDesc: '계정 설명',
    projectDesc: '프로젝트 설명',
    targetDesc: '대상 설명',
    details: '상세 정보',
    copyFact: (label: string) => `${label} 복사`,

    /**
     * The step tag. Both numbers are `<b>` elements, so the phrase cannot be one
     * template string — it is fragments around two slots, plus the ORDER those slots
     * run in: Korean says «of N steps, step M» and English says «Step M of N».
     */
    roadCurrentFirst: false,
    roadLead: '',
    roadMid: '단계 중 ',
    roadTail: '단계',
    roadDoneLead: '',
    roadDoneTail: '단계 모두 완료',

    // ProjectPageMeta — install mode.
    installMode: '설치 모드',
    autoInstall: '자동 설치',
    manualInstall: '수동 설치',
    autoInstallTip:
      '설치 단계에서 테라폼 설치 권한을 부여하면, PASS 담당자가 테라폼 스크립트를 대신 실행해 설치해 줘요.',
    manualInstallTip: '설치 단계에서 제공되는 테라폼 스크립트를 직접 실행해 설치해야 해요.',
    modeInfo: (mode: string) => `${mode} 설명`,
    sduMethod: '연동 방식',
    sduMethodValue: '고객사가 데이터를 직접 업로드',

    // TcHeaderTag — the latest connection-test verdict.
    tcLastSuccess: '마지막 성공',
    tcLatestSuccess: '최근 테스트 성공',
    tcFailed: '테스트 실패',
    tcLatestFailed: '최근 테스트 실패',
    tcFailCount: (lead: string, count: number) => `${lead} ${count}건`,
    tcPending: '테스트 시작 대기',
    tcRunning: '테스트 진행 중',

    // ErrorState / LoadingState.
    errorTitle: '오류가 발생했어요',
    loadFallback: '연동 대상 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    confirmedLoadFailed: '연동 대상 정보를 불러오지 못했습니다.',
    backToServices: 'Service 목록으로 돌아가기',
    loading: '로딩 중...',

    // AccessDeniedState — 권한 없음은 오류가 아니라 상태라 화면이 따로다.
    accessDeniedTitle: '이 연동 대상에 접근할 권한이 없어요',
    accessDeniedBody:
      '이 대상이 속한 서비스의 접근 권한이 필요해요. 권한을 요청하면 관리자가 검토한 뒤 승인하거나 반려해요.',
    requestAccess: '권한 요청하기',
    servicesLink: 'Service 목록',

    // RejectionAlert.
    rejectedTitle: '승인 요청이 반려되었습니다',
    rejectedReason: (reason: string) => `사유: ${reason}`,
    rejectedAt: (at: string) => `반려일시: ${at}`,
  },

  collab: {
    // The card, open rail and folded tip alike.
    zoneLabel: '협업 채널',
    sentence: '막히는 부분을 바로 문의할 수 있어요.',
    loadFailed: '협업 채널 정보를 불러오지 못했어요',
    notConnected: '아직 연결된 협업 채널이 없어요',
    linkTitle: '협업 채널 — Jira에서 논의하기',

    /** Folded strip: `label` is the one word on the 56px rail, `hint` its accessible name. */
    stripChannel: '채널',
    hintError: '협업 채널 — 정보를 불러오지 못했어요',
    hintNone: '협업 채널 — 아직 연결되지 않았어요',
    hintKey: (issueKey: string) => `협업 채널 — ${issueKey}`,

    // The rail itself and its guide zone (the zone's NAME, not the guide's copy).
    guide: '가이드',
    guideStep: (step: number) => `${step}단계 가이드`,
    expandGuide: '가이드 펼치기',
    collapseGuide: '가이드 접기',
    expandHint: (zone: string) => `${zone} — 펼치기`,
    noGuide: '이 단계에는 표시할 가이드가 없습니다.',
  },

  shared: {
    // RdsInstancePanel — the cluster's member band.
    instanceBand: (clusterName: string) => `${clusterName} 접속 인스턴스 목록`,
    instance: '인스턴스',
    availabilityZone: '가용 영역',
    endpoint: '엔드포인트',
    selectInstance: (identifier: string) => `접속 인스턴스 ${identifier} 선택`,

    // ResourceIdCell.
    copy: (label: string) => `${label} 복사`,

    // ResourceGroupRow and the two count lines under a group's region.
    groupToggle: (label: string, region: string, expanded: boolean) =>
      `${label} ${region} 그룹 ${expanded ? '접기' : '펼치기'}`,
    groupUnit: '데이터베이스',
    groupTarget: '대상',
    groupExcluded: '제외',
    /**
     * «Database 총 N개 중 M개 제외». Fragments rather than one template, because both
     * numbers are styled elements and the exclusion clause carries the verdict colour.
     */
    totalLead: (kind: string) => `${kind} 총 `,
    totalUnit: '개',
    between: ' 중 ',
    excludedUnit: '개 제외',

    // async-state-views.
    retry: '다시 시도',
  },

  confirmed: {
    filterEmpty: '조건에 맞는 결과가 없어요.',
    noConfirmed: '확정된 연동 대상 DB 가 없습니다.',
  },

  detail: {
    unsupportedProvider: '지원하지 않는 클라우드 프로바이더예요.',

    // ServiceListPanel.
    navTimeout: '5초 동안 응답이 오지 않았습니다.',
    navFailed: '서버가 응답하지 못했습니다.',
    servicesFailed: '서비스 목록을 불러오지 못했습니다.',
    retry: '다시 시도',

    // ServiceMoveConfirmModal.
    moveTitle: '서비스 인프라 목록으로 이동할까요?',
    moveDesc: '선택한 서비스의 인프라 목록으로 이동합니다.',
    moveConfirm: '이동하기',
    moveFailedTitle: '이동하지 못했어요',
    moveFailedDesc: '서비스 인프라 목록을 여는 데 실패했습니다.',
  },
};

const en: typeof ko = {
  aws: {
    notRegistered: 'Not registered',
    account: 'Account',
    scanRole: 'Scan role',
    terraformRole: 'Terraform role',
    roleNotRequired: 'No role needed',
    manualRoleHint:
      'A manual install runs the provided install script directly, so there is no Terraform execution role for BDC to register and run on your behalf.',

    addInstance: 'Add an EC2 instance',
    setConnection: 'Connection details',
    editConnection: 'Edit connection info',
    searchSubtitle:
      'Search the EC2 instances the scan found by Instance ID and add one as a target.',
    configSubtitle: (instanceId: string) =>
      `${instanceId} · Enter the database connection details.`,
    cancel: 'Cancel',
    back: 'Back',
    save: 'Save',
    addDone: 'Add',
    close: 'Close',

    address: 'Connection address',
    addressLabel: 'Connection address (Private IP)',
    locked: 'Not editable',
    lockedWhy:
      'The Private IP is the value the scan found and cannot be edited here. If you connect through a Load Balancer, contact the owner.',
    dbTypePlaceholder: 'Select a Database Type…',
    requiredMark: '*Required',
    sidPlaceholder: 'e.g. ORCL',
    portPlaceholder: 'e.g. 3306',
    portRange: 'Enter a port between 1 and 65535',

    searchLabel: 'Search by Instance ID',
    searchPlaceholder: 'Search by Instance ID, e.g. i-0a1b2c3d4e5f67890',
    clearSearch: 'Clear search',
    limitHint: (limit: number) => `Showing up to ${limit}`,
    noResults: 'No search results',
    noResultHint: 'Only instances found by the latest scan are searchable',
    searching: 'Searching',
    searchError: 'Could not search',
    searchFailed: 'The search failed.',
    tryAgainLater: 'Try again in a moment',
    added: '✓ Added',
    noAddress: 'No address',
    noAddressWhy: 'There is no Private IP, so no connection address can be built',
    add: 'Add',
  },

  common: {
    breadcrumb: 'Breadcrumb',
    installRoot: 'PII Agent install',
    installTarget: 'Install target',
    intranet: 'Internal network',
    accountDesc: 'Account description',
    projectDesc: 'Project description',
    targetDesc: 'Target description',
    details: 'Details',
    copyFact: (label: string) => `Copy ${label}`,

    roadCurrentFirst: true,
    roadLead: 'Step ',
    roadMid: ' of ',
    roadTail: '',
    roadDoneLead: 'All ',
    roadDoneTail: ' steps complete',

    installMode: 'Install mode',
    autoInstall: 'Automatic install',
    manualInstall: 'Manual install',
    autoInstallTip:
      'Grant Terraform install permission at the install step and a PASS owner runs the Terraform script and installs it for you.',
    manualInstallTip:
      'You run the Terraform script provided at the install step and install it yourself.',
    modeInfo: (mode: string) => `About ${mode}`,
    sduMethod: 'Integration method',
    sduMethodValue: 'The customer uploads the data directly',

    tcLastSuccess: 'Last success',
    tcLatestSuccess: 'Latest test passed',
    tcFailed: 'Test failed',
    tcLatestFailed: 'Latest test failed',
    tcFailCount: (lead: string, count: number) => `${lead} ${count}`,
    tcPending: 'Waiting to start',
    tcRunning: 'Test running',

    errorTitle: 'Something went wrong',
    loadFallback: 'Could not load the target. Please try again in a moment.',
    confirmedLoadFailed: 'Could not load the target information.',
    backToServices: 'Back to Services',
    loading: 'Loading…',

    accessDeniedTitle: 'You don’t have access to this target',
    accessDeniedBody:
      'You need access to the service this target belongs to. Request access and an admin reviews it, then approves or rejects it.',
    requestAccess: 'Request access',
    servicesLink: 'Services',

    rejectedTitle: 'The approval request was rejected',
    rejectedReason: (reason: string) => `Reason: ${reason}`,
    rejectedAt: (at: string) => `Rejected at ${at}`,
  },

  collab: {
    zoneLabel: 'Collab channel',
    sentence: 'Ask about anything blocking you.',
    loadFailed: 'Could not load the collab channel',
    notConnected: 'No collab channel connected yet',
    linkTitle: 'Collab channel — discuss in Jira',

    stripChannel: 'Channel',
    hintError: 'Collab channel — could not load',
    hintNone: 'Collab channel — not connected yet',
    hintKey: (issueKey: string) => `Collab channel — ${issueKey}`,

    guide: 'Guide',
    guideStep: (step: number) => `Step ${step} guide`,
    expandGuide: 'Expand guide',
    collapseGuide: 'Collapse guide',
    expandHint: (zone: string) => `${zone} — expand`,
    noGuide: 'There is no guide for this step.',
  },

  shared: {
    instanceBand: (clusterName: string) => `${clusterName} connection instances`,
    instance: 'Instance',
    availabilityZone: 'Availability Zone',
    endpoint: 'Endpoint',
    selectInstance: (identifier: string) => `Select connection instance ${identifier}`,

    copy: (label: string) => `Copy ${label}`,

    groupToggle: (label: string, region: string, expanded: boolean) =>
      `${expanded ? 'Collapse' : 'Expand'} the ${label} ${region} group`,
    groupUnit: 'Database',
    groupTarget: 'Target',
    groupExcluded: 'Excluded',
    totalLead: (kind: string) => `${kind} — `,
    totalUnit: ' total',
    between: ', ',
    excludedUnit: ' excluded',

    retry: 'Try again',
  },

  confirmed: {
    filterEmpty: 'No results match your filters.',
    noConfirmed: 'There are no confirmed target DBs.',
  },

  detail: {
    unsupportedProvider: 'This cloud provider is not supported.',

    navTimeout: 'No response for 5 seconds.',
    navFailed: 'The server did not respond.',
    servicesFailed: 'Could not load the service list.',
    retry: 'Try again',

    moveTitle: 'Move to the service infrastructure list?',
    moveDesc: 'This takes you to the selected service’s infrastructure list.',
    moveConfirm: 'Move',
    moveFailedTitle: 'Could not move',
    moveFailedDesc: 'Opening the service infrastructure list failed.',
  },
};

export const TS_COPY: Record<Locale, typeof ko> = { ko, en };
