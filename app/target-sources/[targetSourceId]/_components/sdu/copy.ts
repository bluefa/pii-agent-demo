import type { Locale } from '@/lib/locale';
import { SDU_DB_TYPE_MAX, SDU_DB_TYPE_MAXLEN } from '@/lib/types/sdu';

/**
 * Fixed UI strings for the Self Data Upload flow — the four screens under
 * `_components/sdu/` plus the two plain modules they read their sentences from.
 *
 * What is NOT here is everything the contract owns: Region display names
 * (`SDU_REGION_LABEL`), cloud names, the Database Type names the owner typed, the upload
 * commands, the S3 endpoints and the destination IPs all render exactly as they arrived.
 *
 * A guidance sentence that wraps part of itself in an emphasis span is split into runs,
 * and EACH RUN CARRIES ITS OWN SPACING — the JSX puts no `{' '}` between them. Korean
 * glues a particle straight onto the emphasised phrase (「…축」 + 「이에요」) exactly where
 * English needs a space, so a space living in the markup could only ever be right in one
 * of the two languages. `lib/copy.ts` made the same call for
 * `headerSubtitleBefore` / `headerSubtitleAfter`.
 */

/** What `sduReturnHint` computes; the sentence built from it is per-language. */
export interface SduReturnHintFacts {
  /** Region display names this edit adds, already in canonical order. */
  added: readonly string[];
  /** Region display names this edit removes. */
  removed: readonly string[];
  beforeCount: number;
  afterCount: number;
  uploadIpChanged: boolean;
}

/** English count nouns only. Korean has no plural to agree with. */
const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

const ko = {
  /** `SduUploadSummary` — the recap steps 3 and 4 both close with. */
  recap: {
    loadFailed: '업로드 요약 정보를 불러오지 못했어요.',
    regionsLabel: '업로드 Region',
    regionsValue: (count: number, list: string) => `${count}곳 · ${list}`,
    submittedLabel: '제출',
    resourcesDoneLabel: '리소스 생성 완료',
    recipientsLabel: 'S3 Access Key 수신자',
    recipientsValue: (count: number) => `${count}명`,
  },

  /** Step 1 연동 대상 정의 — the card, the list, the row editor and the add wizard. */
  define: {
    stepTag: '1단계',
    cardTitle: '연동 대상 정의',
    returnedChip: '2단계에서 돌아옴',

    initialGuidance: {
      head: 'SDU는 인프라를 스캔하지 않아요. ',
      enterTargets: '연동할 대상을 직접 입력',
      middle:
        '해 주세요. 대상 한 건은 클라우드 · Region · 업로드 IP · Database Type 네 가지이고, ',
      regionAxis: 'Region이 업로드 경로를 가르는 축',
      tail: '이에요.',
    },
    returnGuidance: {
      head: '이미 2단계를 진행 중인 대상소스예요. ',
      addRegion: 'Region을 추가하면',
      middle: ' 방화벽 확인과 업로드 확인을 다시 하셔야 하고, ',
      changeIp: '업로드 IP를 바꾸면',
      tail: ' 방화벽 확인만 다시 하시면 돼요. Region을 빼는 것은 아무것도 되돌리지 않고, 등록한 수신자와 받으신 S3 Access Key는 그대로예요.',
    },
    returnBanner:
      'Region을 추가하면 방화벽 확인과 업로드 확인을 처음부터 다시 해야 하고, 업로드 IP를 바꾸면 방화벽 확인만 다시 하시면 돼요. Region을 빼는 것은 확인 내역을 건드리지 않아요.',

    loading: '연동 대상 정의를 불러오는 중…',
    loadErrorTitle: '불러오지 못했어요',
    loadError: '연동 대상 정의를 불러오지 못했어요.',
    saveError: '연동 대상을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    submitAccepted: '제출은 접수됐어요. 화면을 새로고침해 최신 상태를 확인해 주세요.',

    initialHint: (targets: number, regions: number) =>
      `대상 ${targets}건 · Region ${regions}곳 → 업로드 경로 ${regions}개`,
    saveAndReturn: '저장하고 2단계로 돌아가기',
    submitAndUpload: '제출하고 업로드 단계로',

    // 권역 note — a fact the target source already carries, not a control.
    scopeGlobal: '권역 Global · Region은 Asia · US · EU · CX 중에서 골라요',
    scopeChina: '권역 China · Region은 China로 고정돼요',

    // list
    listTitle: '연동 대상',
    listCount: (count: number) => `${count}건`,
    listStat: (regions: number, dbTypes: number) =>
      `Region ${regions}곳 · Database Type ${dbTypes}종`,
    emptyTitle: '연동 대상을 추가해주세요',
    emptyDescription: '대상마다 클라우드 · Region · 업로드 IP · Database Type을 입력해요',
    addTarget: '대상 추가',
    restore: '되돌리기',
    edit: '편집',
    remove: '삭제',
    diffSame: '변경 없음',
    diffChanged: '수정함',
    diffAdded: '추가함',
    diffRemoved: '삭제함',
    dbTypeSummary: (count: number) => `${count}개 데이터베이스 선택`,

    // row editor + wizard step 1/2 — the same four questions in two places.
    editing: '편집 중',
    cloudLabel: '데이터가 있는 클라우드',
    cloudHint:
      '업로드할 데이터가 원래 어디에서 운영되고 있는지예요. 연동 타입(SDU)과는 별개예요.',
    cloudAria: '클라우드',
    cloudOther: '기타',
    regionLabel: 'Region',
    regionAria: 'Region',
    regionFixedHint: 'China 권역이라 Region은 China로 고정돼요. 대상마다 다르게 고를 수 없어요.',
    regionFixed: '고정',
    regionHint:
      '업로드 경로가 갈리는 축이에요. 같은 Region을 고른 대상들은 같은 S3 경로 하나를 함께 써요.',
    uploadIpLabel: '업로드 IP',
    uploadIpHint: 'S3에 데이터를 올릴 때 나가는 IP 주소예요. 이 주소에서만 업로드가 허용돼요.',
    uploadIpPlaceholder: '예: 10.20.30.40',
    cancel: '취소',
    saveTarget: '대상 저장',

    // Database Type inputs
    dbTypeHint: `목록에 없는 타입은 직접 입력할 수 있어요. 한 대상당 최대 ${SDU_DB_TYPE_MAX}개, 이름은 ${SDU_DB_TYPE_MAXLEN}자까지예요.`,
    dbTypeGridAria: '자주 쓰는 Database Type',
    dbTypeQuickLabel: '자주 쓰는 타입',
    dbTypeCustomAria: 'Database Type 직접 입력',
    dbTypeCustomPlaceholder: '직접 입력 (예: CUBRID)',
    dbTypeCustomPrompt: '목록에 없는 타입을 쓰고 계신가요?',
    dbTypeCustomCta: '직접 입력 →',
    add: '추가',
    removeValue: (value: string) => `${value} 제거`,

    // validation, mirrored from the mock BFF so the screen can say the rule out loud
    ipInvalid: '올바른 IPv4 주소가 아니에요',
    dbTypeMax: `대상당 ${SDU_DB_TYPE_MAX}개까지 등록할 수 있어요`,
    dbTypeLen: `Database Type은 ${SDU_DB_TYPE_MAXLEN}자까지 입력할 수 있어요`,
    dbTypeDuplicate: '이미 추가한 타입이에요',
    dbTypeRequired: 'Database Type을 하나 이상 추가해 주세요',

    // add wizard
    addTargetTitle: '연동 대상 추가',
    addWizardSubtitle: '데이터가 어디에 있는지 알려주세요.',
    addWizardNavLabel: '대상 추가 단계',
    addStep1Title: '연동 위치',
    addStep1Sub: '클라우드와 Region',
    addStep2Title: '업로드 IP',
    addStep2Sub: '데이터가 나가는 주소',
    addStep3Title: 'Database Type',
    addStep3Sub: '업로드할 데이터의 종류',
    addStep4Title: '확인',
    addStep4Sub: '추가할 대상',
    addWhereTitle: '어디에 있는 데이터인가요?',
    addWhereLead: 'Region이 이후 업로드 경로를 가르는 축이에요.',
    addIpTitle: '업로드는 어느 IP에서 하나요?',
    addIpLead: '한 대상에 한 주소예요. 여러 곳에서 올린다면 대상을 나눠 추가해주세요.',
    addDbTitle: '어떤 Database를 올리나요?',
    addDbLead: '이 대상에서 올릴 데이터의 종류를 모두 적어주세요.',
    addReviewTitle: '이대로 추가할까요?',
    addReviewLead: '고칠 내용이 있으면 이전 단계로 돌아가 수정할 수 있어요.',
    summaryCloud: '클라우드',
    summaryDbType: 'Database Type',
    back: '이전',
    next: '다음',
    abandonTitle: '대상 추가를 그만두시겠어요?',
    abandonDescription: '지금 닫으면 입력한 내용이 사라져요.',
    abandonCancel: '계속 작성',
    abandonConfirm: '닫기',

    // submit modal
    submitTitle: '연동 대상을 제출할까요?',
    submitDescriptionHead: (targets: number, regions: number) =>
      `대상 ${targets}건 · Region ${regions}곳으로 `,
    submitDescriptionPaths: (regions: number) => `업로드 경로 ${regions}개가 만들어져요`,
    submitDescriptionTail: '. SDU는 승인 절차가 없어 제출하면 바로 데이터 업로드 단계로 넘어가요.',
    submitConfirm: '제출하기',
    submitFootnote: '제출한 뒤에도 2단계에서 연동 대상을 고치러 이 화면으로 돌아올 수 있어요.',
    submitSuccessTitle: '연동 대상을 제출했어요',
    submitSuccessDescription: '잠시 후 데이터 업로드 단계로 이동해요.',
    submitErrorTitle: '연동 대상을 제출하지 못했어요',
    submitErrorDescription: '입력하신 대상은 그대로 남아 있어요.',

    /**
     * The one line before the trip back to 2단계. Korean links its clauses with a
     * connective ending ('없어지고') and closes with a final one ('없어져요'); English has
     * no such pair, which is why the whole sentence is assembled here and not in the model.
     */
    returnHint: ({
      added,
      removed,
      beforeCount,
      afterCount,
      uploadIpChanged,
    }: SduReturnHintFacts): string => {
      // 경로 수가 같아도 "2개 → 2개"라고 굳이 말한다: 수가 같다고 같은 경로가 아니다.
      const path =
        added.length || removed.length
          ? `업로드 경로 ${beforeCount}개 → ${afterCount}개`
          : `업로드 경로 ${afterCount}개`;

      // 조사는 '가' 하나면 된다. 이 화면이 부르는 Region 이름은 다섯뿐이고
      // (Asia · US · EU · CX · China) 다섯 다 읽으면 받침 없이 끝난다 —
      // 아시아 · 유에스 · 이유 · 씨엑스 · 차이나. 이름이 늘면 여기부터 다시 볼 것.
      //
      // 이어지는 절과 끝나는 절의 어미가 다르다 ('없어지고' / '없어져요'). 어간에 어미를
      // 붙여 만들면 '없어지어요' 가 나오므로, 두 형태를 각각 적어 둔다.
      const clauses: { linked: string; final: string }[] = [];
      if (added.length) {
        clauses.push({
          linked: `${added.join(' · ')}가 새로 생기고`,
          final: `${added.join(' · ')}가 새로 생겨요`,
        });
      }
      if (removed.length) {
        clauses.push({
          linked: `${removed.join(' · ')}가 없어지고`,
          final: `${removed.join(' · ')}가 없어져요`,
        });
      }
      const head = clauses.length
        ? clauses
            .map((clause, index) => (index === clauses.length - 1 ? clause.final : clause.linked))
            .join(' ')
        : 'Region 구성은 그대로예요';

      const ip = uploadIpChanged ? ' 업로드 IP가 바뀌어 방화벽 확인을 다시 해야 해요.' : '';
      return `${head} — ${path}.${ip}`;
    },
  },

  /** Step 2 데이터 업로드 — the four gates and everything inside them. */
  upload: {
    stepTag: '2단계',
    cardTitle: '데이터 업로드',
    doneCount: (done: number) => `4개 중 ${done}개 완료`,
    editTargets: '연동 대상 수정',
    guidance:
      '네 가지 확인을 순서대로 마치면 BDC측 리소스 생성이 시작돼요. 이미 마친 항목도 언제든 다시 하실 수 있어요.',
    loadError: '데이터 업로드 정보를 불러오지 못했어요.',
    writeError: '변경 사항을 저장하지 못했어요.',
    staleNotice: '최신 상태를 불러오지 못했어요. 아래는 마지막으로 확인한 내용이에요.',
    retry: '다시 시도',
    editRecipients: '수신자 수정',
    showCommands: '명령 다시 보기',

    // gate titles + head pills
    gateFirewall: '방화벽 결재 확인',
    gateRecipients: 'S3 Access Key 수신자',
    gateCommands: '데이터 업로드 확인',
    gateBdc: 'BDC 리소스 생성',
    stateDone: '완료',
    stateCurrent: '진행 중',
    stateWaiting: '대기',

    // folded-row summaries
    ackNoTargets: '연동 대상이 없어요',
    ackChecked: (regions: string) => `확인함 · ${regions}`,
    ackUnchecked: (regions: string) => `미확인 · ${regions}`,
    recipientsNone: '등록된 분이 없어요',
    recipientsSummary: (count: number, first: string, others: number) =>
      others === 0
        ? `${count}명 등록함 · ${first}`
        : `${count}명 등록함 · ${first} 외 ${others}명`,
    bdcNotStarted: '앞의 확인이 끝나면 시작돼요',
    bdcInProgress: '리소스를 만들고 있어요',
    bdcCompleted: '리소스 생성을 마쳤어요',

    // what the last trip to 1단계 invalidated
    invalidatedByRegions: (regions: string) =>
      `${regions}가 추가되어 방화벽 확인과 업로드 확인을 다시 해야 해요`,
    invalidatedByIp: '업로드 IP가 바뀌어 방화벽 확인을 다시 해야 해요',

    // 4-1 방화벽 결재 확인
    firewallIntro: (regions: string, count: number) =>
      `1단계에서 정의하신 Region은 ${regions} ${count}곳입니다. 사내 방화벽에서 아래 엔드포인트와 목적지 IP로의 아웃바운드가 허용되어 있어야 해요.`,
    colEndpoint: '엔드포인트',
    colDestinationIps: '목적지 IP',
    colTargets: '대상',
    targetCount: (count: number) => `${count}건`,
    firewallQuestion: '모든 Region의 방화벽 결재 내역을 확인하셨습니까?',

    // 4-2 S3 Access Key 수신자 — a REGISTRATION. Nothing here sends anything.
    recipientsIntro:
      '업로드에 사용할 S3 Access Key를 받으실 분을 등록해주세요. 여러 명을 등록할 수 있어요.',
    recipientsCount: (count: number) => `수신자 ${count}명`,
    removeUser: (name: string) => `${name} 제거`,
    saving: '저장 중...',
    saveRecipients: '수신자 저장',
    recipientsNote:
      '등록된 분들께 관리자가 메일로 S3 Access Key를 직접 전달해요. 이 화면에서 보내지는 않아요.',
    ownersLabel: '서비스 담당자',
    ownersFailed: '담당자를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    ownersLoading: '불러오는 중이에요',
    ownersEmpty: '등록된 담당자가 없어요',
    ownersAllAdded: '담당자를 모두 등록했어요',
    addOwner: '추가',
    ownersNote:
      '이 서비스의 담당자만 S3 Access Key를 받을 수 있어요. 담당자 추가는 접근 권한 화면에서 해주세요.',

    // 4-3 데이터 업로드 확인
    commandsIntro:
      '관리자가 메일로 전달한 S3 Access Key로 데이터를 업로드해주세요. Region마다 아래 세 줄을 그대로 실행하면 올라간 파일을 확인할 수 있어요 — 프록시 설정 두 줄과 조회 명령 한 줄이에요.',
    commandChecked: '확인함',
    commandAwaiting: '응답 대기',
    copyCommand: (region: string) => `${region} 업로드 확인 명령 복사`,
    commandsQuestion: '모든 Region에 데이터를 업로드하셨습니까?',

    // the one question a block ends with
    yes: '예',
    no: '아니오',
    answerNoNote: '확인 후 예를 눌러주세요. 다음 블록은 열리지 않아요.',

    // 4-4 BDC 리소스 생성
    bdcWaiting: '앞의 확인이 끝나면 시작돼요.',
    bdcHeroTitle: 'BDC측에서 설치를 위해 리소스를 생성하고 있습니다',
    bdcHeroBody: '담당자가 하실 일은 없어요. 생성이 끝나면 다음 단계로 넘어가요.',
  },

  /** Step 3 SDU 연동중 — the screen whose message is that there is nothing to do. */
  integrating: {
    stepTag: '3단계',
    title: '업로드하신 데이터를 연동하고 있어요',
    guidanceStrong: '담당자가 하실 일은 없어요.',
    guidanceRest: '연동이 끝나면 완료 단계로 넘어가요.',
  },

  /** Step 4 완료. */
  complete: {
    stepTag: '4단계',
    title: 'PII 모니터링 모듈 연동',
    badge: '연동 완료',
    guidanceStrong: '모든 연동 절차가 완료되었어요.',
    guidanceRest: '업로드하신 데이터의 PII 사용 가능성을 모니터링하고 있어요.',
    rewindHintHead: '업로드할 대상이나 업로드 IP가 바뀌었다면 하단 ',
    editTargets: '연동 대상 수정',
    rewindHintTail: '을 눌러주세요.',
    actionHint: '※ 연동 대상 수정은 1단계로 되돌아가 연동 대상 정의부터 다시 진행해요.',
  },
};

const en: typeof ko = {
  recap: {
    loadFailed: 'Couldn’t load the upload summary.',
    regionsLabel: 'Upload Regions',
    regionsValue: (count: number, list: string) => `${count} · ${list}`,
    submittedLabel: 'Submitted',
    resourcesDoneLabel: 'Resources created',
    recipientsLabel: 'S3 Access Key recipients',
    recipientsValue: (count: number) => `${count}`,
  },

  define: {
    stepTag: 'Step 1',
    cardTitle: 'Define integration targets',
    returnedChip: 'Back from Step 2',

    initialGuidance: {
      head: 'SDU does not scan infrastructure. ',
      enterTargets: 'Enter the targets to connect yourself',
      middle:
        '. One target is four values — cloud · Region · upload IP · Database Type — and ',
      regionAxis: 'the Region is the axis that splits the upload paths',
      tail: '.',
    },
    returnGuidance: {
      head: 'This target source is already on Step 2. ',
      addRegion: 'Adding a Region',
      middle: ' means the firewall check and the upload check both have to be done again, and ',
      changeIp: 'changing the upload IP',
      tail: ' means only the firewall check does. Removing a Region undoes nothing — the recipients you registered and the S3 Access Key you received stay as they are.',
    },
    returnBanner:
      'Adding a Region means the firewall check and the upload check both start over, and changing the upload IP means only the firewall check does. Removing a Region does not touch what you have already checked.',

    loading: 'Loading the integration targets…',
    loadErrorTitle: 'Couldn’t load',
    loadError: 'Couldn’t load the integration targets.',
    saveError: 'Couldn’t save the integration targets. Try again in a moment.',
    submitAccepted: 'The submission was accepted. Refresh the page to see the latest status.',

    initialHint: (targets: number, regions: number) =>
      `${targets} ${plural(targets, 'target', 'targets')} · ${regions} ${plural(regions, 'Region', 'Regions')} → ${regions} upload ${plural(regions, 'path', 'paths')}`,
    saveAndReturn: 'Save and go back to Step 2',
    submitAndUpload: 'Submit and go to the upload step',

    scopeGlobal: 'Scope Global · pick a Region from Asia · US · EU · CX',
    scopeChina: 'Scope China · the Region is fixed to China',

    listTitle: 'Integration targets',
    listCount: (count: number) => `${count}`,
    listStat: (regions: number, dbTypes: number) =>
      `${regions} ${plural(regions, 'Region', 'Regions')} · ${dbTypes} Database ${plural(dbTypes, 'Type', 'Types')}`,
    emptyTitle: 'Add an integration target',
    emptyDescription: 'Each target takes a cloud · Region · upload IP · Database Type',
    addTarget: 'Add target',
    restore: 'Undo',
    edit: 'Edit',
    remove: 'Delete',
    diffSame: 'Unchanged',
    diffChanged: 'Edited',
    diffAdded: 'Added',
    diffRemoved: 'Removed',
    dbTypeSummary: (count: number) =>
      `${count} ${plural(count, 'database', 'databases')} selected`,

    editing: 'Editing',
    cloudLabel: 'Cloud the data is in',
    cloudHint:
      'Where the data you will upload actually runs today. This is separate from the integration type (SDU).',
    cloudAria: 'Cloud',
    cloudOther: 'Other',
    regionLabel: 'Region',
    regionAria: 'Region',
    regionFixedHint:
      'This target source is in the China scope, so the Region is fixed to China. It cannot differ per target.',
    regionFixed: 'Fixed',
    regionHint:
      'This is the axis the upload paths split on. Targets in the same Region share one S3 path.',
    uploadIpLabel: 'Upload IP',
    uploadIpHint:
      'The IP address the data leaves from when it is uploaded to S3. Uploads are allowed only from this address.',
    uploadIpPlaceholder: 'e.g. 10.20.30.40',
    cancel: 'Cancel',
    saveTarget: 'Save target',

    dbTypeHint: `You can type in a type that is not on the list. Up to ${SDU_DB_TYPE_MAX} per target, and up to ${SDU_DB_TYPE_MAXLEN} characters per name.`,
    dbTypeGridAria: 'Common Database Types',
    dbTypeQuickLabel: 'Common types',
    dbTypeCustomAria: 'Type in a Database Type',
    dbTypeCustomPlaceholder: 'Type it in (e.g. CUBRID)',
    dbTypeCustomPrompt: 'Using a type that is not on the list?',
    dbTypeCustomCta: 'Type it in →',
    add: 'Add',
    removeValue: (value: string) => `Remove ${value}`,

    ipInvalid: 'Not a valid IPv4 address',
    dbTypeMax: `You can register up to ${SDU_DB_TYPE_MAX} per target`,
    dbTypeLen: `A Database Type can be up to ${SDU_DB_TYPE_MAXLEN} characters`,
    dbTypeDuplicate: 'That type is already added',
    dbTypeRequired: 'Add at least one Database Type',

    addTargetTitle: 'Add integration target',
    addWizardSubtitle: 'Tell us where the data is.',
    addWizardNavLabel: 'Add target steps',
    addStep1Title: 'Integration location',
    addStep1Sub: 'Cloud and Region',
    addStep2Title: 'Upload IP',
    addStep2Sub: 'The address the data leaves from',
    addStep3Title: 'Database Type',
    addStep3Sub: 'The kinds of data you will upload',
    addStep4Title: 'Review',
    addStep4Sub: 'The target you are adding',
    addWhereTitle: 'Where is the data?',
    addWhereLead: 'The Region is the axis that splits the upload paths later on.',
    addIpTitle: 'Which IP do you upload from?',
    addIpLead:
      'One address per target. If you upload from more than one place, add a target for each.',
    addDbTitle: 'Which Databases are you uploading?',
    addDbLead: 'List every kind of data this target will upload.',
    addReviewTitle: 'Add it like this?',
    addReviewLead: 'If something needs fixing, go back a step and change it.',
    summaryCloud: 'Cloud',
    summaryDbType: 'Database Type',
    back: 'Back',
    next: 'Next',
    abandonTitle: 'Stop adding this target?',
    abandonDescription: 'Closing now discards what you entered.',
    abandonCancel: 'Keep editing',
    abandonConfirm: 'Close',

    submitTitle: 'Submit the integration targets?',
    submitDescriptionHead: (targets: number, regions: number) =>
      `${targets} ${plural(targets, 'target', 'targets')} · ${regions} ${plural(regions, 'Region', 'Regions')} means `,
    submitDescriptionPaths: (regions: number) =>
      `${regions} upload ${plural(regions, 'path is', 'paths are')} created`,
    submitDescriptionTail:
      '. SDU has no approval step, so submitting takes you straight to the data upload step.',
    submitConfirm: 'Submit',
    submitFootnote:
      'Even after submitting, you can come back to this screen from Step 2 to edit the integration targets.',
    submitSuccessTitle: 'Integration targets submitted',
    submitSuccessDescription: 'You’ll move to the data upload step in a moment.',
    submitErrorTitle: 'Couldn’t submit the integration targets',
    submitErrorDescription: 'The targets you entered are still there.',

    returnHint: ({
      added,
      removed,
      beforeCount,
      afterCount,
      uploadIpChanged,
    }: SduReturnHintFacts): string => {
      // Same count on both sides is still said out loud: the same number of paths is not
      // the same set of paths.
      const path =
        added.length || removed.length
          ? `upload paths ${beforeCount} → ${afterCount}`
          : `${afterCount} upload ${plural(afterCount, 'path', 'paths')}`;

      const clauses: string[] = [];
      if (added.length) {
        clauses.push(`${added.join(' · ')} ${plural(added.length, 'is', 'are')} added`);
      }
      if (removed.length) {
        clauses.push(`${removed.join(' · ')} ${plural(removed.length, 'is', 'are')} removed`);
      }
      const head = clauses.length ? clauses.join(' and ') : 'The Region set is unchanged';

      const ip = uploadIpChanged
        ? ' The upload IP changed, so the firewall check has to be done again.'
        : '';
      return `${head} — ${path}.${ip}`;
    },
  },

  upload: {
    stepTag: 'Step 2',
    cardTitle: 'Data upload',
    doneCount: (done: number) => `${done} of 4 done`,
    editTargets: 'Edit integration targets',
    guidance:
      'Once you finish the four checks in order, BDC starts creating the resources. You can redo anything you have already finished at any time.',
    loadError: 'Couldn’t load the data upload information.',
    writeError: 'Couldn’t save your changes.',
    staleNotice: 'Couldn’t load the latest status. Below is what was last confirmed.',
    retry: 'Try again',
    editRecipients: 'Edit recipients',
    showCommands: 'Show the commands again',

    gateFirewall: 'Firewall approval check',
    gateRecipients: 'S3 Access Key recipients',
    gateCommands: 'Data upload check',
    gateBdc: 'BDC resource creation',
    stateDone: 'Done',
    stateCurrent: 'In progress',
    stateWaiting: 'Waiting',

    ackNoTargets: 'No integration targets',
    ackChecked: (regions: string) => `Checked · ${regions}`,
    ackUnchecked: (regions: string) => `Not checked · ${regions}`,
    recipientsNone: 'Nobody registered',
    recipientsSummary: (count: number, first: string, others: number) =>
      others === 0
        ? `${count} registered · ${first}`
        : `${count} registered · ${first} +${others}`,
    bdcNotStarted: 'Starts once the earlier checks are done',
    bdcInProgress: 'Creating the resources',
    bdcCompleted: 'Resources created',

    invalidatedByRegions: (regions: string) =>
      `${regions} added — the firewall check and the upload check have to be done again`,
    invalidatedByIp: 'The upload IP changed — the firewall check has to be done again',

    firewallIntro: (regions: string, count: number) =>
      `The Regions you defined in Step 1 are ${regions} — ${count} in total. Your internal firewall has to allow outbound traffic to the endpoints and destination IPs below.`,
    colEndpoint: 'Endpoint',
    colDestinationIps: 'Destination IP',
    colTargets: 'Targets',
    targetCount: (count: number) => `${count}`,
    firewallQuestion: 'Have you checked the firewall approval records for every Region?',

    recipientsIntro:
      'Register the people who should receive the S3 Access Key used for the upload. You can register more than one.',
    recipientsCount: (count: number) => `${count} ${plural(count, 'recipient', 'recipients')}`,
    removeUser: (name: string) => `Remove ${name}`,
    saving: 'Saving...',
    saveRecipients: 'Save recipients',
    recipientsNote:
      'An admin emails the S3 Access Key to the people you register. Nothing is sent from this screen.',
    ownersLabel: 'Service owners',
    ownersFailed: 'Couldn’t load the owners. Try again in a moment.',
    ownersLoading: 'Loading',
    ownersEmpty: 'No owner is registered',
    ownersAllAdded: 'Every owner is registered',
    addOwner: 'Add',
    ownersNote:
      'Only this service’s owners can receive the S3 Access Key. To add an owner, use the access screen.',

    commandsIntro:
      'Upload the data with the S3 Access Key the admin emailed you. Run the three lines below as they are for each Region and you can see the files that landed — two proxy lines and one listing command.',
    commandChecked: 'Checked',
    commandAwaiting: 'Awaiting answer',
    copyCommand: (region: string) => `Copy the ${region} upload check command`,
    commandsQuestion: 'Have you uploaded the data to every Region?',

    yes: 'Yes',
    no: 'No',
    answerNoNote: 'Check it, then press Yes. The next block stays closed.',

    bdcWaiting: 'Starts once the earlier checks are done.',
    bdcHeroTitle: 'BDC is creating the resources for the install',
    bdcHeroBody: 'There is nothing for you to do. You’ll move to the next step when it finishes.',
  },

  integrating: {
    stepTag: 'Step 3',
    title: 'We’re connecting the data you uploaded',
    guidanceStrong: 'There is nothing for you to do.',
    guidanceRest: 'You’ll move to the completed step when the integration finishes.',
  },

  complete: {
    stepTag: 'Step 4',
    title: 'PII monitoring module integration',
    badge: 'Integration complete',
    guidanceStrong: 'Every integration step is complete.',
    guidanceRest: 'We’re monitoring the data you uploaded for possible PII use.',
    rewindHintHead: 'If the targets or the upload IP changed, press ',
    editTargets: 'Edit integration targets',
    rewindHintTail: ' below.',
    actionHint:
      '※ Edit integration targets goes back to Step 1 and starts again from defining the integration targets.',
  },
};

export const SDU_COPY: Record<Locale, typeof ko> = { ko, en };

/** The slice a component or a model helper is handed. */
export type SduCopy = typeof ko;
export type SduDefineCopy = SduCopy['define'];
export type SduUploadCopy = SduCopy['upload'];
