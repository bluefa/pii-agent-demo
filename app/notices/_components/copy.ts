import type { Locale } from '@/lib/locale';

/**
 * Every fixed string on the notice / FAQ screens, in both languages. Post
 * bodies and titles come localised from the contract (`titles`, `contents`,
 * `categoryNames`); this file is only for the chrome around them.
 */
const ko = {
  notice: '공지사항',
  faq: 'FAQ',
  viewAll: '전체보기 →',
  all: '전체',
  uncategorised: '미분류',
  category: 'Category',
  bandSub: 'Category별로 모아 보여줍니다. 숨김 처리된 게시글은 나오지 않습니다.',
  empty: '등록된 게시글이 없습니다.',
  count: (n: number) => `${n}건`,
  pinned: '고정',
  bodyFailed: '본문을 불러오지 못했습니다.',
  bodyInvalid: '본문 형식이 올바르지 않아 표시할 수 없습니다.',
  bannerKicker: 'ONBOARDING',
  bannerTitle: 'PASS에 오신 것을 환영합니다! 👋',
  bannerBody: 'PASS는 담당 시스템의 PII 모니터링 모듈 연동 및 상태 조회를 제공하는 서비스입니다.',
  bannerLinksLabel: '온보딩 안내 문서',
  bannerCta: 'PASS 소개 ›',
};

const en: typeof ko = {
  notice: 'Notices',
  faq: 'FAQ',
  viewAll: 'View all →',
  all: 'All',
  uncategorised: 'Uncategorised',
  category: 'Category',
  bandSub: 'Grouped by category. Hidden posts are not shown.',
  empty: 'No posts yet.',
  count: (n: number) => `${n}`,
  pinned: 'Pinned',
  bodyFailed: 'Could not load this post.',
  bodyInvalid: 'This post cannot be displayed — its body is malformed.',
  bannerKicker: 'ONBOARDING',
  bannerTitle: 'Welcome to PASS! 👋',
  bannerBody: 'PASS connects PII monitoring modules to the systems you own and reports their state.',
  bannerLinksLabel: 'Onboarding guides',
  bannerCta: 'About PASS ›',
};

export const POST_COPY: Record<Locale, typeof ko> = { ko, en };
