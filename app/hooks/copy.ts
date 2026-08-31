import type { Locale } from '@/lib/locale';

/**
 * Fixed UI strings owned by the shared hooks under `app/hooks/`, in both languages.
 *
 * These hooks have no component of their own, so the sentence cannot be localized at
 * a render site: the hook is the only place that knows a fetch failed or a trigger was
 * rejected. Values that come from the contract — an upstream `AppError.message`, for
 * one — are NOT in here; only the fallback sentence the hook writes itself.
 *
 * Each hook reads its wording through a ref rather than an effect dependency, so
 * flipping the language toggle never re-runs a fetch or rebuilds a callback.
 */
const ko = {
  // useIdcPreviousRequest — the load-previous-request modal's error line.
  idcPreviousRequest: {
    fetchFailed: '기존 연동 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
  },

  // useTestConnectionPolling — the line under the run button when a trigger is refused.
  testConnection: {
    alreadyRunning: '이미 진행 중인 테스트가 있습니다',
    triggerFailed: '연결 테스트 실행에 실패했습니다',
  },

  // useApiMutation and useAsync — the last-resort toast when the caller named no message
  // and the error carried none. One key, because the two hooks write the same sentence.
  asyncAction: {
    failed: '작업에 실패했습니다.',
  },
};

const en: typeof ko = {
  idcPreviousRequest: {
    fetchFailed: 'Could not load the previous integration details. Please try again in a moment.',
  },

  testConnection: {
    alreadyRunning: 'A test is already running',
    triggerFailed: 'Could not start the connection test',
  },

  asyncAction: {
    failed: 'The action failed.',
  },
};

export const HOOKS_COPY: Record<Locale, typeof ko> = { ko, en };
