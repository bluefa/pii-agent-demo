import type { Locale } from '@/lib/locale';
import { plural } from '@/lib/plural';

/**
 * Fixed UI strings for the top nav, the service list, the access-request screen
 * and the infrastructure-registration wizard, in both languages. Values that come
 * from the contract (service names, codes, reasons, timestamps) are not in here —
 * only the chrome around them.
 *
 * One file rather than one per screen: the shared parts (the service rail, the
 * v7 infra rows, the access modals) render on more than one of these surfaces,
 * and a per-screen dictionary would have had to pick an owner for them.
 */
const ko = {
  // Shared beyond these surfaces — the TqModal shell that carries them is
  // used across the admin screens too.
  common: {
    close: '닫기',
    retryRequest: '다시 요청하기',
    stay: '머무르기',
    pagerShow: '표시',
    pagerPer: '건씩',
    pagerPerPage: '페이지당 표시 건수',
    pagerOf: '/ 전체',
    pagerUnit: '건',
    firstPage: '처음 페이지',
    lastPage: '끝 페이지',
    pageN: (n: number) => `${n} 페이지`,
    prevPage: '이전 페이지',
    nextPage: '다음 페이지',
    badTargetSourceId: '주소의 연동 대상 번호가 올바르지 않아요.',
    targetSourceNotFound:
      '요청하신 연동 대상을 찾을 수 없어요. 삭제되었거나 주소가 잘못되었을 수 있어요.',
    // Defaults owned by the shared primitives under `app/components/ui/**`. They
    // render inside every modal and table in the app, so they belong to no one
    // screen and the namespace that carries them cannot be a screen's either.
    retry: '다시 시도',
    loading: '불러오는 중…',
    noData: '데이터가 없습니다.',
    noHistory: '이력이 없습니다.',
    selected: '선택됨',
    instanceCount: (total: number) => `인스턴스 ${total}건`,
    exclusionReason: '제외 사유',
    // Shared by three admin surfaces (the service-detail target card, the ops
    // masthead partition tag, the role modal's region label), so it belongs to
    // none of them. Not `services.chinaRegion` — that key is the longer
    // `중국 리전` / `China region` wording the /services list uses.
    china: '중국',
    notifications: '알림',
    help: '도움말',
    copyValue: (value: string) => `${value} 복사`,
    resizeColumn: (label: string) => `${label} 열 너비 조절`,
  },

  nav: {
    services: '서비스 목록',
    help: '도움말',
    notReady: (label: string) => `${label} — 준비 중입니다`,
    account: (name: string) => `${name} 계정`,
    accountInfo: '계정 정보',
    myAccessRequests: '내 권한 요청',
    admin: '관리자',
  },

  services: {
    // rail
    railTitle: '서비스 목록',
    searchPlaceholder: '서비스 이름 또는 코드',
    searchLabel: '서비스 검색',
    clearSearch: '검색어 지우기',
    searchResults: '검색 결과',
    noSearchMatch: (query: string) => `‘${query}’와 일치하는 서비스가 없습니다`,
    noServices: '서비스가 없습니다',
    railAccessHint: '담당 시스템/서비스가 조회되지 않나요?',
    prevPage: '이전 페이지',
    nextPage: '다음 페이지',

    // no-access panel / placeholder
    loadingService: '서비스 정보를 불러오는 중',
    noAccessTitle: '아직 접근 권한이 있는 서비스가 없습니다',
    noAccessBody1: '담당하시는 서비스가 있다면 권한 요청을 해주세요.',
    noAccessBody2: '관리자가 확인 후 승인해드립니다.',
    requestAccess: '권한 요청하기',
    selectService: '서비스를 선택하세요',

    // header
    headerTitle: 'PII Agent 연동 대상 계정',
    headerSubtitleBefore: '',
    headerSubtitleAfter: '를 설치할 계정을 등록하고, 계정별 설치 진행을 관리합니다.',
    serviceNameLabel: '서비스 이름',
    eos: '서비스 미운영 EOS',
    inService: '운영 중',
    addInfra: '인프라 등록',

    // infra rows
    rowsLoading: '연동 대상 계정 목록을 불러오는 중',
    rowsFailed: '연동 대상 계정을 불러오지 못했습니다',
    retry: '다시 시도',
    rowsTitle: '연동 대상 계정',
    rowsEmpty: '등록된 인프라가 없습니다.',
    selfUpload: '서비스 담당자가 데이터를 직접 업로드',
    idcInfra: 'IDC 인프라',
    intranet: '사내망',
    chinaRegion: '중국 리전',
    installMode: '설치 모드',
    autoInstall: '자동 설치',
    manualInstall: '수동 설치',
    description: '설명',
    rowMenu: (name: string) => `${name} 추가 작업`,
    viewDetail: '상세 보기',
    editDescription: '설명 수정',
    copyTargetSourceId: 'Target Source ID 복사',
    deleteAccount: '계정 삭제',

    // toasts
    listFailed: '서비스 목록을 불러오지 못했습니다.',
    projectsFailed: '연동 대상 계정을 불러오지 못했습니다.',
    projectsRefreshFailed: '연동 대상 계정을 새로고침하지 못했습니다.',
    retryHint: '잠시 후 다시 시도해 주세요.',
    idCopied: (id: string) => `Target Source ID ${id} 복사됨`,
    copyFailed: '클립보드 복사 실패',
    deleteNotImplemented: '삭제 미구현',
    descriptionSaved: '설명을 저장했습니다.',

    // description modal
    descModalTitle: '설명 수정',
    descModalSubtitle:
      '이 연동 대상이 무엇인지 한 줄로 적어 두면 목록에서 계정을 구분하기 쉬워요.',
    save: '저장',
    cancel: '취소',
    descPlaceholder: '예: Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치',
    descClears: '비워 두고 저장하면 설명이 지워집니다.',
    descSaveFailed: '설명을 저장하지 못했습니다. 문제가 계속되면 담당자에게 알려 주세요.',
    charUnit: '자',

    // counts and pagination
    count: (n: number | string) => `${n}건`,
    railPageOf: (current: number, total: number) => `${current} / ${total} 페이지`,
    rowsPageOf: (current: number, total: number) => `${current}/${total} 페이지`,
  },

  access: {
    // counts row
    rejected: '반려',
    pending: '대기',
    approved: '승인',
    count: (n: number | string) => `${n}건`,

    // tabs
    tabsLabel: '내 권한 요청 탭',
    tabOwned: '내가 접근할 수 있는 서비스',
    tabRequestable: '요청할 수 있는 서비스',
    tabMine: '내 요청 내역',

    // section captions
    ownedCaption: '이미 권한이 있어 바로 들어갈 수 있는 서비스예요',
    requestableCaption:
      '아직 접근 권한이 없는 서비스예요 — 사유를 적어 요청하면 관리자가 검토해요',
    serviceSearch: '서비스 코드/이름 검색',

    // columns
    colCode: '서비스 코드',
    colName: '서비스 이름',
    colReason: '요청 사유',
    colStatus: '상태',
    colRequestedAt: '요청 일시',

    // empty states
    loadingList: '목록을 불러오는 중',
    listOf: (title: string) => `${title} 목록`,
    retry: '재시도',
    noSearchResult: '검색 결과가 없어요',
    noSearchResultRequestable: '이미 권한이 있거나 요청해 둔 서비스는 여기 나오지 않아요',
    noSearchResultOwned: '권한이 있는 서비스 중에는 검색어와 맞는 것이 없어요',
    nothingToRequest: '요청할 서비스가 없어요',
    nothingToRequestCaption: '모든 서비스에 권한이 있거나, 이미 요청해 두었어요',
    noAccessibleService: '접근할 수 있는 서비스가 없어요',
    pickOnRequestTab: "'요청할 수 있는 서비스' 탭에서 골라 권한을 요청해 보세요",
    noRequestsYet: '요청한 내역이 없어요',
    noRequestsYetLong:
      '아직 요청한 권한이 없어요 — ‘요청할 수 있는 서비스’ 탭에서 골라 요청해 보세요',

    // row actions
    viewOwners: '담당자 보기',
    noOwners: '담당자 없음',
    requestAccess: '권한 요청',
    requestAgain: '다시 요청',
    requested: (serviceName: string) => `${serviceName} 접근 권한을 요청했어요`,

    // status pills
    pillPending: '승인 대기',
    statusOwned: '접근 가능',
    pillApproved: '승인',
    pillRejected: '반려',
    historyApproved: '요청 승인',
    historyRejected: '요청 반려',
    historyRequested: '요청 접수',
    historyGranted: '직접 부여',
    historyRevoked: '권한 해제',
    historyAdminGranted: '관리자 부여',
    historyAdminRevoked: '관리자 회수',

    // modals
    cancel: '취소',
    requestTitle: '접근 권한 요청',
    requestSubtitle:
      '관리자가 검토한 뒤 승인하거나 반려해요. 결과는 내 요청 내역에서 확인할 수 있어요.',
    requestReasonLabel: '요청 사유 · 필수',
    requestReasonPlaceholder: '어떤 업무 때문에 이 서비스 접근이 필요한지 적어 주세요',
    request: '요청',

    ownersTitle: '담당자 확인',
    ownersSubtitle: '이 서비스에 권한이 있는 사람들이에요.',
    ownersSearchPlaceholder: 'Knox ID 검색',
    ownersSearchLabel: '담당자 검색',
    ownersNoMatch: (query: string) => `‘${query}’와 일치하는 담당자가 없습니다`,
    ownersNamesMissing: (count: number) => `담당자 ${count}명이 있지만 이름이 오지 않았어요`,
    ownerCount: (n: number) => `${n}명`,
    ownersHidden: (n: number) => `여기 없는 담당자가 ${n}명 더 있어요`,
    ownersLookupMissed: '담당자를 찾지 못했어요. 다시 시도해 주세요',

    userSearchPlaceholder: 'Knox ID · 이메일 검색',
    userSearchLabel: '사용자 검색',
    userSearchPrompt: 'Knox ID 나 이메일로 검색해 주세요',
    searching: '찾는 중이에요',
    noResults: '검색 결과가 없어요',
    pickedCount: (n: number) => `${n}명 선택됨`,

    approveTitle: '접근 권한 요청 승인',
    approveSubtitle: (subject: string) =>
      `${subject}을 승인해요. 승인하는 즉시 해당 서비스 권한이 부여돼요.`,
    approveMessageLabel: '승인 메시지 · 선택',
    approveMessagePlaceholder: '요청자에게 전달할 메시지를 남길 수 있어요',
    approve: '승인',

    rejectTitle: '접근 권한 요청 반려',
    rejectSubtitle: (subject: string) =>
      `${subject}을 반려해요. 사유는 요청자에게 그대로 전달돼요.`,
    rejectReasonLabel: '반려 사유 · 필수',
    rejectReasonPlaceholder: '요청자가 무엇을 보완해 다시 요청해야 하는지 적어 주세요',
    reject: '반려',
  },

  // The 인프라 등록 wizard — the modal shell and its rail, plus the five step bodies.
  // Provider names, cloud console hostnames and DB type names are not in here: they
  // are contract values that read the same in both languages.
  wizard: {
    // shell — ProjectCreateModal, WizardRail
    title: '인프라 등록',
    subtitle: 'PII 모니터링할 인프라를 등록해요.',
    navLabel: '등록 단계',
    back: '이전',
    next: '다음',
    register: '등록하기',
    registering: '등록 중…',
    retry: '다시 시도',
    close: '닫기',
    configFailed: '연동 구성을 확인하지 못했어요.',
    registerFailed: '등록 실패',
    stepDone: '완료',
    stepActive: '진행 중',
    stepWaiting: '대기',

    // exit confirm
    quitTitle: '등록을 그만두시겠어요?',
    quitBody: '지금 닫으면 입력한 내용이 사라져요.',
    quitStay: '계속 작성',
    quitClose: '닫기',

    // rail steps
    step1Title: '클라우드 계정',
    step1Sub: '운영 환경 선택',
    step2Title: '계정 정보',
    step2Sub: '연결할 계정 입력',
    step3Title: '사용하는 Database 확인',
    step3Sub: '운영 중인 DB 선택',
    step4Title: '등록 내용 확인',
    step4Sub: '연동 구성 확인',
    step5Title: '등록 결과',
    step5Sub: '완료',

    // step 1 — cloud account. The console hostname is appended at the call site,
    // so the two region descriptions stay whole sentences here.
    s1Title: '어떤 클라우드를 사용하시나요?',
    s1Sub: '운영 환경에 맞는 연동 방식을 안내해 드려요.',
    cloudChoice: '클라우드 선택',
    region: '운영 리전',
    regionChinaDesc: '중국 계정인 경우 선택해 주세요.',
    regionGlobalDesc: '글로벌 상용 계정인 경우 선택해 주세요.',
    chinaOnly: '중국 지역에서 운영 중인 경우에만 선택해 주세요',
    // Names step 4 — this quoted step name has to stay identical to `step4Title`.
    s1Footer:
      '입력하신 내용을 바탕으로 알맞은 PII 모니터링 연동 방식을 안내해 드려요. 「등록 내용 확인」 단계에서 확인할 수 있어요.',

    // step 2 — account details
    s2TitleCsp: '계정 정보를 알려주세요',
    s2TitleOther: '인프라 정보를 알려주세요',
    s2Sub: '연결할 계정을 확인하는 데 사용해요.',
    installMethod: '설치 방식',
    manualInstall: '수동 설치',
    manualInstallDesc: '제공되는 테라폼 스크립트를 직접 실행하여 설치하는 방식이에요.',
    autoInstall: '자동 설치',
    autoInstallDesc:
      'PASS 담당자에게 테라폼 설치 권한을 부여하면, PASS 담당자가 테라폼 스크립트를 직접 실행해 설치해 주는 방식이에요.',

    // step 3 — databases. Korean puts the scope first and English puts it last, so the
    // sentence is one function of the scope rather than two fragments around it.
    s3Title: '사용 중인 Database를 확인해 주세요',
    s3Sub: (scope: string) => `${scope}에서 사용 중인 Database를 모두 선택해 주세요.`,
    s3SubTail: '선택 개수와 등록 건수는 무관해요.',
    s3Scope: '해당 환경',
    s3Aria: '사용 중인 Database',
    othersHint: '목록에 없는 Database를 사용하고 있어요',
    dbNotFound: '찾으시는 DB가 없으신가요?',
    pickOthers: 'Others로 선택 →',
    s3Error: '사용 중인 Database를 1개 이상 선택해 주세요. 목록에 없다면 Others를 선택해 주세요.',
    s3Footer: '선택하신 Database는 PII 모니터링 연동 방식을 판단하는 데 사용해요.',

    // step 4 — review
    s4Title: '이대로 등록할까요?',
    s4Sub: '입력하신 내용으로 아래 연동 구성을 추천해요.',
    s4Loading: '연동 구성을 확인하는 중',
    s4Count: (n: number) => `총 ${n}개의 계정이 등록됩니다.`,
    s4Footer: '구성이 예상과 다르다면 이전 단계로 돌아가 입력을 수정할 수 있어요.',

    // step 5 — result
    s5Done: '등록 완료',
    s5Failed: '등록 실패',
    s5Busy: '등록 중',
    s5TitleDone: '등록을 완료했어요',
    s5TitleBusy: '인프라를 등록하고 있어요',
    s5SubDone: '등록이 끝났어요.',
    s5SubBusy: '계정 연결과 자격증명 검증을 진행해요. 잠시만 기다려 주세요.',
    s5AllOk: '모든 인프라가 등록됐어요. 목록에서 연동 진행 상황을 확인할 수 있어요.',
    s5SomeFailed: '일부 인프라 등록에 실패했어요. 닫고 다시 시도해주세요.',

    // candidate card
    sduGloss:
      'Self Data Upload — PII Agent를 설치하는 대신, 데이터를 직접 업로드해 모니터링하는 방식이에요.',
    other: '기타',
    chinaRegion: '중국 리전',
    installMode: '설치 모드',
    description: '설명',
    alreadyRegistered: '이미 등록된 계정이라 제외돼요.',
    sduRecommended:
      'PII Agent 설치 방식을 지원하지 않는 Region·Cloud·Database가 포함되어 있어 Self Data Upload 방식을 추천했어요.',
    agentInstall: '선택하신 계정에 PII Agent를 설치해 모니터링해요.',
    sduAccount: 'Self Data Upload 계정',
    accountOf: (label: string) => `${label} 계정`,
    sduUploadGloss: '서비스 담당자가 데이터를 직접 업로드',
    idcInfra: 'IDC 인프라',
    intranet: '사내망',
    otherInfra: '기타 인프라',
    otherEnv: '그 외 환경',

    // credential fields. The description placeholder is a whole sentence per subject
    // rather than a shared frame plus a subject fragment — the two languages put that
    // subject in different places.
    optional: '(선택)',
    descLabel: '설명',
    infraDescLabel: '인프라 설명',
    descPlaceholderAccount: '해당 계정을 식별할 수 있는 설명을 입력해 주세요',
    descPlaceholderInfra: '이 인프라를 식별할 수 있는 설명을 입력해 주세요',
    descHelper: 'N-IRP/SW-PLM 과제라면 과제 코드를 입력해 주세요',
    awsPayerHelper: 'AWS 조직의 결제 계정 ID(숫자 12자리) — 콘솔 우상단 계정 메뉴에서 확인',
    awsMemberHelper:
      '리소스가 있는 하위 계정 ID(숫자 12자리) — 하위 계정을 쓰지 않으면 Payer Account와 같은 값',
    azureTenantHelper: 'Microsoft Entra ID의 테넌트 식별자',
    azureSubHelper: '연결할 구독의 식별자',
    gcpProjectHelper: 'Project Number가 아닌 Project ID를 입력해 주세요',
    required: (label: string) => `${label}을(를) 입력해 주세요`,
    aws12Digits: '12자리 숫자를 입력하세요',
    badGuid: 'GUID 형식이 올바르지 않습니다 (예: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',

    // provider cards. `lib/constants/provider-mapping.ts` has no React and keeps its
    // Korean defaults; these are read at the render site instead.
    idcLabel: 'IDC',
    idcDesc: '사내 데이터 센터',
    otherLabel: '기타',
    otherDesc: '그 외 환경',
  },
};

const en: typeof ko = {
  common: {
    close: 'Close',
    retryRequest: 'Try again',
    stay: 'Stay',
    pagerShow: 'Show',
    pagerPer: 'per page',
    pagerPerPage: 'Rows per page',
    pagerOf: 'of',
    pagerUnit: '',
    firstPage: 'First page',
    lastPage: 'Last page',
    pageN: (n: number) => `Page ${n}`,
    prevPage: 'Previous page',
    nextPage: 'Next page',
    badTargetSourceId: 'That target-source number in the address is not valid.',
    targetSourceNotFound:
      'We could not find that target source. It may have been deleted, or the address may be wrong.',
    retry: 'Try again',
    loading: 'Loading…',
    noData: 'No data.',
    noHistory: 'No history.',
    selected: 'Selected',
    // English counts a noun, so the noun has to agree; Korean has no plural for
    // `건` to lose. Through the shared `plural` helper like the three other counted
    // nouns in this file (`ownersNamesMissing`, `ownersHidden`, `s4Count`), so the
    // whole dictionary states its agreement the one way.
    instanceCount: (total: number) => `${total} ${plural(total, 'instance', 'instances')}`,
    exclusionReason: 'Exclusion reason',
    china: 'China',
    notifications: 'Notifications',
    help: 'Help',
    copyValue: (value: string) => `Copy ${value}`,
    resizeColumn: (label: string) => `Resize ${label} column`,
  },

  nav: {
    services: 'Services',
    help: 'Help',
    notReady: (label: string) => `${label} — coming soon`,
    account: (name: string) => `${name} account`,
    accountInfo: 'Account',
    myAccessRequests: 'My access requests',
    admin: 'Admin',
  },

  services: {
    railTitle: 'Services',
    searchPlaceholder: 'Service name or code',
    searchLabel: 'Search services',
    clearSearch: 'Clear search',
    searchResults: 'Search results',
    noSearchMatch: (query: string) => `No service matches ‘${query}’`,
    noServices: 'No services',
    railAccessHint: 'Can’t find the system or service you own?',
    prevPage: 'Previous page',
    nextPage: 'Next page',

    loadingService: 'Loading service information',
    noAccessTitle: 'You don’t have access to any service yet',
    noAccessBody1: 'If you own a service, request access to it.',
    noAccessBody2: 'An administrator reviews the request and approves it.',
    requestAccess: 'Request access',
    selectService: 'Select a service',

    headerTitle: 'PII Agent target accounts',
    headerSubtitleBefore: 'Register the accounts ',
    headerSubtitleAfter: ' is installed on, and track each account’s progress.',
    serviceNameLabel: 'Service name',
    eos: 'End of service (EOS)',
    inService: 'In service',
    addInfra: 'Register infrastructure',

    rowsLoading: 'Loading target accounts',
    rowsFailed: 'Could not load the target accounts',
    retry: 'Try again',
    rowsTitle: 'Target accounts',
    rowsEmpty: 'No infrastructure registered yet.',
    selfUpload: 'The service owner uploads the data directly',
    idcInfra: 'IDC infrastructure',
    intranet: 'Internal network',
    chinaRegion: 'China region',
    installMode: 'Install mode',
    autoInstall: 'Automatic install',
    manualInstall: 'Manual install',
    description: 'Description',
    rowMenu: (name: string) => `More actions for ${name}`,
    viewDetail: 'View details',
    editDescription: 'Edit description',
    copyTargetSourceId: 'Copy Target Source ID',
    deleteAccount: 'Delete account',

    listFailed: 'Could not load the service list.',
    projectsFailed: 'Could not load the target accounts.',
    projectsRefreshFailed: 'Could not refresh the target accounts.',
    retryHint: 'Please try again in a moment.',
    idCopied: (id: string) => `Target Source ID ${id} copied`,
    copyFailed: 'Could not copy to the clipboard',
    deleteNotImplemented: 'Delete is not implemented yet',
    descriptionSaved: 'Description saved.',

    descModalTitle: 'Edit description',
    descModalSubtitle:
      'One line about what this target is makes accounts easier to tell apart in the list.',
    save: 'Save',
    cancel: 'Cancel',
    descPlaceholder: 'e.g. PII Agent on Azure SQL, PostgreSQL and MySQL resources',
    descClears: 'Saving it empty clears the description.',
    descSaveFailed:
      'Could not save the description. If this keeps happening, let your administrator know.',
    charUnit: '',

    count: (n: number | string) => `${n}`,
    railPageOf: (current: number, total: number) => `Page ${current} of ${total}`,
    rowsPageOf: (current: number, total: number) => `Page ${current} of ${total}`,
  },

  access: {
    rejected: 'Rejected',
    pending: 'Pending',
    approved: 'Approved',
    count: (n: number | string) => `${n}`,

    tabsLabel: 'My access request tabs',
    tabOwned: 'Services I can access',
    tabRequestable: 'Services I can request',
    tabMine: 'My requests',

    ownedCaption: 'Services you already have access to',
    requestableCaption:
      'Services you don’t have access to yet — write a reason and an administrator reviews it',
    serviceSearch: 'Search by service code or name',

    colCode: 'Service code',
    colName: 'Service name',
    colReason: 'Reason',
    colStatus: 'Status',
    colRequestedAt: 'Requested at',

    loadingList: 'Loading list',
    listOf: (title: string) => `${title} list`,
    retry: 'Try again',
    noSearchResult: 'No search results',
    noSearchResultRequestable:
      'Services you already have or have already requested are not listed here',
    noSearchResultOwned: 'None of the services you can access match your search',
    nothingToRequest: 'Nothing left to request',
    nothingToRequestCaption:
      'You already have access to every service, or have already requested it',
    noAccessibleService: 'You can’t access any service yet',
    pickOnRequestTab: 'Pick one on the “Services I can request” tab and request access',
    noRequestsYet: 'You haven’t requested anything yet',
    noRequestsYetLong:
      'You haven’t requested access to anything yet — pick a service on the “Services I can request” tab',

    viewOwners: 'View owners',
    noOwners: 'No owners',
    requestAccess: 'Request access',
    requestAgain: 'Request again',
    requested: (serviceName: string) => `Requested access to ${serviceName}`,

    pillPending: 'Pending',
    statusOwned: 'Has access',
    pillApproved: 'Approved',
    pillRejected: 'Rejected',
    historyApproved: 'Request approved',
    historyRejected: 'Request rejected',
    historyRequested: 'Request submitted',
    historyGranted: 'Granted directly',
    historyRevoked: 'Access revoked',
    historyAdminGranted: 'Granted by admin',
    historyAdminRevoked: 'Revoked by admin',

    cancel: 'Cancel',
    requestTitle: 'Request access',
    requestSubtitle:
      'An administrator reviews it and approves or rejects it. The result shows up on My requests.',
    requestReasonLabel: 'Reason · required',
    requestReasonPlaceholder: 'Explain what work needs access to this service',
    request: 'Request',

    ownersTitle: 'Service owners',
    ownersSubtitle: 'These people have access to this service.',
    ownersSearchPlaceholder: 'Search Knox ID',
    ownersSearchLabel: 'Search owners',
    ownersNoMatch: (query: string) => `No owner matches ‘${query}’`,
    ownersNamesMissing: (count: number) =>
      `This service has ${count} ${plural(count, 'owner', 'owners')}, but their ${plural(count, 'name', 'names')} did not arrive`,
    ownerCount: (n: number) => `${n}`,
    ownersHidden: (n: number) =>
      `${n} more ${plural(n, 'owner is', 'owners are')} not listed here`,
    ownersLookupMissed: 'Could not find the owners. Please try again',

    userSearchPlaceholder: 'Search Knox ID or email',
    userSearchLabel: 'Search users',
    userSearchPrompt: 'Search by Knox ID or email',
    searching: 'Searching',
    noResults: 'No search results',
    pickedCount: (n: number) => `${n} selected`,

    approveTitle: 'Approve access request',
    approveSubtitle: (subject: string) =>
      `Approve ${subject}. Access is granted the moment you approve.`,
    approveMessageLabel: 'Message · optional',
    approveMessagePlaceholder: 'You can leave a message for the requester',
    approve: 'Approve',

    rejectTitle: 'Reject access request',
    rejectSubtitle: (subject: string) =>
      `Reject ${subject}. The reason is passed to the requester as written.`,
    rejectReasonLabel: 'Reason · required',
    rejectReasonPlaceholder: 'Say what the requester should fix before requesting again',
    reject: 'Reject',
  },

  wizard: {
    title: 'Register infrastructure',
    subtitle: 'Register the infrastructure you want PII monitoring on.',
    navLabel: 'Registration steps',
    back: 'Back',
    next: 'Next',
    register: 'Register',
    registering: 'Registering…',
    retry: 'Try again',
    close: 'Close',
    configFailed: 'Could not check the setup.',
    registerFailed: 'Registration failed',
    stepDone: 'Done',
    stepActive: 'In progress',
    stepWaiting: 'Waiting',

    quitTitle: 'Stop registering?',
    quitBody: 'Closing now discards what you entered.',
    quitStay: 'Keep editing',
    quitClose: 'Close',

    step1Title: 'Cloud account',
    step1Sub: 'Choose the environment',
    step2Title: 'Account details',
    step2Sub: 'Enter the account',
    step3Title: 'Databases in use',
    step3Sub: 'Select your databases',
    step4Title: 'Review',
    step4Sub: 'Check the setup',
    step5Title: 'Result',
    step5Sub: 'Done',

    s1Title: 'Which cloud do you use?',
    s1Sub: 'We suggest the setup that fits your environment.',
    cloudChoice: 'Choose a cloud',
    region: 'Region',
    regionChinaDesc: 'Choose this for a China account.',
    regionGlobalDesc: 'Choose this for a global commercial account.',
    chinaOnly: 'Select this only if you operate in the China region',
    s1Footer:
      'From what you enter we suggest a PII monitoring setup. You can check it at the “Review” step.',

    s2TitleCsp: 'Tell us about the account',
    s2TitleOther: 'Tell us about the infrastructure',
    s2Sub: 'We use this to identify the account to connect.',
    installMethod: 'Install method',
    manualInstall: 'Manual install',
    manualInstallDesc: 'You run the Terraform script we provide yourself.',
    autoInstall: 'Automatic install',
    autoInstallDesc:
      'Grant the PASS team permission to run Terraform, and they run the script and install it for you.',

    s3Title: 'Which databases do you use?',
    s3Sub: (scope: string) => `Select every database you use in ${scope}.`,
    s3SubTail: 'How many you pick does not change how many accounts get registered.',
    s3Scope: 'this environment',
    s3Aria: 'Databases in use',
    othersHint: 'I use a database that is not on the list',
    dbNotFound: 'Can’t find your database?',
    pickOthers: 'Pick Others →',
    s3Error: 'Select at least one database. If yours is not on the list, choose Others.',
    s3Footer: 'We use your selection to decide the PII monitoring setup.',

    s4Title: 'Register this?',
    s4Sub: 'From what you entered, we recommend the setup below.',
    s4Loading: 'Checking the setup',
    s4Count: (n: number) => `${n} ${plural(n, 'account', 'accounts')} will be registered.`,
    s4Footer: 'If this is not what you expected, go back and change your entries.',

    s5Done: 'Registered',
    s5Failed: 'Failed',
    s5Busy: 'Registering',
    s5TitleDone: 'Registration complete',
    s5TitleBusy: 'Registering your infrastructure',
    s5SubDone: 'All done.',
    s5SubBusy: 'Connecting the account and verifying credentials. This takes a moment.',
    s5AllOk: 'Everything was registered. You can follow the progress in the list.',
    s5SomeFailed: 'Some items failed to register. Close this and try again.',

    sduGloss:
      'Self Data Upload — instead of installing PII Agent, you upload the data yourself for monitoring.',
    other: 'Other',
    chinaRegion: 'China region',
    installMode: 'Install mode',
    description: 'Description',
    alreadyRegistered: 'Already registered, so it is left out.',
    sduRecommended:
      'It includes a region, cloud or database that a PII Agent install does not support, so we recommend Self Data Upload.',
    agentInstall: 'We install PII Agent on the account you chose and monitor it there.',
    sduAccount: 'Self Data Upload account',
    accountOf: (label: string) => `${label} account`,
    sduUploadGloss: 'The service owner uploads the data directly',
    idcInfra: 'IDC infrastructure',
    intranet: 'Internal network',
    otherInfra: 'Other infrastructure',
    otherEnv: 'Other environment',

    optional: '(optional)',
    descLabel: 'Description',
    infraDescLabel: 'Infrastructure description',
    descPlaceholderAccount: 'A description that identifies this account',
    descPlaceholderInfra: 'A description that identifies this infrastructure',
    descHelper: 'For an N-IRP / SW-PLM project, enter the project code',
    awsPayerHelper:
      'Payer account ID of the AWS organisation (12 digits) — in the account menu at the top right of the console',
    awsMemberHelper:
      'ID of the member account holding the resources (12 digits) — the same value as the payer account if you use no member accounts',
    azureTenantHelper: 'Tenant identifier in Microsoft Entra ID',
    azureSubHelper: 'Identifier of the subscription to connect',
    gcpProjectHelper: 'Enter the Project ID, not the Project Number',
    required: (label: string) => `Enter ${label}`,
    aws12Digits: 'Enter 12 digits',
    badGuid: 'Not a valid GUID (example: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',

    idcLabel: 'IDC',
    idcDesc: 'On-premise data centre',
    otherLabel: 'Other',
    otherDesc: 'Other environment',
  },
};

export const COPY: Record<Locale, typeof ko> = { ko, en };
