/**
 * 운영 알림 워크리스트의 스타일 토큰 — 표와 스켈레톤이 함께 쓴다.
 *
 * `AlertWorklist.tsx` 에서 갈라낸 이유는 크기다: 토큰·표·스켈레톤이 한 파일에 있으면
 * 355 줄로 anti-patterns B1(300+ LOC) 을 넘는다. 갈라도 표와 스켈레톤이 같은 토큰을
 * 보므로 스켈레톤이 실제 표와 다른 자리에 뜨는 일은 없다.
 */

/** Contract default page size (`/dashboard/target-sources/{kind}` size=10). */
export const PAGE_SIZE = 10;

export const worklist = {
  /**
   * 카드가 없다 (시안 C, 벤치마크 아티팩트 2026-08-20).
   *
   * 타일은 면 없이 페이지 바닥에 서는데 표만 흰 카드 + 그림자였다 — 한 화면에 재질이
   * 둘이라 표가 위와 겉돌았다. 파이프라인 대시보드가 같은 판단을 먼저 했고
   * (`dashboard.bleed`), 거기서도 남긴 것은 표 머리의 2px 룰 하나다.
   *
   * `-mx-5` 는 그 대시보드의 `listBlock` 과 같은 이유다: 셀 패딩이 px-5 라 카드를
   * 벗기면 첫 열이 제목·타일보다 20px 안쪽으로 들어간다. 블록을 그만큼 밖으로 당겨
   * 페이지 그리드에 세우고, 행 hover 틴트는 글자보다 넓게 남는다.
   */
  block: '-mx-5',
  /**
   * 목록 메타 — 카드 제목(16/600) + 설명 문단(14/400) 두 줄이 있던 자리 (시안 B).
   *
   * 두 줄을 지운 이유는 중복이다: 버킷 이름은 바로 위 타일이 선택 상태로 이미 말하고
   * 있었고, 설명 두 문장 중 첫 문장은 그 이름의 되풀이, 두 번째 문장의 유일한 새 정보는
   * 행위자 하나였다. 남는 것은 **이름 · 건수 · 행위자** 세 조각이고, 조각이 넷을 넘으면
   * 다시 문단이 되므로 그것이 상한이다.
   *
   * 건수는 타일에도 있다 — 의도한 중복이다. 표까지 시선이 내려온 뒤에는 "지금 몇 건을
   * 보는 중인가"를 말해 주는 것이 없었고, Cloudscape(표 머리의 counter)와 엔터프라이즈
   * 필터링 분석("목록 위에 결과 수를 보여라")이 같은 자리를 요구한다. 지운 것은
   * 중복이 아니라 **제목 계층**이다.
   *
   * 12px 은 이 표가 이미 쓰는 보조 정보 크기(`d.elapsed`·지연 열)다. 위 타일과는
   * 24px(page.tsx `mt-6`), 아래 표와는 12px — 가까운 쪽이 자기 표다.
   */
  meta: 'flex items-center gap-2 px-5 pb-3 text-[12px] leading-[1.5] text-[var(--pl-text-weak)]',
  /** 14px 글리프 — 라벨 옆에 붙는 마크의 공용 크기(`provTag.glyph`). 20px 은 16px 제목이
   *  곁에 있을 때의 값이었고, 그 제목이 사라졌다. */
  metaIcon: 'flex-none text-[var(--pl-text-medium)]',
  metaLabel: 'font-semibold text-[var(--pl-text-strong)]',
  metaCount: 'font-semibold tabular-nums text-[var(--pl-text-strong)]',
  /** 구분점은 줄의 기본색(weak, 4.97:1)을 그대로 쓴다. faint(2.58:1)로 한 칸 더 내리면
   *  design-guard 의 대비 바닥을 뚫는다 — 글리프라도 글자로 그린 이상 같은 자다. */
  metaSep: 'select-none',
  /**
   * 이름과 설명은 셀 폭까지 쓰고 거기서 자른다 (오너 2026-08-20: "서비스 이름이 충분히
   * 길 수 있어 … 설명이랑 거의 반반 … 길면 짤라서").
   *
   * `max-w-[NNch]` 로 잡던 상한을 버린 이유: ch 상한은 열 폭과 무관해서, 열이 넓어도
   * 거기서 먼저 잘리고 열이 좁아지면 상한 전에 셀이 터진다. 열 폭 자체가 상한이어야
   * 하고, 그러려면 표가 `table-fixed` 여야 한다 — auto layout 은 열 폭을 내용이
   * 정하므로 긴 이름 한 줄이 다른 모든 열을 밀어낸다.
   *
   * 잘린 값은 `title` 로 전문을 남긴다 — 자르는 것은 표의 사정이지 값의 사정이 아니다.
   */
  table: 'w-full table-fixed',
  descText: 'block truncate text-[14px] text-[var(--pl-text-weak)]',
  /**
   * 값 계층 — 한 행에서 네 값이 순서를 갖도록 **채널을 나눠서** 준다 (오너 2026-08-20:
   * "값 계층이 없다"). 처음에는 Target 과 코드가 둘 다 14/600 strong 이고 이름과 설명이
   * 둘 다 14/400 medium 이라, 굵은 값 둘과 회색 값 둘이 서로 같은 등급으로 읽혔다.
   *
   *   Target  14/600 strong  — 이 행이 여는 키. 행에서 유일한 600.
   *   이름    14/400 strong  — 사람이 행을 알아보는 이름. 무게 대신 색이 올라선다.
   *   코드    14/500 medium mono — 같은 크기지만 무게·색이 한 칸씩 내려온 식별자.
   *   설명    14/400 weak    — 행을 고르는 근거. 크기는 같고 색만 물러난다.
   *
   * 크기를 한 값도 줄이지 않는 이유는 열마다 헤더가 이미 그것이 무엇인지 말하기
   * 때문이다 — 여기서 필요한 것은 "무엇인지"가 아니라 "먼저 읽을 것"의 순서다.
   */
  idValue:
    'text-[14px] font-semibold tabular-nums text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] transition-colors group-hover:text-[var(--pl-info-text)]',
  codeText: 'text-[14px] font-medium text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
  nameText: 'block truncate text-[14px] text-[var(--pl-text-strong)]',
  /**
   * 머리 (오너 2026-08-20: "표면·구분선이 약하다").
   *
   * gray-50 밴드를 먼저 대 봤고 브라우저에서 재 보니 흰 카드 위 **1.05:1** 이었다 —
   * DOM 에는 있고 눈에는 없는 면이다(대시보드가 같은 이유로 밴드를 뺐다). 흰 면 위에서
   * 듣는 레버는 fill 이 아니라 stroke 라, 머리는 2px `--pl-text-strong` 룰이 계속
   * 맡고 라벨만 weak(4.97:1) → medium(10.01:1) 로 올린다. 열 이름이 값보다 흐리면
   * 표를 읽기 전에 열을 세는 일부터 어려워진다.
   */
  th: 'h-[34px] px-5 text-left whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.03em] text-[var(--pl-text-medium)] border-b-2 border-[var(--pl-text-strong)]',
  /** 행 구분선 — gray-100 은 흰 행 위에서 1.06:1 이라 DOM 에만 있었다. gray-200 은
   *  1.24:1(실측) 로, 카드 테두리(border-strong 1.41:1)보다는 조용하면서 실제로 보인다. */
  body: 'divide-y divide-[var(--pl-gray-200)]',
  state: 'px-5 py-12 text-center text-[12px] text-[var(--pl-text-weak)]',
  /** Skeleton bar — opsStyles.skeleton grammar at one text line's height. */
  skeletonBar: 'block h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
  footer: 'px-5 py-3',
} as const;
