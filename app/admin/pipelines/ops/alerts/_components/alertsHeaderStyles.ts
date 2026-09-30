/**
 * 운영 알림 머리(AlertsHeader)의 스타일 토큰 — Jira Ticket 콘솔 머리(JiraHeader)도 같은
 * 타일 문법(120px · 4열 · idle/active)을 쓰므로 한 곳에서 산다. 두 머리는 문장과 버킷이
 * 달라 컴포넌트는 따로지만, 타일이 "이 타일이 목록을 거른다"고 읽히는 방식은 하나여야
 * 한다.
 */
export const alertsHeader = {
  head: 'flex items-start justify-between gap-6',
  context: 'mt-1 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',
  summaryRow: 'mt-6 grid grid-cols-4 gap-4',
  /**
   * border 는 비활성일 때도 자리를 차지해야 선택 시 타일 크기가 흔들리지 않는다.
   * border 색과 배경은 idle/active 가 배타적으로 소유한다 — cn 은 단순 join 이라
   * 같은 속성을 두 번 실으면 Tailwind 출력 순서가 승자를 정해버린다.
   */
  summary: 'flex h-[120px] cursor-pointer rounded-[8px] border transition-colors',
  /** 타일 얼굴 — 링크가 테두리·높이를 갖고, 얼굴이 내용과 전환 중 불투명도를 갖는다. */
  face: 'flex flex-1 flex-col items-center justify-center gap-1.5 transition-opacity',
  /** hover 는 idle 에만 — active 위에 얹으면 hover 가 브랜드 스트로크를 덮는다. */
  summaryIdle:
    'border-transparent bg-[var(--pl-gray-100)] hover:border-[var(--pl-gray-300)] hover:bg-[var(--pl-gray-200)]',
  /** Selected = white face + brand stroke + sm shadow — the pipelines dashboard
   *  `bucketTileActive` levers, so "this tile filters the list" reads the same
   *  way in both screens. */
  summaryActive: 'border-[var(--pl-primary)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-sm)]',
  /** 버킷 글리프가 라벨 텍스트와 같은 행에 선다 — 목록 메타 줄(`WorklistMeta`)과 같은 문법. */
  summaryLabel: 'flex items-center gap-1.5 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  /** 장식이라 색을 따로 주지 않는다 — 라벨색을 그대로 상속받는다. */
  summaryLabelGlyph: 'flex-none',
  summaryValue:
    'text-[40px] font-bold leading-[1.2] tracking-[-0.02em] tabular-nums text-[var(--pl-text-strong)]',
  summaryNeed: 'text-[12px] leading-[1.4] text-[var(--pl-text-weak)]',
  /** 전환 중 — 타일은 계속 누를 수 있게 두고 불투명도만 내린다. 막아 버리면
   *  잘못 누른 버킷을 되돌리려고 두 번째로 누르는 것이 막힌다. */
  pending: 'opacity-60',
} as const;
