import type { Locale } from '@/lib/locale';

/**
 * The guide card's own chrome — the card header, and the two failure cards the
 * renderer can swap in for a body it cannot draw.
 *
 * The guide BODIES are not here: they live in `@/lib/constants/step-guide-content`,
 * keyed by locale the same way, because they are a transcription of the owner's
 * source screens rather than UI chrome.
 *
 * Its own file rather than a namespace in `install-copy.ts` / `status-copy.ts`:
 * this card is the guide rail's, not the install road's, and the two big
 * process-status dictionaries have their own owners.
 *
 * Same shape as `lib/copy.ts`: `const en: typeof ko` is what makes the compiler,
 * rather than a reviewer, catch a key English forgot.
 */
const ko = {
  /** The card header. Matches `TS_COPY.collab.guide`, which titles the same rail. */
  title: '가이드',
  // ----- the fetch-failure card -----
  errorTitle: '가이드를 불러오지 못했습니다.',
  errorDetail: '네트워크 상태를 확인하고 다시 시도해 주세요.',
  retry: '다시 시도',
  // ----- the invalid-content card -----
  invalidEnduser: '가이드를 불러올 수 없습니다.',
  invalidAdmin: '가이드 콘텐츠 검증 실패',
};

const en: typeof ko = {
  title: 'Guide',
  errorTitle: 'Could not load the guide.',
  errorDetail: 'Check your network and try again.',
  retry: 'Try again',
  invalidEnduser: 'The guide cannot be displayed.',
  invalidAdmin: 'Guide content validation failed',
};

export const GUIDE_CARD_COPY: Record<Locale, typeof ko> = { ko, en };
