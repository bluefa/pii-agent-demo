import type { Locale } from '@/lib/locale';

/**
 * Fixed UI strings for the Step-1 infrastructure scan — the hero, the running
 * frames, the status band, the stale and error states, the history modal and the
 * per-scan detail.
 *
 * Values that come from the contract are not in here: `scan_version`, resource
 * type keys, timestamps and the upstream `fail_message` / `fail_reason` on a
 * permission check all render as they arrive. What this file owns is the chrome
 * around them plus the scan status and error vocabularies, whose words the
 * client — not the wire — picks.
 *
 * Same shape as `lib/copy.ts`: `const en: typeof ko` is what makes the compiler,
 * rather than a reviewer, catch a key English forgot.
 *
 * Flat rather than per-component: six of these strings (the two scan buttons,
 * the history link, the permission check) render on more than one of the frames
 * below, and a per-component namespace would have had to pick an owner for them.
 */
const ko = {
  // ----- shared across the frames -----
  startScan: '스캔 시작',
  rescan: '다시 스캔',
  starting: '시작 중...',
  checking: '확인 중...',
  checkPermission: '권한 확인',
  scanHistory: '스캔 이력',
  tryAgain: '다시 시도',
  close: '닫기',
  backToList: '목록으로',
  /**
   * One sentence for one state: the hero and the band both render it, and the
   * same state called two ways reads as two states.
   */
  noScanYet: '아직 스캔한 적이 없어요',

  // ----- ScanJobResponse.scan_status (scan-labels) -----
  statusScanning: '진행 중',
  statusSaving: '마무리 중',
  statusSuccess: '성공',
  statusFail: '실패',
  statusTimeout: '시간 초과',
  statusCanceled: '취소',

  // ----- ScanJobResponse.scan_error (scan-labels) -----
  errorAuthPermission: '스캔 권한 오류',
  errorRateLimit: '요청 한도 초과',
  errorNetwork: '네트워크 오류',
  errorService: '서비스 오류',
  errorUnknown: '알 수 없는 오류',

  // ----- scan-job-format -----
  /** 214.6s → '3분 34초'. `seconds` arrives zero-padded. */
  durationMinSec: (minutes: number, seconds: string) => `${minutes}분 ${seconds}초`,
  durationSec: (seconds: number) => `${seconds}초`,
  /** History-row outcome. `count` arrives with its thousands separators. */
  foundCount: (count: string) => `${count}개 발견`,

  // ----- ScanStrip -----
  lastScan: '마지막 스캔',
  lastScanFailed: '마지막 스캔 실패',
  durationMeta: (seconds: number) => `${seconds}초 소요`,
  newCount: (count: number) => `신규 ${count}`,
  permissionErrorBadge: '스캔 권한 오류 — 설정 확인 필요',
  funnelEligible: '연동 가능 DB',
  funnelSelected: '선택함',
  funnelExcluded: '제외함',
  funnelMissingReasons: (count: number) => `사유 ${count}건 미입력`,

  // ----- ScanHeroState -----
  heroDescription: (provider: string) =>
    `스캔하면 연결된 ${provider} 계정의 DB 리소스를 조회해요. 평균 5분 이내 완료돼요.`,
  permissionTitle: '스캔 권한',
  checkNow: '지금 확인하기',
  checkAgain: '다시 확인',

  // ----- ScanStaleState -----
  staleTitle: '다시 스캔해 주세요',
  stalePolicy: (days: number) => `정책상 스캔한 지 ${days}일이 지나면 다시 스캔해야 해요.`,
  staleLastScan: (absolute: string, relative: string) =>
    `마지막 스캔 ${absolute} (${relative})`,

  // ----- ScanErrorState -----
  failTitle: '인프라 스캔에 실패하였어요',
  /**
   * Three parts, not one sentence: the middle one is a link, and the two
   * languages put it in different places.
   */
  failBodyBefore: '보안 설정 또는 권한 문제로 스캔에 실패하였어요.',
  failBodyLink: '가이드 문서',
  failBodyAfter: '를 확인 후 권한 재설정 후 다시 시도해 주세요.',

  // ----- ScanRunningState -----
  runningTitle: '인프라 스캔 진행중입니다',
  /** Split for the same reason as `failBody*`: the middle part is emphasised. */
  runningDescBefore: '인프라 스캔은 약 ',
  runningDescStrong: '5분',
  runningDescAfter: ' 이내 소요되는 편이며, 리소스가 많을 경우 길어질 수 있어요.',
  finalizingTitle: '스캔 마무리 중이에요',
  finalizingDesc: '리소스 탐색은 끝났고 결과를 집계하고 있어요. 잠시만 기다려 주세요.',
  completeTitle: '인프라 스캔이 끝났어요',
  completeDesc: '잠시 후 결과를 보여드릴게요.',
  progressLabel: '인프라 스캔 진행률',

  // ----- ScanDetail -----
  detailNoResources: '발견된 리소스가 없어요.',
  /** The total is drawn large between these two, so it splits the sentence. */
  detailFoundBefore: '총',
  detailFoundAfter: '개를 발견했어요.',
  columnResourceType: '리소스 타입',
  columnCount: '개수',
  fieldRunTime: '실행 시각',
  fieldFinishTime: '완료 시각',
  fieldDuration: '소요 시간',

  // ----- ScanHistoryModal -----
  historySubtitle: '최근 실행된 인프라 스캔 기록이에요.',
  historyDetailTitle: (version: string) => `스캔 결과 #${version}`,
  historyLoadFailed: '스캔 이력을 불러오지 못했어요.',
  historyEmpty: '아직 실행된 스캔이 없어요.',
  historyPageEmpty: '이 페이지에는 기록이 없어요.',
  columnStatus: '상태',
  columnDuration: '소요',
  columnResult: '결과',
  rowLabel: '스캔 상세 보기',
  rowLabelAt: (when: string) => `${when} 스캔 상세 보기`,

  // ----- scan-permission -----
  permissionCheckFailed: '권한을 확인하지 못했어요. 가이드 문서를 참고해 설정을 점검해주세요.',
  permissionVerified: (when: string) => `권한 확인됨 · ${when}`,
  permissionInProgress: '자격 검증이 진행 중이에요',

  // ----- ScanPanel -----
  startFailed: '스캔을 시작할 수 없습니다.',

  // ----- ScanStatusBadge -----
  badgeIdle: '미실행',
  badgeInProgress: '스캔 중',
  badgeCompleted: '완료',

  // ----- ScanResultSummary -----
  summaryTitle: '스캔 결과',
  summaryTotalFound: '전체 발견',
  summaryByResourceType: '리소스 타입별',

  // ----- StepIndicator -----
  stepTargetConfirmation: '연동 대상 확정 대기',
  stepApproval: '승인 대기',
  stepApplying: '연동대상 반영 중',
  stepInstalling: '설치 진행 중',
  stepConnectionTest: '연결 테스트 필요',
  stepComplete: '설치 완료',
};

const en: typeof ko = {
  startScan: 'Start scan',
  rescan: 'Rescan',
  starting: 'Starting...',
  checking: 'Checking...',
  checkPermission: 'Check permission',
  scanHistory: 'Scan history',
  tryAgain: 'Try again',
  close: 'Close',
  backToList: 'Back to list',
  noScanYet: 'No scan yet',

  statusScanning: 'In progress',
  statusSaving: 'Finishing up',
  statusSuccess: 'Success',
  statusFail: 'Failed',
  statusTimeout: 'Timed out',
  statusCanceled: 'Canceled',

  errorAuthPermission: 'Scan permission error',
  errorRateLimit: 'Rate limit exceeded',
  errorNetwork: 'Network error',
  errorService: 'Service error',
  errorUnknown: 'Unknown error',

  durationMinSec: (minutes: number, seconds: string) => `${minutes}m ${seconds}s`,
  durationSec: (seconds: number) => `${seconds}s`,
  foundCount: (count: string) => `${count} found`,

  lastScan: 'Last scan',
  lastScanFailed: 'Last scan failed',
  durationMeta: (seconds: number) => `${seconds}s`,
  newCount: (count: number) => `${count} new`,
  permissionErrorBadge: 'Scan permission error — check the settings',
  funnelEligible: 'Eligible DBs',
  funnelSelected: 'Selected',
  funnelExcluded: 'Excluded',
  funnelMissingReasons: (count: number) => `${count} without an exclusion reason`,

  heroDescription: (provider: string) =>
    `A scan looks up the DB resources in the connected ${provider} account. It usually finishes within 5 minutes.`,
  permissionTitle: 'Scan permission',
  checkNow: 'Check now',
  checkAgain: 'Check again',

  staleTitle: 'Run the scan again',
  stalePolicy: (days: number) =>
    `Policy requires a rescan once the last scan is more than ${days} days old.`,
  staleLastScan: (absolute: string, relative: string) =>
    `Last scan ${absolute} (${relative})`,

  failTitle: 'The infrastructure scan failed',
  failBodyBefore: 'The scan failed because of a security setting or a permission problem. Check the',
  failBodyLink: 'guide',
  failBodyAfter: ', reset the permissions and try again.',

  runningTitle: 'Infrastructure scan in progress',
  runningDescBefore: 'An infrastructure scan usually takes under ',
  runningDescStrong: '5 minutes',
  runningDescAfter: ', and can run longer when there are many resources.',
  finalizingTitle: 'Wrapping up the scan',
  finalizingDesc: 'Resource discovery is done and the results are being tallied. This takes a moment.',
  completeTitle: 'The infrastructure scan is done',
  completeDesc: 'The results follow in a moment.',
  progressLabel: 'Infrastructure scan progress',

  detailNoResources: 'No resources were found.',
  // No counted noun after the total, so one string covers 1 and n alike.
  detailFoundBefore: 'Found',
  detailFoundAfter: ' in total.',
  columnResourceType: 'Resource type',
  columnCount: 'Count',
  fieldRunTime: 'Run time',
  fieldFinishTime: 'Finish time',
  fieldDuration: 'Duration',

  historySubtitle: 'A record of the infrastructure scans that ran recently.',
  historyDetailTitle: (version: string) => `Scan result #${version}`,
  historyLoadFailed: 'We could not load the scan history.',
  historyEmpty: 'No scan has run yet.',
  historyPageEmpty: 'There are no records on this page.',
  columnStatus: 'Status',
  columnDuration: 'Duration',
  columnResult: 'Result',
  rowLabel: 'View scan details',
  rowLabelAt: (when: string) => `View scan details for ${when}`,

  permissionCheckFailed: 'We could not verify the permission. Check the guide and review your settings.',
  permissionVerified: (when: string) => `Permission verified · ${when}`,
  permissionInProgress: 'Credential verification is in progress',

  startFailed: 'The scan could not be started.',

  badgeIdle: 'Not run',
  badgeInProgress: 'Scanning',
  badgeCompleted: 'Complete',

  summaryTitle: 'Scan result',
  summaryTotalFound: 'Total found',
  summaryByResourceType: 'By resource type',

  stepTargetConfirmation: 'Pending target confirmation',
  stepApproval: 'Pending approval',
  stepApplying: 'Applying approved targets',
  stepInstalling: 'Installing',
  stepConnectionTest: 'Connection test required',
  stepComplete: 'Install complete',
};

/** One scan dictionary in one language — the parameter the plain modules take. */
export type ScanCopy = typeof ko;

export const SCAN_COPY: Record<Locale, ScanCopy> = { ko, en };
