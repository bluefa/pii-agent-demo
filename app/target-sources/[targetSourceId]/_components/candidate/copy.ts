import type { Locale } from '@/lib/locale';
import { plural } from '@/lib/plural';

/**
 * Step-1 candidate resources (the scan → select → request-approval card) and the
 * logical-DB panels the later steps open, in both languages.
 *
 * One dictionary for two directories because they are one reading: the logical-DB
 * modals describe what happened to the DBs picked here, and a second dictionary
 * would let the two drift on the words that carry the model — 제외 above all.
 *
 * Values that come from the contract are NOT in here: `SkipReason` codes, resource
 * ids and names, `RECOMMEND_FAIL_REASON_LABEL` (it lives in `lib/types.ts`, which is
 * locale-free and shared with steps 2·3 and the admin tables), and upstream error
 * messages. Only the chrome around them.
 *
 * Two words carry the domain and must not soften in English:
 *   - Exclusion is a POLICY someone set, never a fact about the data. Every excluded
 *     row reads "was excluded / will be excluded", never "is missing" or "not found".
 *   - The logical-DB screen has two axes and two vocabularies: the DB axis (what the
 *     connection test looked up per database/schema) and the region axis (which run
 *     the list came from). They never collapse into one English word.
 */
const ko = {
  candidate: {
    // ----- card header -----
    stepTag: '1단계',
    cardTitle: '연동 대상 DB 선택',
    /** Trailing space: the emphasis span follows on the same line. */
    guideScanLead: (provider: string) => `인프라 스캔을 통해 조회된 ${provider} 리소스 중 `,
    guideScanEmphasis: 'PII Agent를 연동할 리소스를 선택',
    guideScanTail: '해주세요.',
    guideReasonLead: '연동에서 제외할 리소스는 ',
    guideReasonEmphasis: '사유를 입력',
    guideReasonTail:
      '해야 하며, 연동 대상 승인 요청으로 제출한 결과는 관리자 승인 후 최종 확정돼요.',
    guideEc2Lead:
      'EC2에 직접 설치해 운영 중인 데이터베이스는 자동 스캔 대상에 포함되지 않아요. 목록 우측 상단의 ',
    guideEc2Emphasis: 'EC2 추가',
    guideEc2Tail: '에서 Instance ID로 검색해 직접 연동 대상으로 추가해주세요.',

    // ----- toolbar / table chrome -----
    addEc2: 'EC2 추가',
    noResources: '발견된 리소스가 없습니다',
    noFilterMatch: '조건에 맞는 결과가 없어요.',
    emptyAfterScan: '발견된 리소스가 없어요. 다시 스캔으로 최신 상태를 확인해보세요.',
    emptyEc2Hint: 'EC2에 직접 설치해 운영 중인 데이터베이스는 Instance ID로 검색해 추가할 수 있어요.',
    retry: '다시 시도',

    // ----- columns -----
    columnSelect: '선택',
    /** The column's accessible name; `categoryHead` is what the header actually paints. */
    columnCategory: '설치 구분',
    columnReason: '제외 사유',
    /**
     * Visible header text. Shorter than `columnCategory` in English only: the column is
     * 112px wide (76px of content) and the header truncates itself, so the full phrase
     * would paint as "Install typ…". The three values below carry the rest of the sense,
     * and the accessible name stays the full one.
     */
    categoryHead: '설치 구분',
    categoryTipTitle: '설치 구분 안내',
    categoryTipLabel: '설치 구분 안내',
    categoryTipBody: '스캔 결과를 바탕으로 시스템이 판정하는 값이라 직접 변경할 수 없어요.',

    // ----- integration_category values -----
    categoryTarget: '설치 대상',
    categoryOptional: '설치 선택',
    categoryIneligible: '설치 불가',
    categoryTargetDesc:
      '연동하려면 Agent 설치(4단계)가 진행되는 DB예요. 연동에서 제외하려면 제외 사유를 입력해야 해요.',
    categoryOptionalDesc:
      'VM·EC2처럼 DB 외 다른 용도로도 쓰는 리소스라 필수 연동 대상은 아니에요. DB 서버를 운영하고 있다면 연동 대상이 맞아요. 행을 펼쳐 데이터베이스 설정을 저장하면 선택할 수 있어요.',
    categoryIneligibleDesc:
      '네트워크 구성 제약으로 Agent를 설치할 수 없는 리소스예요. 선택할 수 없고, 행의 설치 불가 라벨을 누르면 상세 사유를 확인할 수 있어요.',

    // ----- row -----
    instanceListToggle: (name: string, expanded: boolean) =>
      `${name} 인스턴스 목록 ${expanded ? '접기' : '펼치기'}`,
    justAdded: '방금 추가',
    dbConfigNeeded: '(DB 설정 필요)',
    ineligibleGuideLabel: '설치 불가 사유 안내 보기',
    editConnection: '접속 정보 수정',
    removeFromTargets: '연동 대상에서 삭제',
    editExclusionReason: '제외 사유 수정',
    enterExclusionReason: '제외 사유 입력',
    enterReason: '사유 입력',

    // ----- action bar -----
    hintLead: '총 ',
    hintMid: '건 · ',
    hintTail: '건 선택됨',
    requestApproval: '연동 대상 승인 요청',
    blockedNoSelectionTitle: '연동할 DB를 선택해주세요',
    blockedNoSelectionDetail: '목록에서 1개 이상 선택하면 승인 요청을 보낼 수 있어요.',
    blockedMissingReasonTitle: (count: number) => `제외 사유 미입력 ${count}건`,
    blockedMissingReasonDetail: (preview: string, rest: number) =>
      `제외한 설치 대상에는 사유가 필요해요: ${preview}${rest > 0 ? ` 외 ${rest}건` : ''}`,

    // ----- toasts / live region -----
    approvalFiledRefresh: '승인 요청은 접수됐어요. 화면을 새로고침해 최신 상태를 확인해 주세요.',
    needsConfig: (ids: string) => `다음 리소스의 설정이 필요합니다: ${ids}`,
    needsReason: (ids: string) => `제외 사유 입력이 필요합니다: ${ids}`,
    liveAggregating: '스캔 결과를 집계하고 있어요.',
    liveScanning: '인프라 스캔을 진행하고 있어요.',
    liveScanDone: '인프라 스캔이 끝났어요.',
    liveLoaded: (count: number) => `연동 대상 ${count}건을 불러왔어요.`,
    liveEmpty: '발견된 리소스가 없어요.',
    liveScanFailed: '인프라 스캔에 실패했어요.',
    liveScanStale: '마지막 스캔이 정책 기한을 지나 다시 스캔해야 해요.',
    liveEc2Added: (instanceId: string) =>
      `EC2 인스턴스 ${instanceId}을(를) 연동 대상 목록에 추가했어요.`,

    // ----- fetch failure -----
    loadFailed: '리소스 정보를 불러오지 못했습니다.',
  },

  vmConfig: {
    notConfigured: 'VM 데이터베이스 설정이 필요합니다',
    titleWithNic: '네트워크 및 데이터베이스 설정',
    titleWithoutNic: '데이터베이스 연결 설정',
    nicSection: 'Network Interface 선택',
    nicRecommended: '추천',
    databaseType: '데이터베이스 타입',
    selectPlaceholder: '선택하세요',
    hostPlaceholderNic: 'NIC에서 자동 설정됨',
    hostHelperNic: '선택한 NIC의 Private IP',
    hostHelper: 'Private DNS Name 또는 IP',
    port: '포트',
    portPlaceholder: '포트',
    /** Wording for the two verdicts `lib/constants/vm-database.ts` returns; it stays locale-free. */
    portRequired: '포트를 입력해주세요',
    portRange: '1-65535 범위',
    serviceIdPlaceholder: '예: ORCL',
    required: '필수 입력',
    cancel: '취소',
    save: '설정 저장',
  },

  ineligible: {
    title: '설치 불가 사유',
    remedyLabel: '조치 방법',
    docLabel: '공식 문서',
    contactLabel: '문의',
    contactLead: '추가적인 문의사항이 있으면 ',
    contactChannel: '협업 채널',
    contactTail: '에 문의해주세요.',
    azureVnetCause: (mode: string) =>
      `${mode} 방식으로 배포된 리소스에는 Private Endpoint를 설치할 수 없어요.`,
    azureVnetDetail:
      'PII Agent는 Private Endpoint로 Azure MySQL·PostgreSQL Flexible Server에 연결해요. 네트워킹 모드는 서버를 만들 때 정해지고 이후에는 바꿀 수 없어요.',
    azureVnetRemedy: (mode: string) =>
      `${mode} 모드로 새 서버를 만든 뒤 데이터를 옮기면 연동할 수 있어요.`,
    azureVnetDoc: 'Azure VNet 네트워킹 문서',
    gcpPublicIpCause: 'Cloud SQL 인스턴스에 공인 IP가 설정되어 있어 Agent를 설치할 수 없어요.',
    gcpPublicIpDetail:
      'PII Agent는 Private Service Connect(PSC)로 Cloud SQL에 연결해요. PSC는 공인 IP가 설정된 인스턴스에는 구성할 수 없어요.',
    gcpPublicIpRemedy: '인스턴스의 공인 IP를 해제한 뒤 다시 스캔하면 연동 대상으로 잡혀요.',
    gcpLbSubnetCause:
      'Cloud SQL 인스턴스가 내부 HTTP 로드밸런서용 서브넷을 쓰고 있어 Agent를 설치할 수 없어요.',
    gcpLbSubnetDetail:
      'PII Agent는 Private Service Connect(PSC)로 Cloud SQL에 연결해요. 내부 HTTP(S) 로드밸런서 전용 서브넷은 PSC가 지원하지 않아요.',
    cloudSqlPscDoc: 'Cloud SQL Private Service Connect 문서',
    unknownCause: '네트워크 구성 제약으로 Agent를 설치할 수 없는 리소스예요.',
  },

  logicalDb: {
    // ----- count cell / group header (shared by the IDC and cloud step-6 tables) -----
    /** Korean counts things with a unit; English does not, so it renders nothing. */
    countUnit: '개',
    groupTitle: '연동 논리 DB',
    groupTipLabel: '연동 논리 DB 설명',
    groupTip:
      '대상은 최근 연결 테스트가 찾아낸 논리 DB 수, 제외는 모니터링에서 빼 두도록 설정한 수예요. 서로 다른 기준으로 세기 때문에 두 수를 더해도 전체가 되지 않아요.',

    // ----- step 5 editor -----
    modalLabel: '논리 DB 관리',
    modalTitle: '논리 DB 관리',
    loaderTitle: (resourceName: string) => `논리 DB 관리 · ${resourceName}`,
    completedStamp: (relative: string) => `연결 테스트 완료 · ${relative}`,
    headerLead: '조회된 논리 DB를 확인하고, 수집에서 제외할 DB를 골라요.',
    headerTipLabel: '논리 DB 조회·제외 안내',
    replaceWarn: '저장하면 제외 목록 전체가 교체돼요. 목록에서 뺀 항목은 제외가 해제됩니다.',
    partialNotice:
      '최근 연결 테스트의 논리 DB 조회가 안 되나, 논리 DB 제외 목록은 편집하고 수정할 수 있어요.',
    reasonStaging: '스테이징',
    reasonDev: '개발용',
    reasonTemp: '임시',
    unitSchemaDesc:
      'Database 행에서 제외하면 하위 Schema까지, Schema 행에서 제외하면 그 스키마만 빠져요.',
    unitDatabaseDesc: '이 대상은 Database 단위로 조회·제외돼요.',
    unitUnavailableDesc: '최근 연결 테스트의 조회 결과를 읽지 못해 단위를 판정할 수 없어요.',
    unitNoneDesc: '이번 Test Connection에서 조회된 논리 DB가 없어요.',
    unitSchemaChip: 'Schema 단위 조회',
    unitDatabaseChip: 'Database 단위 조회',
    unitUnknownChip: '조회 결과 미확인',
    unitNoneChip: '조회된 논리 DB 없음',
    filterLabel: '상태 필터',
    filterAll: (count: string) => `전체 ${count}`,
    filterKeep: (count: string) => `수집 대상 ${count}`,
    filterDeny: (count: string) => `제외 ${count}`,
    searchPlaceholderSchema: 'Database / Schema 검색',
    searchPlaceholderDatabase: 'Database 검색',
    searchLabel: '논리 DB 검색',
    restoreNote: '제외한 DB는 다음 테스트부터 조회되지 않지만, 제외 목록에는 계속 남아 복원할 수 있어요.',
    emptyNoneFound: '조회된 논리 DB가 없어요.',
    emptyNoFilterMatch: '조건에 맞는 결과가 없어요.',
    emptyUnavailable: '조회 결과를 읽지 못했어요.',
    prevPage: '이전',
    nextPage: '다음',
    searchIsFaster: '목록이 길면 검색으로 좁히는 게 빨라요',
    rerunLead: '저장하면 연결 테스트를 다시 실행해야 해요.',
    rerunTail: '지금 보이는 결과는 제외가 반영되기 전 상태예요.',

    // ----- table columns -----
    colName: '이름',
    colUnit: '단위',
    colStatus: '상태',
    colReason: '제외 사유',
    colAction: '액션',

    // ----- manual exclusion entry (operator screen only) -----
    manualLabel: '제외 추가',
    manualDatabaseLabel: 'Database 이름',
    manualSchemaLabel: 'Schema 이름 (선택)',
    manualSchemaPlaceholder: 'schema (선택)',
    manualReasonLabel: '추가할 제외 사유',
    manualAdd: '추가',
    manualHint: 'schema를 비우면 database 전체',
    manualNeedsDatabase: 'Database 이름을 입력해 주세요.',
    manualDuplicate: '이미 목록에 있습니다.',

    // ----- footer diff -----
    noChanges: '변경 없음',
    pendingCount: (count: number) => `저장 전 변경 ${count}건`,
    stagedExclude: (reason: string) => `제외(${reason})`,
    stagedRestore: '복원',
    revertAll: '되돌리기',
    cancel: '취소',
    save: '저장',
    saving: '저장 중',

    // ----- rows -----
    rowToggle: (name: string, open: boolean) => `${name} ${open ? '접기' : '펼치기'}`,
    // `_n` is the raw count the English side needs for agreement; Korean has no plural.
    metaSchemaCount: (count: string, _n: number) => `스키마 ${count}`,
    metaUntested: '미조회',
    statusDeny: '제외',
    statusStagedExclude: '제외 예정',
    statusStagedRestore: '복원 예정',
    /** An inherited row names the ancestor that decided it, the way Azure writes `(Inherited)`. */
    statusInherited: (parentName: string) => `제외 · ${parentName}`,
    statusInheritedFallback: '상위',
    statusAllow: '수집',
    exclude: '제외',
    restore: '복원',
    undo: '실행 취소',
    restoreFromParent: '상위에서 복원',
    restoreFromParentTitle: (parentName: string, rowName: string) =>
      `${parentName} 제외를 복원해요 — ${rowName} 포함`,

    // ----- reason picker -----
    reasonTitle: '제외 사유',
    reasonLegend: '제외 사유 선택',
    excludeWholeDbTail: ' 전체가 제외돼요',
    excludeWholeDbSchemas: (count: string, _n: number) => ` — 하위 스키마 ${count}개 포함`,
    excludeSchemaTail: ' 스키마만 제외돼요',
    absorbedSchemas: (count: number) => `기존 Schema 제외 ${count}건은 Database 제외로 합쳐져요.`,
    confirmExclude: '제외 (저장 전에 추가)',

    // ----- save result frame -----
    resultSuccessTitle: '논리 DB 제외 설정을 저장했어요',
    resultStaleTitle: '저장은 됐지만 목록을 다시 읽지 못했어요',
    resultErrorTitle: '제외 설정을 저장하지 못했어요',
    resultStaleDesc: '제외 설정은 저장됐어요. 최신 목록은 모달을 다시 열면 보여요.',
    resultErrorDesc: '서버의 제외 정책은 그대로예요.',
    savedSummaryExcluded: (count: string) => `제외 ${count}건`,
    savedSummaryRestored: (count: string) => `복원 ${count}건`,
    savedSummaryNone: '제외 설정이 정책에 반영됐어요.',
    savedSummaryApplied: (clauses: string) => `${clauses}이 정책에 반영됐어요.`,
    ledgerHead: '저장된 변경',
    ledgerCount: (count: string) => `${count}건`,
    ledgerExclude: (reason: string) => (reason ? `제외 (${reason})` : '제외'),
    ledgerRestore: '복원',
    nextLead: '이 정책은 ',
    nextEmphasis: '다음 연결 테스트부터',
    nextTail: ' 반영돼요. 지금 적용하려면 연결 테스트를 다시 실행해 주세요.',
    keptChanges: (count: string, _n: number) =>
      `고른 변경 ${count}건은 그대로 있어요. 닫으면 사라져요.`,
    resultClose: '닫기',
    resultRetry: '다시 저장하기',

    // ----- step 6 read-only summary -----
    summaryLabel: (resourceName: string) => `${resourceName} 논리 DB 연동 현황`,
    summaryTitle: '논리 DB 연동 현황',
    summaryNote:
      '5단계 연결 테스트가 확인한 결과예요. 제외 대상은 관리자가 설정한 정책이라, 이번 테스트에서 발견되지 않은 이름이 포함될 수 있어요.',
    summaryFooterLead: '제외 대상을 바꾸려면 ',
    summaryFooterEmphasis: '연결 테스트 재실행',
    summaryFooterTail: '으로 5단계에서 수정해주세요.',
    summaryClose: '닫기',
    summaryIncluded: '연동 논리 DB',
    summaryIncludedEmpty: '연동 대상 논리 DB가 없어요.',
    summaryExcluded: '연동 제외 대상',
    summaryExcludedEmpty: '연동 제외 대상이 없어요.',
    summaryCount: (count: number) => `${count}개`,
    retry: '다시 시도',
    loadFailed: '논리 DB 정보를 불러오지 못했습니다.',
  },
};

const en: typeof ko = {
  candidate: {
    stepTag: 'Step 1',
    cardTitle: 'Select the DBs to integrate',
    guideScanLead: (provider: string) =>
      `Among the ${provider} resources the infrastructure scan found, `,
    guideScanEmphasis: 'choose the ones to connect PII Agent to',
    guideScanTail: '.',
    guideReasonLead: 'For any resource you leave out of the integration you must ',
    guideReasonEmphasis: 'enter a reason',
    guideReasonTail:
      '. What you submit with Request target approval is confirmed only after an admin approves it.',
    guideEc2Lead:
      'A database you installed and run on EC2 yourself is not part of the automatic scan. Use ',
    guideEc2Emphasis: 'Add EC2',
    guideEc2Tail:
      ' at the top right of the list to search by instance ID and add it as an integration target yourself.',

    addEc2: 'Add EC2',
    noResources: 'No resources found',
    noFilterMatch: 'No results match your filters.',
    emptyAfterScan: 'No resources found. Rescan to check the latest state.',
    emptyEc2Hint: 'A database you installed and run on EC2 yourself can be added by searching its instance ID.',
    retry: 'Try again',

    columnSelect: 'Select',
    columnCategory: 'Install type',
    columnReason: 'Exclusion reason',
    categoryHead: 'Install',
    categoryTipTitle: 'About install types',
    categoryTipLabel: 'About install types',
    categoryTipBody: 'The system decides this from the scan result, so you cannot change it.',

    categoryTarget: 'Target',
    categoryOptional: 'Optional',
    categoryIneligible: 'Ineligible',
    categoryTargetDesc:
      'A DB the agent gets installed on (Step 4) when you integrate it. To leave it out of the integration you have to enter an exclusion reason.',
    categoryOptionalDesc:
      'A resource such as a VM or EC2 that you also use for things other than a DB, so integrating it is not required. If you run a DB server on it, it does belong in the integration. Expand the row and save its database settings to make it selectable.',
    categoryIneligibleDesc:
      'A resource the agent cannot be installed on because of how its network is set up. You cannot select it; press the Ineligible label on the row to see the detailed reason.',

    instanceListToggle: (name: string, expanded: boolean) =>
      `${expanded ? 'Collapse' : 'Expand'} the instance list for ${name}`,
    justAdded: 'Just added',
    dbConfigNeeded: '(DB setup needed)',
    ineligibleGuideLabel: 'See why it is ineligible',
    editConnection: 'Edit connection info',
    removeFromTargets: 'Remove from the integration targets',
    editExclusionReason: 'Edit the exclusion reason',
    enterExclusionReason: 'Enter an exclusion reason',
    enterReason: 'Enter reason',

    hintLead: 'Total ',
    hintMid: ' · ',
    hintTail: ' selected',
    requestApproval: 'Request target approval',
    blockedNoSelectionTitle: 'Choose the DBs to integrate',
    blockedNoSelectionDetail: 'Select at least one from the list to send the approval request.',
    blockedMissingReasonTitle: (count: number) => `${count} without an exclusion reason`,
    blockedMissingReasonDetail: (preview: string, rest: number) =>
      `Every excluded Target needs a reason: ${preview}${rest > 0 ? ` and ${rest} more` : ''}`,

    approvalFiledRefresh:
      'The approval request went through. Refresh the page to see the latest state.',
    needsConfig: (ids: string) => `These resources still need settings: ${ids}`,
    needsReason: (ids: string) => `These resources still need an exclusion reason: ${ids}`,
    liveAggregating: 'Aggregating the scan results.',
    liveScanning: 'Running the infrastructure scan.',
    liveScanDone: 'The infrastructure scan is done.',
    liveLoaded: (count: number) =>
      `Loaded ${count} integration ${plural(count, 'target', 'targets')}.`,
    liveEmpty: 'No resources were found.',
    liveScanFailed: 'The infrastructure scan failed.',
    liveScanStale: 'The last scan is past the policy deadline, so you have to scan again.',
    liveEc2Added: (instanceId: string) =>
      `Added EC2 instance ${instanceId} to the integration target list.`,

    loadFailed: 'Could not load the resource information.',
  },

  vmConfig: {
    notConfigured: 'This VM still needs its database settings',
    titleWithNic: 'Network and database settings',
    titleWithoutNic: 'Database connection settings',
    nicSection: 'Choose a network interface',
    nicRecommended: 'Recommended',
    databaseType: 'Database type',
    selectPlaceholder: 'Choose one',
    hostPlaceholderNic: 'Filled in from the NIC',
    hostHelperNic: 'Private IP of the NIC you chose',
    hostHelper: 'Private DNS name or IP',
    port: 'Port',
    portPlaceholder: 'Port',
    portRequired: 'Enter a port',
    portRange: '1–65535 only',
    serviceIdPlaceholder: 'e.g. ORCL',
    required: 'Required',
    cancel: 'Cancel',
    save: 'Save settings',
  },

  ineligible: {
    title: 'Why this is ineligible',
    remedyLabel: 'What you can do',
    docLabel: 'Official docs',
    contactLabel: 'Questions',
    contactLead: 'If you have other questions, ask in the ',
    contactChannel: 'Collab channel',
    contactTail: '.',
    azureVnetCause: (mode: string) =>
      `A resource deployed with ${mode} cannot have a Private Endpoint installed on it.`,
    azureVnetDetail:
      'PII Agent connects to Azure MySQL and PostgreSQL Flexible Server over a Private Endpoint. The networking mode is fixed when the server is created and cannot be changed afterwards.',
    azureVnetRemedy: (mode: string) =>
      `Create a new server in ${mode} mode and move the data over, and it can be integrated.`,
    azureVnetDoc: 'Azure VNet networking docs',
    gcpPublicIpCause:
      'The Cloud SQL instance has a public IP, so the agent cannot be installed on it.',
    gcpPublicIpDetail:
      'PII Agent connects to Cloud SQL over Private Service Connect (PSC). PSC cannot be configured on an instance that has a public IP.',
    gcpPublicIpRemedy:
      'Remove the public IP from the instance and scan again, and it will come back as an integration target.',
    gcpLbSubnetCause:
      'The Cloud SQL instance uses a subnet meant for an internal HTTP load balancer, so the agent cannot be installed on it.',
    gcpLbSubnetDetail:
      'PII Agent connects to Cloud SQL over Private Service Connect (PSC). PSC does not support a subnet reserved for an internal HTTP(S) load balancer.',
    cloudSqlPscDoc: 'Cloud SQL Private Service Connect docs',
    unknownCause:
      'A resource the agent cannot be installed on because of how its network is set up.',
  },

  logicalDb: {
    countUnit: '',
    groupTitle: 'Integrated logical DBs',
    groupTipLabel: 'About integrated logical DBs',
    groupTip:
      'Target is how many logical DBs the latest connection test found; Excluded is how many were set aside from monitoring. The two are counted on different bases, so adding them does not give you a total.',

    modalLabel: 'Manage logical DBs',
    modalTitle: 'Manage logical DBs',
    loaderTitle: (resourceName: string) => `Manage logical DBs · ${resourceName}`,
    completedStamp: (relative: string) => `Connection test finished · ${relative}`,
    headerLead:
      'Review the logical DBs that were looked up, and pick the ones to leave out of collection.',
    headerTipLabel: 'About looking up and excluding logical DBs',
    replaceWarn:
      'Saving replaces the whole exclusion list. Anything you take off the list stops being excluded.',
    partialNotice:
      'The logical DB lookup from the latest connection test is unavailable, but you can still edit and save the exclusion list.',
    reasonStaging: 'Staging',
    reasonDev: 'Development',
    reasonTemp: 'Temporary',
    unitSchemaDesc:
      'Excluding a Database row also excludes the schemas under it; excluding a Schema row excludes only that schema.',
    unitDatabaseDesc: 'This target is looked up and excluded per Database.',
    unitUnavailableDesc:
      'The lookup results of the latest connection test could not be read, so the unit cannot be determined.',
    unitNoneDesc: 'This connection test looked up no logical DBs.',
    unitSchemaChip: 'Queried per Schema',
    unitDatabaseChip: 'Queried per Database',
    unitUnknownChip: 'Lookup results unavailable',
    unitNoneChip: 'No logical DBs found',
    filterLabel: 'Status filter',
    filterAll: (count: string) => `All ${count}`,
    filterKeep: (count: string) => `Collected ${count}`,
    filterDeny: (count: string) => `Excluded ${count}`,
    searchPlaceholderSchema: 'Search Database / Schema',
    searchPlaceholderDatabase: 'Search Database',
    searchLabel: 'Search logical DBs',
    restoreNote:
      'An excluded DB is skipped from the next test on, but it stays in the exclusion list so you can restore it.',
    emptyNoneFound: 'No logical DBs were found.',
    emptyNoFilterMatch: 'No results match your filters.',
    emptyUnavailable: 'The lookup results could not be read.',
    prevPage: 'Back',
    nextPage: 'Next',
    searchIsFaster: 'Searching beats paging through a long list',
    rerunLead: 'Once you save, you have to run the connection test again.',
    rerunTail: 'What you see now is the state before the exclusions apply.',

    colName: 'Name',
    colUnit: 'Unit',
    colStatus: 'Status',
    colReason: 'Exclusion reason',
    colAction: 'Action',

    manualLabel: 'Add an exclusion',
    manualDatabaseLabel: 'Database name',
    manualSchemaLabel: 'Schema name (optional)',
    manualSchemaPlaceholder: 'schema (optional)',
    manualReasonLabel: 'Exclusion reason to add',
    manualAdd: 'Add',
    manualHint: 'Leave schema empty for the whole database',
    manualNeedsDatabase: 'Enter a database name.',
    manualDuplicate: 'It is already on the list.',

    noChanges: 'No changes',
    pendingCount: (count: number) =>
      count === 1 ? '1 unsaved change' : `${count} unsaved changes`,
    stagedExclude: (reason: string) => `exclude (${reason})`,
    stagedRestore: 'restore',
    revertAll: 'Revert',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving',

    rowToggle: (name: string, open: boolean) => `${open ? 'Collapse' : 'Expand'} ${name}`,
    metaSchemaCount: (count: string, n: number) => `${count} ${plural(n, 'schema', 'schemas')}`,
    metaUntested: 'Not looked up',
    statusDeny: 'Excluded',
    statusStagedExclude: 'To be excluded',
    statusStagedRestore: 'To be restored',
    statusInherited: (parentName: string) => `Excluded · ${parentName}`,
    statusInheritedFallback: 'parent',
    statusAllow: 'Collected',
    exclude: 'Exclude',
    restore: 'Restore',
    undo: 'Undo',
    restoreFromParent: 'Restore from parent',
    restoreFromParentTitle: (parentName: string, rowName: string) =>
      `Restores the ${parentName} exclusion — ${rowName} included`,

    reasonTitle: 'Exclusion reason',
    reasonLegend: 'Choose an exclusion reason',
    excludeWholeDbTail: ' will be excluded entirely',
    excludeWholeDbSchemas: (count: string, n: number) =>
      ` — including its ${count} ${plural(n, 'schema', 'schemas')}`,
    excludeSchemaTail: ' will be excluded (this schema only)',
    absorbedSchemas: (count: number) =>
      count === 1
        ? '1 existing Schema exclusion merges into the Database exclusion.'
        : `${count} existing Schema exclusions merge into the Database exclusion.`,
    confirmExclude: 'Exclude (pending save)',

    resultSuccessTitle: 'Logical DB exclusions saved',
    resultStaleTitle: 'Saved, but the list could not be read back',
    resultErrorTitle: 'Could not save the exclusions',
    resultStaleDesc: 'The exclusions are saved. Reopen this dialog to see the latest list.',
    resultErrorDesc: 'The exclusion policy on the server is unchanged.',
    savedSummaryExcluded: (count: string) => `${count} excluded`,
    savedSummaryRestored: (count: string) => `${count} restored`,
    savedSummaryNone: 'The exclusions are now in the policy.',
    savedSummaryApplied: (clauses: string) => `${clauses} are now in the policy.`,
    ledgerHead: 'Saved changes',
    ledgerCount: (count: string) => count,
    ledgerExclude: (reason: string) => (reason ? `Excluded (${reason})` : 'Excluded'),
    ledgerRestore: 'Restored',
    nextLead: 'This policy takes effect from ',
    nextEmphasis: 'the next connection test',
    nextTail: '. To apply it now, run the connection test again.',
    keptChanges: (count: string, n: number) =>
      `The ${plural(n, 'change', 'changes')} you picked (${count}) ${plural(n, 'is', 'are')} still here. Closing discards ${plural(n, 'it', 'them')}.`,
    resultClose: 'Close',
    resultRetry: 'Save again',

    summaryLabel: (resourceName: string) => `Logical DB integration status for ${resourceName}`,
    summaryTitle: 'Logical DB integration status',
    summaryNote:
      'This is what the Step 5 connection test found. What is excluded is a policy an admin set, so it can list names this test did not find.',
    summaryFooterLead: 'To change what is excluded, use ',
    summaryFooterEmphasis: 'Rerun connection test',
    summaryFooterTail: ' in Step 5.',
    summaryClose: 'Close',
    summaryIncluded: 'Integrated logical DBs',
    summaryIncludedEmpty: 'No logical DBs are being integrated.',
    summaryExcluded: 'Excluded from integration',
    summaryExcludedEmpty: 'Nothing is excluded from integration.',
    summaryCount: (count: number) => `${count}`,
    retry: 'Try again',
    loadFailed: 'Could not load the logical DB information.',
  },
};

export const CANDIDATE_COPY: Record<Locale, typeof ko> = { ko, en };
