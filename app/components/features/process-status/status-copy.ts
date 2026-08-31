import type { Locale } from '@/lib/locale';
import { fmtRelativeTime } from '@/lib/pipeline/format';
import {
  tcElapsedLabel,
  tcSummarySentence,
  type TcBuckets,
  type TcCardState,
} from '@/lib/test-connection-summary';

/**
 * Fixed UI strings for the approval, progress and connection-test surfaces that stand
 * inside the install screen — the approval banner and modals, the Credential notice,
 * the install road's accessible name, and the Step 5 run card, its status tags and its
 * run-history modal.
 *
 * Values that come from the contract are NOT in here: resource ids, endpoints, regions,
 * DB engine names, timestamps, an admin's own rejection words, and upstream `message`
 * fields all pass through untranslated.
 *
 * `summarySentence`, `elapsed` and `relative` mirror three formatters that live in
 * plain `lib/` modules (`test-connection-summary.ts`, `pipeline/format.ts`). Those
 * modules stay locale-free — the wizard set that precedent with `provider-mapping.ts`
 * and `infra-credentials.ts`, and an admin surface outside this screen calls the same
 * two functions. So the module keeps deciding and the dictionary supplies the wording,
 * and the Korean side DELEGATES rather than hand-copying: Korean output stays byte-
 * identical to the tested function, and only English is new text.
 */
const ko = {
  common: {
    close: '닫기',
    cancel: '취소',
    tryAgain: '다시 시도',
    /** Counting units. English drops them — see `app/notices/_components/copy.ts`. */
    unitCases: '건',
  },

  /**
   * The five verdict words one family. TcStatusTag's cell, the run-history row tag and
   * the run card's count line all name the same agent report, so they read one word per
   * fact — a pill that translated SUCCESS but left PENDING Korean would split the family.
   */
  verdict: {
    success: '성공',
    fail: '실패',
    running: '진행 중',
    pending: '대기',
    unknown: '미확인',
    /** A run exists but this row was never reported on — not the same fact as PENDING. */
    unreported: '미보고',
    /** No run at all. */
    notRun: '미실행',
    /** We could not even read whether a run exists. Absence is not a fact. */
    lookupFailed: '조회 실패',
  },

  /** ApprovalApplyingBanner — the count keeps its own `tabular-nums` span. */
  banner: {
    applied: '승인이 완료되어 시스템에 반영 중입니다.',
    totalPrefix: '전체 ',
    totalSuffix: '건 · 평균 5분 내외 소요',
    eta: '평균 5분 내외 소요',
  },

  /** ApprovalModals — the admin's two verdict dialogs. */
  approve: {
    title: '승인',
    commentLabel: '승인 코멘트 (선택)',
    commentPlaceholder: '승인 코멘트를 입력하세요...',
    submit: '승인하기',
  },
  reject: {
    title: '반려',
    reasonLabel: '반려 사유',
    reasonPlaceholder: '반려 사유를 입력하세요...',
    submit: '반려하기',
  },

  /** ApprovalRequestModal — what the requester submits. */
  request: {
    title: '승인 요청',
    submit: '승인 요청',
    subtitle: (included: number, excluded: number | null): string =>
      excluded === null ? `포함 ${included}건` : `포함 ${included}건, 제외 ${excluded}건`,
    noneSelected: '포함할 리소스를 1개 이상 선택하세요',
    includedHeading: (n: number): string => `포함 리소스 (${n}건)`,
    excludedHeading: (n: number): string => `제외 리소스 (${n}건)`,
    colResourceId: '리소스 ID',
    colType: '타입',
    colDbType: 'DB 종류',
    colEndpoint: '엔드포인트',
    colCategory: '분류',
    exclusionReasonLabel: '제외 사유',
    exclusionReasonPlaceholder: '제외 사유를 입력하세요',
    categoryTarget: '연동 대상',
    categoryNoInstall: '설치 선택',
    categoryIneligible: '연동 불가',
  },

  /** ApprovalRequestDetailModal — one decided request, read back. */
  detail: {
    title: '승인 요청 상세',
    subtitle: (requestId: string): string => `요청 ID ${requestId}`,
    requester: '요청자',
    requestedAt: '요청일시',
    processedBy: '처리자',
    processedAt: '처리일시',
    /** A null processor means ADR-006 approved it automatically — say so, don't hide the field. */
    systemProcessor: '시스템',
    reasonHeading: '처리 사유',
    loadingResources: '리소스 목록을 불러오는 중…',
    statTotal: '전체 요청',
    statTarget: '연동 요청 대상',
    statExcluded: '연동 요청 제외대상',
    resultApproved: '승인 완료',
    resultAutoApproved: '자동 승인',
    resultRejected: '반려됨',
    resultCancelled: '요청 취소',
    resultError: '처리 오류',
    resultCompleted: '적용 완료',
    resultPending: '승인 대기',
  },

  /**
   * CredentialMissingNotice. This is the reason the primary action is closed, not a
   * footnote to the card, so the English carries the same weight — the count is the
   * emphasised token and the sentence names what stays blocked until it is fixed.
   */
  credential: {
    title: 'Credential 미설정 알림',
    count: (n: number): string => `${n}건`,
    body: '이 지정되지 않았어요. 지정해야 연결 테스트를 실행할 수 있어요.',
    showAll: '전체 보기',
    showMissingOnly: '미설정만 보기',
  },

  /** InstallationProcessProgressBar — no visible name, one accessible name. */
  road: {
    label: '설치 진행',
  },

  /** ProcessTimelineCompact — the admin guide preview's dotted road. */
  timeline: {
    label: (current: number, total: number): string => `${current}단계 / 총 ${total}단계`,
  },

  /** TcRejectionNotice — the admin asked for a rerun. */
  tcRejection: {
    checkFailed: '관리자 반려 여부를 확인하지 못했어요 — 새로고침 후 다시 확인해 주세요.',
    rerunRequested: '관리자가 연결 테스트 재실행을 요청했어요',
  },

  /** TcRunHistoryModal. */
  tcHistory: {
    title: '연결 테스트 실행 이력',
    subtitle: '최근 실행된 연결 테스트 기록이에요.',
    loadError: '실행 이력을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    empty: '아직 실행한 연결 테스트가 없어요.',
    emptyPage: '이 페이지에는 기록이 없어요.',
    colRun: '실행',
    colVerdict: '판정',
    colRequested: '요청',
    colCompleted: '완료',
    colElapsed: '소요',
  },

  /** TcSummaryCard — the Step 5 run strip. */
  tcCard: {
    /** The headline. `lib/test-connection-summary.ts` decides which of the ten it is. */
    sentence: (state: TcCardState, buckets: TcBuckets): string =>
      tcSummarySentence(state, buckets),
    elapsed: (
      requestedAt: string | null | undefined,
      completedAt: string | number | null | undefined,
    ): string | null => tcElapsedLabel(requestedAt, completedAt),
    relative: (iso: string | null | undefined): string => fmtRelativeTime(iso),

    metaConfirmed: '최근 수행 결과 기준',
    metaPolicyChanged: (at: string): string => `정책 변경 ${at}`,
    metaLastRun: (at: string): string => `마지막 실행 ${at}`,
    metaCompleted: (at: string, ago: string): string => `${at} 완료 (${ago})`,
    metaElapsed: (elapsed: string): string => `소요 ${elapsed}`,
    metaRequested: (at: string): string => `${at} 요청`,
    metaRunning: (elapsed: string): string => `${elapsed} 경과`,

    guidance:
      '관리자에게 승인을 요청하면 다음 단계로 넘어가요. 모니터링에서 제외할 논리 DB는 요청 전에 정리해 주세요.',
    policyChangedInstruction: '연결 테스트를 다시 수행해야 합니다',

    /** Count-line labels the verdict family does not already own. */
    countTargets: '대상 리소스',
    /** running·waiting·unreported folded — mid-run they are one fact: no answer yet. */
    countRest: '남음',

    ctaRun: '실행',
    ctaQueued: '시작 대기…',
    ctaRunning: '진행 중…',
    ctaRerun: '다시 실행',
    ctaApproval: '승인 요청',
  },
};

const en: typeof ko = {
  common: {
    close: 'Close',
    cancel: 'Cancel',
    tryAgain: 'Try again',
    unitCases: '',
  },

  verdict: {
    success: 'Success',
    fail: 'Failed',
    running: 'Running',
    pending: 'Pending',
    unknown: 'Unknown',
    unreported: 'Not reported',
    notRun: 'Not run',
    lookupFailed: 'Lookup failed',
  },

  banner: {
    applied: 'Approved. Applying to the system.',
    totalPrefix: 'Total ',
    totalSuffix: ' · about 5 minutes on average',
    eta: 'About 5 minutes on average',
  },

  approve: {
    title: 'Approve',
    commentLabel: 'Approval comment (optional)',
    commentPlaceholder: 'Enter an approval comment...',
    submit: 'Approve',
  },
  reject: {
    title: 'Reject',
    reasonLabel: 'Rejection reason',
    reasonPlaceholder: 'Enter a rejection reason...',
    submit: 'Reject',
  },

  request: {
    title: 'Approval request',
    submit: 'Request approval',
    subtitle: (included: number, excluded: number | null): string =>
      excluded === null
        ? `${included} included`
        : `${included} included, ${excluded} excluded`,
    noneSelected: 'Select at least one resource to include',
    includedHeading: (n: number): string => `Included resources (${n})`,
    excludedHeading: (n: number): string => `Excluded resources (${n})`,
    colResourceId: 'Resource ID',
    colType: 'Type',
    colDbType: 'DB type',
    colEndpoint: 'Endpoint',
    colCategory: 'Category',
    exclusionReasonLabel: 'Exclusion reason',
    exclusionReasonPlaceholder: 'Enter an exclusion reason',
    categoryTarget: 'Integration target',
    categoryNoInstall: 'Install optional',
    /** Same word as `LAYOUT_COPY.table.pillIneligible`, and the same measurement — step 1's
     *  `CANDIDATE_COLUMN_WIDTHS.category` is 112, measured against the Korean, and
     *  `Cannot connect` needs 155.5 there. See that key for the numbers. */
    categoryIneligible: 'Ineligible',
  },

  detail: {
    title: 'Approval request details',
    subtitle: (requestId: string): string => `Request ID ${requestId}`,
    requester: 'Requested by',
    requestedAt: 'Requested at',
    processedBy: 'Processed by',
    processedAt: 'Processed at',
    systemProcessor: 'System',
    reasonHeading: 'Reason',
    loadingResources: 'Loading the resource list…',
    statTotal: 'Total',
    statTarget: 'Targets',
    statExcluded: 'Excluded',
    resultApproved: 'Approved',
    resultAutoApproved: 'Auto-approved',
    resultRejected: 'Rejected',
    resultCancelled: 'Cancelled',
    resultError: 'Processing error',
    resultCompleted: 'Applied',
    resultPending: 'Pending',
  },

  credential: {
    title: 'Credential not set',
    count: (n: number): string => `${n}`,
    body: ' resources have no Credential yet. The connection test cannot run until you set them.',
    showAll: 'Show all',
    showMissingOnly: 'Show only missing',
  },

  road: {
    label: 'Install progress',
  },

  timeline: {
    label: (current: number, total: number): string => `Step ${current} of ${total}`,
  },

  tcRejection: {
    checkFailed: 'We could not check whether an admin rejected this — refresh and check again.',
    rerunRequested: 'An admin asked for the connection test to run again',
  },

  tcHistory: {
    title: 'Connection test history',
    subtitle: 'The connection tests that ran recently.',
    loadError: 'We could not load the run history. Try again in a moment.',
    empty: 'No connection test has run yet.',
    emptyPage: 'No records on this page.',
    colRun: 'Run',
    colVerdict: 'Result',
    colRequested: 'Requested',
    colCompleted: 'Completed',
    colElapsed: 'Elapsed',
  },

  tcCard: {
    // The same ten branches `tcSummarySentence` walks, in English. The branch conditions
    // are the module's; only the wording is here.
    sentence: (state: TcCardState, buckets: TcBuckets): string => {
      const { total, ok, fail, reported } = buckets;
      switch (state) {
        case 'queued':
          return 'Waiting for the connection test to start';
        case 'running':
          return total > 0 && reported === total
            ? 'Collecting the results'
            : 'Connection test running';
        case 'success':
          if (ok === total) return 'Every resource connected successfully';
          return ok === 0
            ? 'No resource has a confirmed connection result'
            : 'Some resources have no confirmed connection result';
        case 'fail':
          if (fail > 0) return 'Some resources failed to connect';
          return 'The connection test failed';
        case 'policy-changed':
          return 'The Logical DB policy changed after the last run';
        case 'confirmed':
          return 'Connection test confirmed complete';
        default:
          return 'No connection test has run yet';
      }
    },
    // `tcElapsedLabel`'s rule, in English units: at most two units, and the hour form
    // drops seconds.
    elapsed: (
      requestedAt: string | null | undefined,
      completedAt: string | number | null | undefined,
    ): string | null => {
      if (!requestedAt || !completedAt) return null;
      const start = new Date(requestedAt).getTime();
      const end =
        typeof completedAt === 'number' ? completedAt : new Date(completedAt).getTime();
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
      const totalSeconds = Math.round((end - start) / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor(totalSeconds / 60) % 60;
      const seconds = totalSeconds % 60;
      if (hours > 0) return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
      if (minutes === 0) return `${seconds}s`;
      return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
    },
    // `fmtRelativeTime`'s buckets, in English.
    relative: (iso: string | null | undefined): string => {
      if (!iso) return '-';
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return '-';
      const diffMin = Math.floor((Date.now() - then) / 60_000);
      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      return `${Math.floor(diffHour / 24)}d ago`;
    },

    metaConfirmed: 'Based on the latest run',
    metaPolicyChanged: (at: string): string => `Policy changed ${at}`,
    metaLastRun: (at: string): string => `Last run ${at}`,
    metaCompleted: (at: string, ago: string): string => `Completed ${at} (${ago})`,
    metaElapsed: (elapsed: string): string => `Elapsed ${elapsed}`,
    metaRequested: (at: string): string => `Requested ${at}`,
    metaRunning: (elapsed: string): string => `${elapsed} elapsed`,

    guidance:
      'Request approval from an admin to move to the next step. Sort out any Logical DB you want excluded from monitoring before you request.',
    policyChangedInstruction: 'You need to run the connection test again',

    countTargets: 'Target resources',
    countRest: 'Remaining',

    ctaRun: 'Run',
    ctaQueued: 'Waiting to start…',
    ctaRunning: 'Running…',
    ctaRerun: 'Run again',
    ctaApproval: 'Request approval',
  },
};

export const STATUS_COPY: Record<Locale, typeof ko> = { ko, en };

/** So a module-level helper can take the dictionary as a typed parameter. */
export type StatusCopy = typeof ko;
