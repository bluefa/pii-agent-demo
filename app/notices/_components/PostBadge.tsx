import { cn, postStyles } from '@/lib/theme';

/**
 * 게시글 배지 3종 (`design/notice-faq/notice-faq-screens.html` `.bdg`).
 *
 * 핀은 선이 아니라 채운 실루엣이다 — 12px 에서 2px 획의 핀은 획 사이가
 * 1픽셀보다 좁아져 뭉개지고, 색이 번진 것처럼 보인다.
 */
const PinIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden className={postStyles.badgeIcon} fill="currentColor">
    <rect x="4" y="1.5" width="8" height="2.2" rx="1.1" />
    <path d="M6.2 3.7h3.6l1 4.3H5.2Z" />
    <rect x="7.4" y="8" width="1.2" height="5.5" rx="0.6" />
  </svg>
);

export const PinBadge = () => (
  <span className={cn(postStyles.badge, postStyles.badgePin)}>
    <PinIcon />
    고정
  </span>
);

/** Category — 채운 칩이 아니라 흰 아웃라인. 제목보다 앞서면 안 되기 때문이다. */
export const CategoryBadge = ({ name }: { name: string }) => (
  <span className={cn(postStyles.badge, postStyles.badgeCat)}>{name}</span>
);

/** 삭제가 없는 도메인이라 숨김 글은 목록에 영구히 남는다. 점선이 "지금은 안 나감"을 말한다. */
export const HiddenBadge = () => (
  <span className={cn(postStyles.badge, postStyles.badgeHidden)}>숨김</span>
);
