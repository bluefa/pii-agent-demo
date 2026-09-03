/**
 * Ops target-source page chrome (Figma pYCA7zTWcZysYOpYykuYAN 4:2, adapted to
 * the --pl-* token system — raw Figma hex values map to their semantic tokens).
 */
import { partitionColors, primaryColors } from '@/lib/theme';

export const opsStyles = {
  /**
   * R1 page root (docs/ux/benchmark/ops-detail-ia-redesign.md) — escapes
   * layout.contentFluid's padding (the dash.bleed escape hatch) so the ground
   * reaches the viewport edges. It is painted HERE, not on --pl-bg-page: that
   * token is the section's, and every sibling pipelines screen stands on it.
   *
   * gray-200, and the masthead no longer paints its own. 워시(gray-100)와 라벤더
   * 캔버스(--pl-bg-canvas)는 **1.006:1** 로, 갈라진 적이 없다 — ΔE00 2.46 이 유일한
   * 분리자였고 크롬은 톤이 셋이었다. 그 셋을 하나로 합치면 흰 카드가 1.240 으로 제
   * 힘으로 서고(Backstage·GitHub·Carbon 전부 한 칸만 쓴다), 헤더↔본문 이음매는 선이
   * 아니라 **흰색이 시작되는 자리**가 된다. 바닥이 한 칸 내려간 만큼, 이 면 **위에
   * 직접 서는** 잉크는 전부 한 칸씩 따라 내려갔다 (path·tab·fm*, 아래 각 줄).
   */
  page: '-mx-8 -mt-6 -mb-12 flex min-h-[calc(100vh_-_64px)] flex-col bg-[var(--pl-gray-200)]',
  /**
   * Masthead — 칠이 없다. 경로 줄 + FrontMeta 블록 + 탭 스트립을 담되 제 면을 그리지
   * 않고 `page` 의 바닥 위에 그대로 선다. 워시가 하던 일(머리를 본문과 가르기)은 이제
   * 카드가 한다 — 흰색이 나타나는 첫 지점이 본문의 시작이다.
   */
  masthead: 'px-8 pt-4',

  /**
   * 경로 한 줄 — Linear 문법 (오너 2026-08-26 2차: "너무 어지럽다. 정보정리가 안 된듯.
   * Linear 처럼 정리해볼래?").
   *
   *   전:  서비스 운영 / [서비스 코드 LGS] / Target Source 운영 / [Target Source #1801]
   *   후:  서비스 운영 / LGS / Target Source #1801
   *
   * 앞의 것은 26px 한 줄에 텍스트 런 **10개**가 서 있었고, 그중 여섯이 굵기 600 이었다.
   * 색은 넷(파란 링크 · 옅은 구분자 · 태그 라벨 · 태그 값), 칠한 상자는 셋. 경로는
   * 내비게이션 크롬인데 본문만큼 소리를 내고 있었다 — Linear 가 리디자인에서 세운 원칙
   * 그대로의 반례다: **"Don't compete for attention you haven't earned"**
   * (linear.app/now/behind-the-latest-design-refresh). 그리고 「Target Source 운영 /
   * Target Source #1801」은 같은 낱말을 연달아 두 번 말하고 있었다.
   *
   * 정리한 규칙 셋:
   *  1. **마디는 값만 말한다.** 「서비스 코드 LGS」의 라벨은 태그를 만들려고 붙인 것이지
   *     읽는 사람에게 필요한 것이 아니었다 — Linear 의 크럼은 팀 키를 그냥 `ENG` 로 적고
   *     "Team:" 을 쓰지 않는다. 종류는 마지막 마디가 한 번만 말한다(`Target Source #1801`).
   *  2. **굵은 것은 하나뿐이다.** 서 있는 곳의 식별자만 14/600 이고 나머지는 전부 12/400.
   *     크기와 무게 두 레버가 같은 요소에 실린다(design-guide §3 "인접 계층은 레버 2개").
   *  3. **칠을 걷고 구분자에 하중을 넘긴다.** 상자가 지던 묶음을 이제 `/` 와 간격이 진다
   *     ("Structure should be felt not seen"). 칠이 사라졌으므로 구분자는 faint 에서 한 칸
   *     올라간다 — 유일한 묶음 장치가 안 보이면 안 된다. 바닥이 gray-200 이 된 뒤로 그 칸은
   *     weak(4.01, AA 아래)이 아니라 **gray-600**(6.20)이다.
   *
   * ⛔ 파랑은 **지나온 마디**에서 빠졌다. 링크는 색이 아니라 hover 로 말한다 — 세 마디 중
   * 둘이 링크라 거기에 파랑을 쓰면 줄의 3분의 2가 파래진다.
   * 다만 **서 있는 곳의 식별자 하나만** 파랑이다 (오너 08-26 "#1029 파란색으로 바꿔").
   * 링크가 아니므로 위 규칙과 부딪히지 않고, 굵기·크기·색 세 레버가 한 요소에 모여
   * 줄에서 눈이 가장 먼저 닿는 곳이 "지금 보고 있는 대상"이 된다.
   */
  pathLine: 'flex flex-wrap items-baseline gap-x-3 gap-y-1',
  path: 'flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] leading-[1.5] text-[var(--pl-gray-600)]',
  /** 구분자 — 칠이 없어진 뒤로 이 줄의 유일한 묶음 장치다. 바닥 위 6.20:1. */
  pathSep: 'flex-none text-[var(--pl-gray-600)]',
  /** 지나온 마디. 색도 굵기도 없고, 누를 수 있다는 것은 hover 가 말한다. */
  pathLink:
    'flex-none cursor-pointer text-[12px] text-[var(--pl-gray-600)] transition-colors hover:text-[var(--pl-text-strong)] hover:underline',
  /** 지나온 마디 중 **식별자**인 것(서비스 코드) — 낱말보다 한 단 진하다. */
  pathLinkId:
    'flex-none cursor-pointer text-[12px] font-medium text-[var(--pl-text-medium)] transition-colors hover:text-[var(--pl-text-strong)] hover:underline',
  /** 서 있는 곳 — 종류(옅은 낱말) + 식별자(줄에서 유일하게 굵고 큰 것). */
  pathHere: 'flex flex-none items-baseline gap-1.5',
  pathHereKind: 'text-[12px] text-[var(--pl-gray-600)]',
  pathHereId:
    '[font-family:var(--pl-font-mono)] text-[14px] font-semibold tabular-nums text-[var(--pl-primary-hover)]',
  pathChipLabel: 'text-[12px] font-medium text-[var(--pl-gray-600)]',
  pathChipValue:
    '[font-family:var(--pl-font-mono)] text-[12px] font-semibold text-[var(--pl-text-strong)]',

  /**
   * FrontMeta — 명명 블록 「연동 대상」 + kv 4열 (design-benchmark
   * `ops-target-frontmeta.md`, 시안 C). 서비스측 `projectHeaderStyles` 의 blockHead
   * 문법을 이 콘솔의 --pl-* 로 옮긴 것: 이름은 왼쪽, 여는 큐는 오른쪽 끝, 헤어라인
   * 한 줄이 그 행을 닫는다.
   *
   * 활자는 세 단만 쓴다 (오너 지시) — 16(제목) / 14(블록 이름) / 12(경로·라벨·값·
   * 태그·링크). 옛 마스트헤드는 12px 한 단에 21개 런이 몰려 있어 14 자리가 비어
   * 있었고, 그 빈 칸을 블록 이름이 채운다.
   */
  /**
   * 마스트헤드의 세로 간격은 **포함을 그린다** (오너 08-26 "행간 거리가 짧다보니 답답해
   * 보인다"). 실측이 2 / 10 / 12 / 11.2px 이었는데, 이건 네 단이 아니라 한 단이다 —
   * 「블록 안」(10)과 「블록 사이」(12)가 같은 크기면 간격이 무엇도 묶지 못한다.
   * 네 자리를 1.4~1.5배씩 벌려 세 단으로 세운다:
   *
   *   4px   한 짝 안      라벨 ↔ 그 값            `fmCell` gap-1
   *   22px  한 블록 안    블록 이름 ↔ 사실들       `fmGrid`·`aboutList` pt-[22px]
   *   20px  블록 사이     경로 줄 ↔ 연동 대상      `fmGroup` mt-5
   *   20px  워시 ↔ 탭 줄                          `tabStrip` mt-5
   *
   * 「한 블록 안」이 14 에서 22 로 올랐다 (오너 2026-08-27 "하단에 구분선을 없애고
   * 행간 거리를 8픽셀 더 두도록"). 헤어라인이 머리를 닫고 있을 때는 14 로 충분했다 —
   * 선이 이름과 사실을 갈라 줬으니까. 선을 걷으면 그 일을 **간격 혼자** 해야 하고,
   * 같은 14 로는 이름이 첫 사실 줄에 붙어 읽힌다. 실측으로 라벨 바닥↔첫 사실이
   * 21 → 28px 이다(선 1px 이 옛 21 안에 포함돼 있었다).
   *
   * 탭 줄은 20 으로 블록↔블록과 같은 칸이다. 이 주석은 오래 16/mt-4 라고 적혀 있었지만
   * 코드는 그때 이미 mt-5 였다 — 실측해서 맞춘 값이다.
   */
  fmGroup: 'mt-5',
  /**
   * 블록 머리 — 이름 왼쪽, 여는 큐 오른쪽. **닫는 선은 없다** (오너 2026-08-27
   * "하단에 구분선을 없애고"). 이 바닥 위에서 탭 띠는 `--pl-gray-400` 한 칸 위의 획을
   * 쓴다 — 위 한 줄과, 그룹마다 끊기는 아래 도막들(`tabGroup`). 전부 한 덩어리로 같은
   * 한 가지를 말하므로("여기서 내비게이션이 시작한다"), 블록 머리가 획을 하나라도
   * 얹으면 그 말이 흐려진다. 블록을 묶는 일은 이름의 크기(16)와 그 아래 간격(22)이 진다.
   */
  fmHead: 'flex items-center justify-between gap-4 pb-1.5',
  fmName: 'flex min-w-0 items-center gap-2',
  /** 20px — 운영 대시보드 `identityGlyphMark` 의 칸. 같은 대상의 마크를 24(제목 줄)·
      28(서비스측)·20(대시보드) 세 크기로 그리던 것을 한 크기로 모은다: 이 화면의
      마크는 이제 블록 머리의 하나뿐이라 제목 줄의 24px 는 사라진다. */
  fmGlyph: 'h-5 w-5 flex-none text-[var(--pl-text-medium)]',
  /** 14/600 (오너 2026-09-03). 08-27 에는 16/600 이었다 (오너 "연동 대상 정보, 관련
      페이지의 픽셀을 16까지 키워봐"). 「연동 대상」은 혼자 서지 않는다 — 같은 줄에
      StepPill(14) 이 **나란히** 서므로, 16 에서는 이름이 제가 이름 붙인 사실보다 커졌다.
      ⛔ 이제 두 블록 이름은 `tab`(opsStyles.ts:521) 과 같은 14/600 이다 — 마스트헤드의
      사실과 탭이 같은 활자로 서는 것이 벤치마크 P3 의 지적이었고, 08-27 의 16 인상이
      그 간극을 벌리려던 변경이었다. 오너가 그것을 알고 내린 결정이니 되돌리지 마라.
      ⛔ 탭을 16 으로 올리는 것도 여전히 기각이다(오너 08-27 롤백). */
  fmLabel:
    'whitespace-nowrap text-[14px] font-semibold tracking-[0.02em] text-[var(--pl-text-medium)]',
  /**
   * 마스트헤드는 두 단이다 (오너 08-26 "헤더 오른쪽에서 Github About처럼") — 왼쪽이
   * 사실(연동 대상 + kv 4열), 오른쪽이 나가는 문(관련 페이지). 관련 페이지가 한 단
   * **아래**에 있을 때는 탭 줄을 그만큼 밀어내렸는데, 그건 이 화면에서 가장 자주 쓰는
   * 것(탭)을 가장 덜 쓰는 것(참고 링크)이 밀어낸 배치였다. 오른쪽으로 서면 kv 그리드가
   * 쓰지 않고 남기던 폭을 대신 쓰므로 마스트헤드 높이가 한 줄도 늘지 않는다.
   * 두 머리를 잇던 것은 같은 y 에 선 헤어라인 두 도막이었는데, 그 선이 사라진 지금은
   * 두 이름이 같은 baseline 에 같은 활자로 서는 것이 그 일을 한다.
   */
  /** 간격 24px — 획이 서기 전에는 32px 혼자 두 단을 갈랐다. 획이 그 일을 지므로 간격은
      한 단 줄어도 되고, 줄여야 한다: 획과 그 양옆 간격이 kv 레인에서 폭을 가져가는데,
      32+1+32 이면 GCP 3등분 한 열이 441 → 430px 이 되어 Service Account 전문이 두 줄로
      접혔다(실측 @1900). 24+1+24 는 441px 을 그대로 돌려준다. */
  fmSplit: 'flex items-start gap-6',
  /** 두 단 사이의 세로 획 하나 (오너 2026-08-27 "관련 페이지와 연동 대상 사이에 줄 하나만
      그어보자. 정보 계층 분리하는 것 처럼 보일 필요는 있을듯"). 왼쪽은 이 대상의 사실,
      오른쪽은 나가는 문이라 두 단은 원래 다른 것을 말하는데, 그동안은 간격(32px) 혼자
      그 말을 지고 있었다.

      획을 오른쪽 패널의 `border-l` 로 주지 않는 이유: `aboutPanel` 은 200px 고정 폭이라
      테두리와 padding 이 그만큼 링크 폭을 먹는다(제로섬 열). 제 폭 1px 말고는 아무것도
      차지하지 않는 요소를 따로 세우고, `self-stretch` 로 두 단 중 높은 쪽 높이를 따른다.
      획의 값은 아래 줄이 정한다 — 바닥이 바뀌면서 이 자리도 같이 움직였다. */
  /** ⚠️ 이 룰은 `border-*` 가 아니라 **칠**로 그린다(1px 짜리 `<span>` 의 배경). 그래서
      바닥이 gray-200 이 된 뒤 `--pl-border` 로 두면 1.000 으로 통째로 사라진다 — 그 토큰이
      gray-200 과 **같은 값**이기 때문이다. 획으로 그린 것만 찾아서는 이 자리를 못 찾는다. */
  fmSplitRule: 'w-px flex-none self-stretch bg-[var(--pl-border-strong)]',
  /** 200px — kv 열(240px)보다 좁게 잡는다: 이 단은 대조하는 값이 아니라 이정표라
      제 이름 두 개가 들어가는 만큼만 있으면 되고, 남는 폭은 그리드 쪽에 남는다. */
  aboutPanel: 'w-[200px] flex-none',
  /** About 패널의 본문 — 목적지가 **세로로** 쌓인다 (GitHub About). kv 그리드와 같은
      자리에서 시작하도록 머리 아래 여백은 `fmGrid` 의 pt 와 같은 값이다. */
  aboutList: 'flex flex-col items-start gap-2 pt-[22px]',
  /** About 패널의 한 줄 — 마크가 앞에 서고 이름이 링크다. 마크는 값이 아니라 이정표라
      본문보다 한 단 옅다. */
  aboutRow: 'inline-flex items-center gap-1.5',
  aboutMark: 'flex flex-none text-[var(--pl-text-weak)]',
  /** 14px — 왼쪽 단의 값(`fmValue`)과 같은 급이다 (오너 2026-08-27 "BDCDIP-1002, 서비스
      담당자가 보는 화면 이것도 14 픽셀로 확장"). 두 단은 획 하나로 갈려 있고 각자 제
      이름(16/600)을 갖는데, 본문만 12 로 남으면 오른쪽 단이 왼쪽 단의 각주처럼 읽힌다.

      글자는 **검정 14/500** 이다 (오너 2026-08-27 "관련 페이지 계층이 너무 쎄다. 검정색으로
      표현해봐"). 파랑 14/600 일 때는 색·굵기 두 레버가 겹쳐, 이 화면에서 가장 덜 쓰는 것이
      가장 세게 읽혔다 — 왼쪽 단의 값들(14/600 검정)보다도 앞에 섰다. 누를 수 있다는 신호는
      hover 가 진다: 밑줄이 그때 파랗게 그어진다. */
  aboutLink:
    'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap text-[14px] font-medium text-[var(--pl-text-strong)] hover:underline hover:decoration-[var(--pl-primary)]',
  aboutPlain: 'whitespace-nowrap text-[14px] font-medium text-[var(--pl-text-medium)]',
  /** 포커스 링을 손으로 그리지 않는다 — `focus-visible:outline-none` 은 이 앱에서 무효라
      (globals.css 의 전역 아웃라인이 cascade layer 밖) 옅은 링이 전역 파란 아웃라인 옆에
      같이 그려졌다. 옆의 링크 둘과 같은 방식으로 전역 아웃라인만 받는다. */
  /** 「상세 정보」는 계층을 한 단 내렸다 (오너 08-26 "파란색은 과하다") — 파랑은 이 줄에서
      나가는 링크 둘이 이미 쓰고 있고, 이건 나가는 문이 아니라 여기서 열리는 접힘이다.
      medium 은 워시 위 8.44:1 로 옅어진 게 아니라 조용해진 것이다. */
  fmCue:
    'flex flex-none cursor-pointer items-center gap-1 rounded-[6px] text-[12px] font-medium text-[var(--pl-text-medium)] transition-colors hover:text-[var(--pl-text-strong)]',
  fmCueIcon: 'transition-transform motion-reduce:transition-none',
  fmCueIconOpen: 'rotate-180',
  /**
   * kv 4열 (Cloudscape key-value pairs) — 라벨이 값 **위**에 선다. 프로바이더가
   * 바뀌면 셀만 갈리고 열 규칙은 그대로라, 대상을 옮겨 다녀도 헤더 높이가 흔들리지
   * 않는다 (옛 행 스택은 AWS 218px ↔ GCP 137px 로 벌어져 탭 y 가 81px 움직였다).
   * 긴 주체(ARN · Service Account · App ID)만 2열을 먹는다 — `fmCellWide`.
   */
  /** 열은 240px 로 고정한다 — `1fr` 4개는 1330px 캔버스에서 한 칸이 300px 이 되어
      「계정 804656952396」 과 다음 라벨 사이에 300px 짜리 빈 곳이 생긴다. 라벨이 값
      **위**에 있으니 짝은 이미 붙어 있고, 열이 늘어나 봐야 사실 사이 거리만 벌어진다.
      240 은 이 화면의 가장 긴 라벨(Terraform Service Account, 165px)과 2열 병합이
      GCP SA 전문을 받는 폭에서 나온 값이다.

      실측(2026-08-27, 1440×1000): kv 레인은 **920px** 다(left 248 → right 1168;
      트랙 정의에 따라 몇 px 움직인다 — 한 행 실험에서는 928 이었다).
      1920 창에서 재면 훨씬 넓게 나오니 그 숫자로 다시 유도하지 말 것 — 그렇게 잰
      값으로 한 행에 넷을 세웠다가 주소가 둘 다 잘렸다. GCP 주체 둘은 전문이 각각
      341·365px = 706px 을 먹어서, 한 행에는 프로젝트(115) + 설정(74) + 18px 간격
      셋까지 들어갈 수가 없다(21px 모자란다). 그래서 GCP 만 2행이고, 2열 병합 셀이
      각각 451px 을 받아 둘 다 잘리지 않는다. */
  fmGrid: 'grid grid-cols-[repeat(4,minmax(0,240px))] gap-x-[18px] gap-y-3 pt-[22px]',
  /** GCP 만 세 칸 한 줄이고, 그 세 칸은 **3등분**이다 (오너 2026-08-27 "3등분으로 정보를
      갖고 가게"). 첫 열을 `max-content` 로 잡고 남은 폭을 주체 둘이 나눠 갖던 배치를
      버린다 — 그 배치에서는 프로젝트가 제 글자 폭(115px)까지만 차지한 채 왼쪽에 몰아
      붙고, 세 칸의 열선이 대상마다 움직였다.

      실측: kv 레인이 @1900 에서 1388px → 열당 441px, @1440 에서 920px → 열당 285px.
      이 줄은 이제 Service Account 를 **이름만** 적으므로(전문은 복사·title·폴드가 진다)
      어느 폭에서도 남는다 — 전문을 싣던 시절에는 433px 이라 @1440 한 열(285px)에 못 들어갔고,
      3 × 361 > 920 이라 3등분과 한 줄 전문이 동시에 성립하지 않았다. 그 산술이 이름만
      남기기로 한 결정의 배경이다. ⚠️ 스트립 값은 `fmValueText` 의 `truncate` 라 넘치면
      **접히는 게 아니라 잘린다** — 여기에 다시 긴 값을 넣을 거면 그 전제부터 확인할 것.

      「상세 정보」 폴드와 열이 어긋난다는 전제는 끝났다 — GCP 는 폴드도 같은 3등분
      (`fmFoldGcp`)으로 옮겼으므로 두 격자의 열선이 일치한다 (오너 2026-08-27 "gcp
      더보기도 동일하게 정렬 맞춰"). 반대로 이 줄을 240px 격자로 되돌려 맞추는 길은
      쓰지 않았다 — 그러면 주체 전문이 잘린다.

      토큰을 둘로 나눈 이유: 두 클래스를 겹쳐 쓰면 같은 특이도의 임의값이라 승자를 소스
      순서가 아니라 스타일시트 순서가 정한다 — 호출부가 **고른다**. */
  fmGridGcp: 'grid grid-cols-3 gap-x-6 gap-y-3 pt-[22px]',
  fmCell: 'flex min-w-0 flex-col gap-1',
  fmCellWide: 'col-span-2',
  /** 워시는 램프 한 칸을 잡아먹는다 — `--pl-text-weak` 는 이 gray-100 위에서 4.51:1 로
      AA 바닥이라 12px 라벨에 쓰지 않는다. `--pl-gray-600` 은 같은 자리에서 6.98:1. */
  /** 라벨 줄 — 이제 라벨 하나만 선다. 파티션 태그(중국)는 2026-08-27 에 이 줄을
      떠나 「연동 대상」 블록 머리로, 단계 알약 오른쪽에 섰다(오너 지시) — 파티션은 어느 한
      칸의 단서가 아니라 대상 전체를 말하는 사실이라 머리 줄이 임자다. 그래서 "태그가 16px
      이라 줄이 안 자란다"는 옛 근거는 전제가 사라졌고, 이 줄의 높이는 그냥 `fmKey` 의
      leading-4 (16px) 다. 토큰이 남는 이유는 그 16px 을 `truncate` 와 함께 붙들어 두는
      것이고(min-w-0 + flex), 라벨이 긴 프로바이더에서 잘림이 여기서 일어난다. */
  fmKeyRow: 'flex min-w-0 items-center gap-1.5',
  /** 라벨 12/500 — 값(14/600)에 계층을 넘긴다 (오너 2026-08-27 "값을 14 픽셀로 수정해볼래?
      이게 계층 정리가 될 듯"). 라벨은 대상마다 안 바뀌는 고정 문자열이라 한 번 익히면 다시
      읽히지 않고, 이 줄에서 운영자가 대조하는 것은 값이다. 크기·무게 두 레버가 값 쪽에
      모인다. 색은 그대로 gray-600(워시 위 6.98:1). */
  fmKey: 'truncate text-[12px] font-medium leading-4 text-[var(--pl-gray-600)]',
  /** 수정할 수 있는 **값** (오너 08-26 "해당 값에 밑줄을 그어야지. 밑줄은 파란색으로") —
      값 옆에 서 있던 「수정」 링크가 값 자신으로 접혀 들어간다. 글자색은 값의 것으로 두고
      밑줄만 파랗다: 파랑이 글자를 먹으면 이 줄에서 나가는 링크들과 같은 것이 되는데, 이건
      여기서 모달을 여는 것이라 신호는 밑줄이 지고 색은 그 밑줄에만 실린다.
      08-20 의 판례는 *태그*가 눌리는 척하지 말라는 것이라 부딪히지 않는다 — 여기서
      눌리는 것은 흰 면 태그가 아니라 mono 값이다. */
  /** 「설정」 값의 수정 신호 — 글자는 **검정**, 파랑은 밑줄에만 (오너 2026-08-27 "검은색으로
      바꿔. 파란색 너무 눈에 띈다"). 세 라운드를 돌아 여기 왔다: gray-600(너무 조용) →
      파랑 글자 14/600(너무 셈) → 파랑 14/500 → 검정 14/500 + 파란 밑줄.

      남은 문법은 `fmValueEdit`(ARN 수정)와 같다 — 글자색은 값의 것으로 두고 신호는 밑줄이
      진다. 다른 점은 무게 하나뿐이다(500): 이 칸은 「사실」이 아니라 「설정」이라, 옆 칸의
      식별자(14/600)보다 한 단 뒤에 선다. 이 줄의 파랑은 이제 링크(오른쪽 단)와 밑줄들뿐이라
      글자를 파랗게 칠할 때 생기던 "다른 화면으로 간다"는 오독도 사라진다. */
  fmSettingEdit:
    'cursor-pointer text-[14px] font-medium text-[var(--pl-text-strong)] underline underline-offset-2 decoration-[var(--pl-primary)] transition-colors hover:decoration-[var(--pl-primary-hover)]',
  fmValueEdit:
    'cursor-pointer underline underline-offset-2 decoration-[var(--pl-primary)] transition-colors hover:decoration-[var(--pl-primary-hover)]',
  /** 「설정」 한 칸 (design-benchmark `ops-settings-cells.md` 시안 A + F 문법, 오너 08-26
      "「설정」 병합 셀 괜찮음") — 설치모드·실데이터가 각자 라벨과 흰 면 태그와 「수정」
      링크를 갖던 두 칸이 한 칸이 된다. 라벨이 하나로 줄었으므로 값이 스스로를 설명해야
      한다: 「자동」이 아니라 「자동 설치」, 「미포함」이 아니라 「실데이터 미포함」.
      AWS 자동 배치에서 그리드가 2행 → 1행이 된다(계정·Scan·TF·설정 = 정확히 4칸). */
  fmSettings: 'flex flex-wrap items-center gap-x-1.5 gap-y-0.5',
  fmSettingsSep: 'text-[var(--pl-text-weak)]',
  /** `min-h` 가 있는 이유: 흰 면 태그가 들어오는 셀(22px)과 글자만 있는 셀의 높이를
      같게 잡아 둔다. 안 맞추면 같은 행 안에서 프로바이더마다 셀이 엇갈린다. */
  /** 값 14/600 — 스트립의 주인공 (오너 2026-08-27). GCP 서비스 계정이 전문 대신 이름만
      남으면서 이 줄의 값들이 전부 짧아졌고, 그래서 한 단 키울 폭이 생겼다. `min-h` 는
      leading-5 에 맞춰 22 → 24px. */
  fmValue:
    'flex min-h-[24px] min-w-0 items-center gap-2 text-[14px] font-semibold leading-5 text-[var(--pl-text-strong)]',
  fmValueText: 'min-w-0 truncate',
  fmNone: 'text-[14px] font-medium text-[var(--pl-gray-600)]',
  /** 글꼴만 바꾼다 — 무게는 **자리가 정한다** (스트립 `fmValue` 600 · 폴드 `fmValueFull`
      500). `font-medium` 을 여기 박아 두면 값이 14/600 으로 올라간 뒤에도 mono 값만
      500 으로 남아 라벨과의 레버가 크기 하나로 줄었다(실측으로 잡음). */
  fmMono: '[font-family:var(--pl-font-mono)]',
  fmLink:
    'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap text-[12px] font-semibold text-[var(--pl-primary-hover)] underline underline-offset-2 decoration-[var(--pl-primary-ring)] hover:decoration-[var(--pl-primary-hover)]',

  /**
   * 「상세 정보」 접힘 — 3열이라 열려도 사실이 세로로 쌓이지 않는다. 236px 레일이 지고
   * 있던 서비스 축(이름·코드·Jira·운영)과 설명이 여기로 들어오고, 계약에는 있는데
   * 화면엔 없던 사실(생성일 · Tenant ID)과 주체 **전문**이 함께 선다.
   */
  /**
   * 접힘은 **위 그리드와 같은 열 규칙에 선다** (오너 08-26 "기존 정보들과 정렬이 안 맞는
   * 부분이 존재합니다"). 전에는 220/460/460 · gap 24 라 열 규칙이 화면에 둘이었고, 실측
   * x 가 248·492·976 대 248·506·764·1022 로 첫 열만 맞았다. 같은 240/18 에 얹으면 세
   * 묶음이 전부 위 사실의 열선 위에서 시작한다 — 접힘을 여는 것이 열을 새로 그리는 일이
   * 아니라 **같은 열을 아래로 잇는** 일이 된다.
   *
   * 폭은 필요한 만큼만 준다: 식별자는 전문이 한 줄에 서야 하니 2열이고 — 가장 긴 값인
   * AWS Terraform Role ARN 이 394px, GCP Terraform SA 가 365px 라 한 열(240px)로는
   * 못 서고 두 열(498px)이면 선다 — 나머지 둘은 짧은 값과 산문이라 1열. 산문은 접히라고
   * 있는 것이고 ARN 은 아니다.
   */
  fmFold: 'grid grid-cols-[repeat(4,minmax(0,240px))] gap-x-[18px] gap-y-4 pt-3.5',
  /** GCP 만 폴드도 **3등분**이다 (오너 2026-08-27 "gcp 더보기도 동일하게 정렬 맞춰") —
      위 스트립이 `fmGridGcp` 로 3등분이라, 폴드가 240px 격자에 서면 열 규칙이 화면에 둘이
      된다(실측 @1900: 스트립 248 / 689 / 1130 대 폴드 248 / 506 / 764). 같은 3등분에
      얹으면 열선이 하나가 되고, 폴드를 여는 것이 열을 새로 그리는 일이 아니라 **같은 열을
      아래로 잇는** 일이 된다 — 위 `fmFold` 의 08-26 원칙 그대로고, 바뀌는 것은 격자뿐이다.

      ⚠️ 폴드의 식별자 값은 옆에 복사 버튼(`fmCopy` 18px + gap 4)을 달고 서므로, 한 열이
      받는 글자 폭은 열 폭에서 22px 을 뺀 만큼이다 — 전문 428px + 22 = 450px 라 @1900 의
      441px 열에서도 한 줄에 못 선다. 폴드 값은 `fmValueFull` 의 `break-all` 이라 잘리지
      않고 접히므로 해가 없지만, "한 줄에 선다"는 계산은 하지 말 것.

      세 묶음(서비스 · 대상 · 식별자)이 정확히 세 열이라 `wide` 가 필요 없다: @1900 에서 한
      열이 441px 이고, GCP 의 가장 긴 값인 Service Account 전문은 `fmValueFull`(14px)에서
      433px 이라 한 열에 선다. 좁아지면 `fmValueFull` 이 이미 `break-all` 이라 접힌다
      (자르지 않는다). */
  fmFoldGcp: 'grid grid-cols-3 gap-x-6 gap-y-4 pt-3.5',
  fmFoldGroup: 'flex min-w-0 flex-col gap-2.5',
  fmFoldLabel: 'text-[12px] font-bold tracking-[0.06em] text-[var(--pl-gray-600)]',
  /** 설명 본문 — 접힘 안에서는 전문을 편다. 표시를 100자에서 접던 것은 레일이 236px
      였기 때문이고, 3열 접힘에는 그 폭 제약이 없다. */
  fmProse: 'break-words text-[12px] font-medium leading-[18px] text-[var(--pl-text-strong)]',
  /** 전문 값 — 자르지 않는다. ARN·Service Account 는 접힌 이름이 아니라 문자열 전체가
      정보라(복사해 콘솔에서 찾는 값) 이 자리에서만은 truncate 를 걸지 않는다. 이것이
      title 툴팁 안에만 있던 전문을 화면으로 꺼내는 자리다. */
  /** 14px — 스트립 값(`fmValue`)과 같은 급이다 (오너 2026-08-27 "pii-agent-terraform
      이것도 14픽셀"). 접힘의 짧은 값들은 이미 `fmValue` 로 14 라, 전문만 12 로 남으면
      같은 대상의 같은 사실이 두 크기로 적힌다. `break-all` 이라 열이 좁아지면 자르는
      대신 접힌다 — 14px 에서 Service Account 전문은 433px 이고 @1900 폴드 한 열이
      441px 이라 한 줄에 선다. */
  fmValueFull: 'break-all text-[14px] font-medium leading-5 text-[var(--pl-text-strong)]',
  /** 복사 — 값 옆의 아이콘 하나. 글자가 아니라 그래픽이라 3:1 기준이다. 바닥이
      gray-200 이 된 뒤 weak 는 4.01 이라 램프 한 칸 아래 gray-600(6.20)이 진다. */
  fmCopy:
    'inline-flex flex-none cursor-pointer items-center rounded p-0.5 text-[var(--pl-gray-600)] transition-colors hover:text-[var(--pl-primary-hover)]',

  /** Neutral tag / region tag — shared with ServiceDetailView (Figma 49:4/34:4). */
  tag: 'inline-flex items-center rounded px-2 py-1 text-[12px] font-semibold bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)] whitespace-nowrap',
  regionTag: 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',
  /**
   * 흰 면 + 획 칩 — the 실데이터 tag on the service-ops target cards
   * (ServiceDetailView). This screen's own editable values moved to `metaTag`
   * (오너 08-20 넷째 조정), one notch louder, but they keep this grammar.
   *
   * 색이 아니라 획으로 선다. R1′ V-b 레일은 카드 없이 캔버스 위 맨몸이라, 흰 면은
   * 이 화면에서 "만질 수 있는 값"에만 남는다 — 그 문법을 이 칩이 진다. 값의 밑줄이
   * affordance 를 지고(countLink 규칙) 색은 상태(StepPill)에 남는다.
   *
   * 대비 실측: 글자(--pl-text-strong) on 면(--pl-bg-card) = 17.85:1. 면은 이 화면의
   * 바닥(--pl-gray-200) 위에서 ΔE00 5.66 — 옛 라벤더 캔버스에서의 4.12 보다 벌어졌다.
   * 카드 hover 틴트 위에서는 8.92 그대로 (tableRowLift.card 주석의 실측치와 같은 쌍).
   */
  rawDataTag: 'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-semibold border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)]',
  /**
   * Masthead meta tags (오너 08-20 넷째 조정) — the editable values (설치모드·
   * 실데이터) read as emphasized tags and the ACTION moves to a 수정 link beside
   * them, so the tag no longer has to look clickable (no underline, no hover
   * fill). ⚠️ metaTag(흰 면 + 강한 획)는 08-26 에 은퇴했다 — 시안 A+F 로 설정 두 칸이
   * 값 밑줄 하나가 되면서 이 그리드에 흰 면 태그가 남지 않는다. 되살릴 일이 생기면
   * 그 규칙("흰 면 = 수정 가능")부터 다시 세워야 한다. metaTagQuiet = the read-only attribute tag,
   * which must NOT wear the white face — that face means "editable value" here.
   * ⚠️ 2026-08-27: 파티션은 이 토큰을 떠났다 — 블록 머리로 올라가면서 `partitionTag` 를
   * 입는다(08-28 부터 중국에만 선다). 여기 남은 것은 IDC 「환경」 값 줄의 태그 하나뿐이다.
   *
   * 그 태그는 gray-200 이었는데 오너가 "회색은 너무 칙칙해 보임" 이라 했다 (08-26).
   * 이 콘솔에서 옅은 칠은 이미 임자가 있다: `--pl-info-bg` 는 RUNNING·진행 중이고
   * (`detailJobStyles` · `ConfirmStatusPill` 등 일곱 자리), `--pl-primary-bg` 는
   * 누를 수 있는 것이다. ok/err/warn 은 판정이라 파티션에 쓸 수 없다. 남는 유일한
   * 계열이 `--pl-current` 바이올렛 — 이 콘솔에서 상태도 링크도 아닌 "정체" 쪽
   * 어휘이고(서비스 레일의 "여기 있음", 캔버스와 같은 가족), 그래서 파티션·환경
   * 같은 **속성**이 앉을 자리다. 칠이 워시와 가까워서 테두리가 형태를 진다.
   */
  /** 10/14 에 padding 4·0 — 테두리까지 **정확히 16px** (오너 08-26 "태그 크기가 너무 크다").
      12/18 에 px-1.5 py-0.5 이던 22px 짜리가 값 줄의 높이를 혼자 정하고 있었다. 태그는 값이
      아니라 값에 붙는 단서라, 제가 선 줄의 높이를 정하면 안 된다 — 지금 남은 자리(IDC
      「환경」)도 값 줄이므로 그 규칙은 그대로다. */
  metaTagQuiet:
    'inline-flex items-center whitespace-nowrap rounded border border-[var(--pl-current)] bg-[var(--pl-current-bg)] px-1 text-[10px] font-semibold leading-[14px] text-[var(--pl-current-ink)]',

  /**
   * 파티션 태그(중국) — 「연동 대상」 블록 머리에서 단계 알약 오른쪽에 선다.
   *
   * 다는 대상에만 단다: 중국이면 「중국」, 아니면 아무것도 없다 (오너 2026-08-28 "Admin
   * 페이지에서 중국으로 표기하라는거야. Global로 표현되고 있던 부분이 있으면 이것도 그냥
   * 없애. 따로 보여주지마"). Global 은 대다수 대상의 상태라, 모두가 다는 표는 아무것도
   * 가르지 못하면서 머리 줄의 자리만 먹는다 — 태그의 **부재**가 Global 이다.
   *
   * 이 태그는 kv 라벨의 장식이 아니라 **머리 줄의 단서**다. 파티션은 계정·프로젝트·구독
   * 어느 한 칸의 속성이 아니라 그 대상이 어느 권역에 사는지의 사실이고, 그래서 단계
   * 알약("지금 어디")과 같은 줄에 선다 — 둘 다 대상을 통째로 서술한다.
   * `metaTagQuiet` 를 돌려쓰지 않은 이유: 그 토큰은 10px 짜리 IDC 속성 태그로 남아 있고,
   * 여기서 필요한 것은 알약과 같은 급의 14px 이다.
   *
   * 기하: 14/16 에 px-1.5 py-0.5 = **정확히 20px** 로, 액자 알약(14 + py 4 + border 2)과
   * 같은 높이다. 그래서 머리 줄은 이 태그 때문에 한 픽셀도 자라지 않는다. 라운드는 알약의
   * full 이 아니라 4px — 알약 모양을 빌리면 상태를 말하는 것으로 읽히고, 그보다 각지면
   * 누를 것(버튼)으로 읽힌다.
   */
  partitionTag:
    'inline-flex flex-none items-center whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[14px] font-bold leading-4',
  /** 중국 — 빨강 (오너 2026-08-27 "China는 빨간색으로 표시하자"; 08-28 에 말만 「중국」으로
      바뀌고 색은 그대로다). `--pl-err-*` 를 쓰지 않는 이유는 그 램프가 **실패**를 말하기
      때문이다: 파티션은 실패가 아니라 이 대상의 상시 사실이라, 같은 자리에서 오류 배지로
      읽히면 안 된다. 그래서 채도·명도를 낮춘 짝을 `partitionColors` 에 따로 세웠다
      (실측 6.59:1). */
  partitionChina: `${partitionColors.chinaBg} ${partitionColors.chinaInk}`,

  /**
   * Line tabs on the ops ground (design-benchmark `ops-tab-band.md` 시안 A) —
   * no band. The tabs stand on the same gray-200 the masthead does, closed
   * by hairlines in --pl-gray-400. That token used to draw the 「연동 대상」
   * block head too, so the masthead ended on the same stroke its own blocks did;
   * the block heads gave their hairline up (오너 2026-08-27), which leaves these
   * the only --pl-border-strong strokes on the wash.
   *
   * The band (08-20 셋째 조정) existed because the masthead had no way to close
   * itself: the wash ran into the canvas and something had to draw the seam. The
   * FrontMeta rewrite gave it a hairline vocabulary, so that premise is spent.
   *
   * ⚠️ 밴드를 기각한 근거 중 하나("밴드 위에서 --pl-primary 가 4.17 로 AA 실패")는
   * **바닥이 gray-200 이 되면서 만료됐다** — 이제 그 4.17 이 이 화면의 사실이다.
   * 죽은 것은 띠가 아니라 파란 잉크였고, 그래서 활성 탭은 --pl-primary-hover(5.41)로
   * 내려갔다. GitHub 의 UnderlineNav 도 활성·비활성이 같은 잉크를 쓰고 굵기와 2px
   * 표시자로만 가른다.
   *
   * The full bleed goes with it. `-mx-8 … px-8` made this strip the only thing on
   * the screen reaching the wash's own edges while every fact above and every card
   * below stands in the content column, so its hairline cut across x the content
   * never touches (Primer: navigation lives inside the width it governs).
   */
  /** `overflow-x-auto` 는 없다 — 아홉 탭의 전체 폭이 840px 이라 1422px 열에서 넘칠 일이
      없고(실측: 「연결 테스트」의 인라인 슬롯과 구간 갭 22px 세 칸까지 포함한 값이다.
      단계 마크가 코너로 올라가 흐름 밖에 서면서 788 에서 732 로 내려왔고, 「연동 초기화」
      가 제 구간을 열면서 840 으로 올라왔다), 스크롤 컨테이너로
      두면 활성 탭의 `-mb-px` 가 1px 짜리 세로 스크롤을 만든다. 밑줄이 헤어라인을
      먹으려면 그 1px 은 밖으로 나가야 한다. */
  /**
   * 내비게이션은 **선 두 개 사이에 산다** (오너 2026-08-27 "Navigation 위쪽에 구분선을
   * 하나 더 두자 … 위 아래 구분선이 Navigation이다라는 느낌만 주게"). 밴드를 걷고 나니
   * 탭이 마스트헤드와 같은 워시 위에서 같은 활자로 섰고, 아래 선 하나는 블록 머리를
   * 닫는 그 선과 구별되지 않아 탭 줄이 사실 한 줄로 읽혔다. 선이 짝이 되면 그 사이가
   * 하나의 띠가 된다 — 칠을 하나도 쓰지 않고 묶는다("Structure should be felt not seen").
   *
   * 위 여백은 20px 로, 블록↔블록과 같은 칸이다. 블록 머리의 헤어라인이 사라진 뒤로
   * (오너 2026-08-27) 이 바닥 위에서 `--pl-gray-400` 획은 **이 띠뿐**이다 — 위 한
   * 줄과, 그룹마다 끊기는 아래 도막들. 그래서 마스트헤드의 마지막 사실과 이 띠 사이는
   * 블록이 갈리는 거리만큼 떨어져 있으면 되고, 이 획들이 하는 말은 하나다:
   * "여기서 내비게이션이 시작한다".
   * 탭의 py-2.5 가 선 안쪽 10px 을 위아래로 똑같이 준다 — 띠는 대칭이다.
   *
   * 아래 선만 `tabGroup` 으로 내려갔다 (ops-nav 시안 A). 위 선은 통으로 남아 띠의
   * 천장을 진다 — 두 선 중 하나가 끊기면 나머지가 띠를 계속 붙들고 있어야 한다.
   *
   * 획은 `--pl-border-strong` 이 아니라 **gray-400** 이다. 바닥이 gray-200 이 되면서
   * `--pl-border-strong` 은 1.338(옛 워시 위) → **1.189** 로 주저앉았다 — 칠이 사라진 자리에서
   * 헤어라인이 하중을 넘겨받는데, 정작 그 획이 옅어진 것이다. 되돌리는 것으로는 모자란다:
   * 워시가 있던 시절엔 워시의 경계가 띠를 같이 붙들었지만 이제 **이 두 선이 내비게이션의
   * 전부**이므로(오너 08-27 "위 아래 구분선이 Navigation이다라는 느낌만 주게"), 획은
   * 제자리로 돌아가는 게 아니라 한 칸 올라간다 — gray-400 은 바닥 위 **2.078** 이다.
   * hover 밑줄도 같이 올라간다: 띠의 선보다 옅은 hover 는 순서가 뒤집힌 것이다.
   *
   * `gap-[22px]` 는 램프 밖의 값이지만 임의로 고른 것이 아니다 — 스페이서 `<span>`
   * (w-3.5) 이 `gap-1` 두 칸 사이에 서 있던 옛 구조의 실제 거리(4+14+4)를 그대로
   * 옮긴 값이다. 구간이 갈리는 거리는 시안 A 에서 **변경 대상이 아니었다**: 바뀌는
   * 것은 그 갭에서 선이 끊긴다는 것 하나뿐이다. `gap-5`(20)·`gap-6`(24)로 반올림하면
   * 조정한 적 없는 간격이 조용히 움직인다. */
  tabStrip: 'mt-5 flex items-stretch gap-[22px] border-t border-[var(--pl-gray-400)]',
  /**
   * 구간 헤어라인 — 아래 선을 그룹마다 따로 긋는다. 아홉 탭은 네 가지 일이고
   * (보기 · 실행 · 승인·근거 · 초기화), 그 경계는 지금까지 빈 칸 하나로만 서 있었다. 선이
   * 갭에서 **끊기면** 그 빈 칸이 우연한 여백이 아니라 구간의 끝으로 읽힌다 — 칠도
   * 밴드도 라벨도 없이(전부 이 줄에서 기각된 것들이다) 묶음이 보인다.
   *
   * 그룹 안의 `gap-1` 아래로도 선은 이어진다 — 선이 끊기는 곳은 오직 그룹 사이다.
   * 활성 탭의 `-mb-px` 는 이제 제 그룹의 선을 먹는다(기하는 그대로).
   */
  /** ⛔ `min-w-0` 를 주지 않는다. 탭은 `min-width:auto` 라 내용 밑으로 줄지 않으므로,
      그룹만 줄 수 있게 하면 탭이 제 그룹 상자를 넘고 **그룹이 긋는 아래 선이 탭보다 짧아진다**.
      그룹도 내용 폭에서 멈추면, 열이 좁아졌을 때 균등 폭을 포기하고 오늘의 행동으로 돌아간다. */
  tabGroup: 'flex basis-0 items-end gap-1 border-b border-[var(--pl-gray-400)]',
  /** 스켈레톤에서만 아래 선을 **스트립**이 진다. 구간이 몇 개이고 어디서 끊기는지는 탭
      구성이고 탭 구성은 데이터라, 도착 전에는 지어낼 수가 없다. `tabGroup` 하나로 감싸면
      아래 선이 보이지 않는 탭 하나의 폭만 덮어(44px) 도착 순간 세 도막(732px)으로 뛴다 —
      1px 획이라 레이아웃은 안 움직이지만 잉크가 통째로 바뀐다. 통으로 그어 두면 바뀌는
      것은 선이 **끊기는 자리**뿐이다. */
  tabStripLoading: 'border-b border-[var(--pl-gray-400)]',
  /**
   * Geometry is `accessStyles.tab` verbatim (the 접근 권한 page tabs) — the admin
   * console should have one line-tab, not two that differ by a few px.
   */
  /** 14/600 — 크기는 다시 14 로 내렸고(오너 2026-08-27, 16 은 되돌림) 굵기만 남는다.
      크기까지 오르면 탭이 이 화면에서 가장 큰 활자가 되어 블록 이름(14)을 넘어서는데,
      띠를 만드는 일은 이미 선 두 개가 하고 있어서 활자가 더 낼 소리가 없었다.
      굵기는 활성·비활성이 같이 진다: 활성은 이미 잉크와 밑줄 두 레버를 들고 있어서,
      굵기까지 가져가면 비활성이 한 단 더 내려앉고 선택이 아니라 나머지가 흐려진 것처럼
      읽힌다. */
  /**
   * 셀은 **한 폭을 나눠 가진다** (오너 2026-08-29 "각 navigation 메뉴마다 일정한 width가
   * 할당되지 않았음"). 내용 폭으로 두면 「스캔」 47.8 ↔ 「연동 요청 정보」 101.5 로 **2.12배**
   * 벌어지고, 아홉이 840px 만 덮어 1422px 열의 **582px(41%)** 가 꼬리로 남았다. 그 꼬리가
   * 두 번째 문제였다: 위 선은 통으로 그어지는데 아래 선은 그룹이 지므로, 꼬리 구간에는
   * 천장만 있고 바닥이 없어 띠가 오른쪽으로 열려 있었다.
   *
   * `flex-1 basis-0` + 그룹의 `growOf`(탭 수)가 그 둘을 한 번에 닫는다 — 셀이 열을 채우면
   * 꼬리가 사라지고, 아래 선이 그룹 갭(22px 세 칸)만 빼고 끝까지 따라간다. 갭에서 끊기는
   * 것은 그대로라 구간은 계속 읽힌다.
   *
   * ⚠️ 정확히 같지는 않다. 그룹 안의 `gap-1`(4px)은 grow 비율 밖이라 갭 수가 다른 그룹의
   * 셀이 조금 넓다 — @1422 열에서 **147.67 / 148.67 / 150.67px**(실측, 편차 1.020배).
   * 2.12배를 1.02배로 줄인 것이지 0 으로 만든 것이 아니다. 3px 을 마저 없애려면 갭을
   * 빼야 하는데, 그러면 활성 탭의 2px 밑줄이 옆 탭과 맞닿아 세그먼트 컨트롤로 읽힌다.
   *
   * `min-width:auto` 는 그대로 둔다 — 열이 좁아져 균등 폭이 가장 긴 라벨보다 작아지면
   * 셀은 균등을 포기하고 내용 폭으로 돌아간다. 좁은 화면에서 글자가 잘리는 대신 오늘의
   * 행동으로 되돌아가는 쪽이 맞다.
   *
   * 라벨은 가운데로 온다. 균등 셀에서 왼쪽 정렬은 라벨마다 오른쪽 여백이 달라져 셀의
   * 리듬이 아니라 낱말 길이가 보인다.
   */
  tab: 'relative flex flex-1 basis-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap border-b-2 -mb-px px-3 py-2.5 text-[14px] font-semibold transition-colors',
  /** 잉크 + 밑줄. The face is gone, so 파랑 is the only thing marking the tab that
      is open. gray-200 바닥 위에서 --pl-primary 는 4.17 로 AA 아래라, 램프의 다음 칸
      --pl-primary-hover 가 진다 — 5.41:1 (실측). */
  tabActive: 'text-[var(--pl-primary-hover)] border-[var(--pl-primary-hover)]',
  /** 바닥은 램프 한 칸을 잡아먹는다 — `--pl-text-weak` (accessStyles' idle ink) is
      only 4.01 here, so idle stays at medium: 8.44:1 (실측). */
  tabIdle:
    'text-[var(--pl-text-medium)] border-transparent hover:text-[var(--pl-text-strong)] hover:border-[var(--pl-gray-400)]',
  /**
   * 걸린 단계의 마크 — 탭 **우상단 코너의 점** (오너 2026-08-27 "보라색 밑줄 말고
   * 확인 필요처럼 보이는 시각적 요소를 써볼까? 우상단의 빨간색 점은 어때?").
   *
   * 밑줄이었을 때는 파랑과 같은 자리를 다퉈서 "열린 탭 == 걸린 탭" 일 때 하나가
   * 물러나는 규칙이 필요했다. 코너로 올라오면 자리가 달라서 그 규칙이 통째로
   * 사라진다 — 두 사실이 동시에, 서로를 덮지 않고 선다.
   *
   * `absolute` 라 흐름 폭을 먹지 않는다: 단계가 어느 탭에 걸리든 아홉 탭의 x 는
   * 그대로다. 라벨 옆 인라인 슬롯을 예약해야 했던 이유(=자리를 먹는 마크)가 여기엔
   * 없다. 8px 은 이 화면이 이미 쓰는 점 크기이고(`tcBand.countDot`), 4px 인셋이
   * 위 헤어라인과 라벨 사이의 빈 모서리에 정확히 들어간다(실측).
   */
  tabCorner: 'absolute right-1 top-1 h-2 w-2 rounded-full',
  /**
   * 코너 점은 **한 색이다** (오너 2026-08-29 "색상은 모두 빨간색으로 통일해").
   *
   * 08-27 에는 둘이었다 — 6단계(CONNECTED, 관리자 승인 대기)만 빨강이고 2·3·4·5 는
   * `--pl-current` 보라였다. 그 갈래의 근거는 "걸렸다는 사실 전체에 빨강을 주면 빨강이
   * 상시 켜져 아무 말도 하지 않게 된다" 였는데, 오너가 그 대가를 받기로 했다: 점이
   * 말하는 것은 한 가지("이 대상은 여기 걸려 있다")이고, 색이 둘이면 읽는 사람이
   * 색부터 해석해야 한다. 어느 단계인지는 색이 아니라 **점이 붙은 탭**이 말한다.
   *
   * 갈래는 낱말에 남는다 — 6단계만 「확인 필요」, 나머지는 「현재 N단계」다(`stepWord`).
   * 그쪽은 화면의 소리를 늘리지 않으면서 스크린 리더에 사실을 그대로 전한다.
   *
   * `--pl-err-solid` 는 바닥 위 3.90 (실측) 로 그래픽 3:1 위다. 같은 빨강을 `tabDotFail`
   * 도 쓰지만 뜻이 겹치지 않는다: 저쪽은 라벨 옆 인라인이고 이쪽은 코너다 — 자리가 두
   * 사실을 가른다(실행이 실패했다 vs 이 대상이 여기 서 있다).
   */
  tabCornerAlert: 'bg-[var(--pl-err-solid)]',
  /**
   * 「연결 테스트」 탭의 상태 점 — 8px, the size this screen's own dots already use
   * (`tcBand.countDot`, ConfirmEditorModal). It says only that the latest run
   * failed or is still open; the tab itself says the rest. No count badges: a
   * number on a tab claims the tab is a worklist (#735).
   *
   * 색은 그래픽이라 3:1 기준이다. `--pl-err` 는 바닥 위 3.03 으로 겨우 그 위라, 이 점은
   * 8px 이라 램프를 한 칸 더 내려 `--pl-err-solid`(3.90, 실측)를 쓴다. 진행 중은
   * `--pl-info` 가 2.61 로 3:1 을 **못 넘어서**(실측) 같은 계열의 다음 칸
   * `--pl-info-text`(4.83)가 진다.
   *
   * 자리는 늘 잡혀 있고 `opacity` 로만 나타난다 — 즉 점은 항상 렌더되고 보이지 않는
   * 동안에도 제 폭을 차지한다. TC 응답은 마스트헤드보다 늦게 도착하는데, 이 점은 라벨 옆
   * **흐름 안**에 있어서 `display` 로 끼어들면 그때마다 오른쪽 탭들의 x 가 밀린다.
   * 코너 점(`tabCorner`)이 예약 없이 그냥 나타나도 되는 것은 그쪽이 흐름 밖이기 때문이다.
   */
  tabDot: 'h-2 w-2 flex-none rounded-full transition-opacity',
  tabDotFail: 'bg-[var(--pl-err-solid)]',
  tabDotRunning: 'bg-[var(--pl-info-text)]',

  /** Body — 콘텐츠 한 열. 236px 메타 레일은 FrontMeta 의 「상세 정보」로 접혀 들어갔고,
      그 폭은 탭 7개 전부에서 본문으로 돌아간다 (1020 → 1280px). */
  body: 'flex flex-1 flex-col px-8 pt-6 pb-12',
  content: 'flex min-w-0 flex-1 flex-col gap-4',

  /** Skeleton bar ON THE GROUND — 바닥이 gray-200 이 되면서 이 자리의 gray-200 은
      바닥과 **같은 값**이 됐다(1.000). 그래서 한 칸 더 내려간다: gray-300, 바닥 위 1.19
      로 gray-100 이 흰 카드 위에서 내던 단차와 같은 급이다. */
  skeletonWash: 'animate-pulse rounded-[6px] bg-[var(--pl-gray-300)]',
  /** Side-by-side cards — grid rows stretch so the pair is always equal height. */
  cardsRow: 'grid grid-cols-2 gap-4',
  /** 20px — at 16px the card title reads the same tier as in-card block headers (ops feedback, scan tab). */
  cardTitle: 'text-[20px] font-semibold text-[var(--pl-text-strong)]',
  /** 14/weak, 12px below the title — the helper line recedes to gray, one tier under body headers. */
  cardDesc: 'text-[14px] text-[var(--pl-text-weak)] mt-3',
  /**
   * 관측 스코프 태그 — 카드 머리 메타 줄의 '최근 7일' (오너 2026-08-25: "파란색 태그로").
   *
   * 중립 회색 태그는 이 줄의 글자색(`--pl-text-weak`)과 같은 계열이라 태그가 아니라 굵은
   * 글자로 읽혔다. 파랑은 앱이 상호작용에 쓰는 한 가지 색이지만, 여기서는 면만 쓰고 밑줄도
   * 커서도 없어 누를 것으로 읽히지 않는다 — 같은 줄 오른쪽의 '전체 현황 보기'가 파란 **글자**
   * 라, 채널이 갈린다(면=라벨, 글자=진입).
   *
   * 색은 `primaryColors` 의 bgLight/textOnLight 를 그대로 받는다(그 짝이 5.92:1) — 파란 태그
   * 가족이다. 값을 손으로 베끼지 않는 이유는 census 다: 토큰이 움직이는 날 손복사본만
   * 제자리에 남아 두 파랑이 된다.
   *
   * ⛔ `cardStyles.stepTag` 를 빌려 쓰지 말 것: 그 토큰은 「N단계」 13개 헤드의 것이고
   * `design-guard.test.ts` 의 인구조사가 집합으로 고정한다. 그래서 기하도 일부러 다르다
   * (4px 라운드·semibold — 메타 줄의 가벼운 태그).
   */
  scopeTag: `inline-flex flex-none items-center rounded-[4px] px-1.5 py-0.5 text-[12px] font-semibold ${primaryColors.bgLight} ${primaryColors.textOnLight}`,

  /** A paged card in cardsRow: column layout so the pager sits at the bottom. */
  pagedCard: 'flex flex-col',
  /** Its body slot — tall enough for a full PAGE_SIZE(5) table, so a card with
      one row (or none) does not shrink below its sibling. `flex-1` then absorbs
      any extra height the taller sibling forces on this one. */
  pagedCardBody: 'mt-3 min-h-[266px] flex-1',

  /** In-cell count link — the user-side Step 6/7 grammar (LogicalDbCountCell
      `linkNeutral`): the underline carries the affordance so color stays free to
      mean state, because this link repeats once per row. */
  countLink:
    'inline-flex cursor-pointer items-center border-b border-current pb-px text-[14px] font-semibold tabular-nums text-[var(--pl-text-medium)] transition-colors hover:text-[var(--pl-text-strong)]',

  /** In-cell text action that opens an editor — the Credential cell. A select box
      per row turns the table into a toolbar and buries the value inside a control,
      so the value IS the trigger. The hint's slot is reserved (opacity, not
      display) so revealing it never shifts the column, and focus-visible reveals
      it too: hover is never the only cue. */
  cellAction:
    'group inline-flex max-w-full items-baseline gap-2 rounded py-0.5 text-left text-[14px] text-[var(--pl-text-medium)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--pl-primary)]',
  cellActionValue:
    'truncate border-b border-transparent group-hover:border-current group-hover:text-[var(--pl-text-strong)] group-focus-visible:border-current group-focus-visible:text-[var(--pl-text-strong)]',
  cellActionEmpty:
    'truncate border-b border-transparent text-[var(--pl-text-faint)] group-hover:border-current group-hover:text-[var(--pl-text-medium)] group-focus-visible:border-current group-focus-visible:text-[var(--pl-text-medium)]',
  cellActionHint:
    'flex-none text-[12px] font-semibold text-[var(--pl-primary)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',

  /** Credential 배정 modal — a scrolling radio group built on the resource table's
      grammar: hairline row dividers, no box, no fill. A credential is a value in a
      list, not a card; boxing and bolding each one made 3 rows look important and
      would make 20 unreadable. Only the checked row is tinted (state). */
  credModal: {
    search:
      'mt-1 h-9 w-full rounded-lg border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] px-3 text-[14px] text-[var(--pl-text-strong)] placeholder:text-[var(--pl-text-faint)] focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]',
    /** Fixed height, not max-height: the list must not resize as the query filters
        it, and 3 credentials must occupy the same box as 30. */
    list: 'h-[300px] overflow-y-auto border-t border-[var(--pl-border)]',
    row: 'cursor-pointer border-b border-[var(--pl-gray-100)] hover:bg-[var(--pl-gray-50)]',
    rowOn: 'bg-[var(--pl-primary-bg)] hover:bg-[var(--pl-primary-bg)]',
    radio: 'h-4 w-4 flex-none accent-[var(--pl-primary)] cursor-pointer',
    /** 값 칸은 한 단이다 — 어느 행이 골라졌는지는 라디오와 행 배경이 이미 말하므로, 굵기까지
     *  얹으면 이름 열만 혼자 떠서 표가 기울어 읽힌다. */
    cell: 'truncate px-2 py-2.5 align-middle text-[14px] text-[var(--pl-text-medium)]',
    /** 열 이름이 곧 정렬 버튼. sticky 라 300px 를 스크롤해도 컨트롤이 사라지지 않는다. */
    headCell:
      'sticky top-0 z-10 whitespace-nowrap border-b border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-2 py-2 text-left text-[12px] font-medium text-[var(--pl-text-weak)]',
    sortBtn: 'inline-flex cursor-pointer items-center gap-1 hover:text-[var(--pl-text-strong)]',
    sortOn: 'text-[var(--pl-text-strong)]',
    used: 'whitespace-nowrap px-2 py-2.5 text-right align-middle text-[14px] tabular-nums text-[var(--pl-text-weak)]',
    empty: 'px-1 py-8 text-center text-[14px] text-[var(--pl-text-weak)]',
    /** 대상 3단 머리 — 라벨 / 값 / 안내. 값은 mono: Resource ID 는 읽는 값이 아니라 대조하는 값이다. */
    targetLabel: 'text-[12px] font-medium text-[var(--pl-text-faint)]',
    targetValue:
      'mb-2 mt-0.5 break-all font-mono text-[14px] font-semibold leading-[1.4] text-[var(--pl-text-strong)]',
  },

  /** 상세 보기 → text button (Figma 40:21). */
  detailLink: 'inline-flex items-center gap-1 text-[14px] font-medium text-[var(--pl-primary)] cursor-pointer hover:underline whitespace-nowrap',

  /** Loading skeleton block — same grammar as detailStyles.skeleton (task detail). */
  skeleton: 'animate-pulse rounded-[10px] bg-[var(--pl-gray-100)]',
  /** Skeleton text line — 블록은 `skeleton`, 글줄은 이것 (AlertStageCard 의 bar 관례). */
  skeletonBar: 'animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',

  /** Figma 4:2 table grammar — plain headers (no fill), divider rows. */
  table: {
    base: 'w-full border-collapse text-[14px]',
    headCell:
      'py-2.5 px-3 text-left text-[12px] font-medium text-[var(--pl-text-weak)] border-b border-[var(--pl-border)] whitespace-nowrap',
    cell: 'py-3 px-3 border-b border-[var(--pl-gray-100)] align-middle text-[var(--pl-text-strong)]',
    rowHover: 'hover:bg-[var(--pl-gray-50)] transition-colors',
  },

  /** Uppercase wire-status tag (Figma APPROVED/CANCELLED chips). */
  statusTag:
    'inline-flex items-center rounded px-2 py-0.5 text-[12px] font-semibold tracking-[0.02em] whitespace-nowrap',
  /** `statusTag` 의 14px 판 — 확정 정보 표는 안의 모든 글자가 14px 이다(오너 2026-08-25).
      `cn` 은 단순 join 이라 뒤에 크기를 덧붙여도 이기지 못한다 — 크기가 다른 판을 따로 둔다. */
  statusTagLg:
    'inline-flex items-center rounded px-2 py-0.5 text-[14px] font-semibold tracking-[0.02em] whitespace-nowrap',

  /**
   * 최근 연결 테스트 밴드 — 사용자 화면 Step 5 카드(`idcStyles.connProgress`)의 문법을
   * 이 콘솔의 --pl-* 로 옮긴 것.
   *
   * 형태·간격·계층은 그쪽 그대로 두고 색만 갈아입힌다. 두 화면은 같은 실행을 말하므로
   * 같은 모양이어야 하지만, 색까지 같이 오면 운영 콘솔 안에 다른 팔레트의 섬이 생긴다.
   * 판정 로직도 나누지 않고 그대로 쓴다 — `lib/test-connection-summary` 한 벌이 문장·
   * 버킷·경과를 두 화면에 똑같이 준다.
   *
   * ⛔ 테두리는 상태를 입지 않는다. 이 팔레트의 계열 테두리(`--pl-ok-border` 등)는 같은
   * 계열 면(`--pl-ok-bg`)보다 훨씬 진해서, 22px 알약이 아니라 전폭 판에 두르면 면보다
   * 테두리가 먼저 읽힌다 — Step 5 가 면:테두리 비율을 지키느라 겪은 그 역전이다. 상태는
   * 면·제목색·글리프 셋이 이미 말하고 있으므로 테두리는 중립 헤어라인으로 남는다.
   */
  tcBand: {
    base: 'mt-4 rounded-[10px] border border-[var(--pl-border)] px-4 pt-[13px] pb-3.5 transition-colors',
    /** 국면이 입는 유일한 면. queued 는 running 과 같은 면을 쓴다 — 경고가 아니라 정상 단계다. */
    surface: {
      idle: 'bg-[var(--pl-gray-50)]',
      running: 'bg-[var(--pl-primary-bg)]',
      success: 'bg-[var(--pl-ok-bg)]',
      fail: 'bg-[var(--pl-err-bg)]',
      unknown: 'bg-[var(--pl-off-bg)]',
    },
    head: 'flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 mb-[11px]',
    /** 문장이 이 밴드의 제목이다 — 카드 제목(20px)과 본문(14px) 사이 한 단. */
    title: 'flex items-center gap-2 text-[16px] font-bold tracking-[-0.01em] break-keep',
    titleColor: {
      idle: 'text-[var(--pl-text-strong)]',
      running: 'text-[var(--pl-text-strong)]',
      success: 'text-[var(--pl-ok-text)]',
      fail: 'text-[var(--pl-err-text)]',
      unknown: 'text-[var(--pl-text-medium)]',
    },
    accent: {
      idle: 'text-[var(--pl-text-weak)]',
      running: 'text-[var(--pl-primary)]',
      success: 'text-[var(--pl-ok-text)]',
      fail: 'text-[var(--pl-err-text)]',
      unknown: 'text-[var(--pl-text-weak)]',
    },
    icon: 'inline-grid place-items-center w-[18px] h-[18px] flex-shrink-0',
    /**
     * 시각 서브라인 — 문장의 근거라 문장 바로 아래 붙고, 제목의 18px 글리프 열에 맞춘다.
     *
     * 잉크는 `--pl-text-weak` 이었다(밴드 다섯 면에서 4.51~4.76:1, 브라우저 실측). 숫자로는
     * 4.5:1 을 넘지만 이 줄은 12px/500 이라 같은 비율의 14px 줄보다 훨씬 옅게 읽히고, 바로
     * 아래 사유 줄이 `--pl-text-medium`(9.49~10.01:1)이라 두 곁줄의 잉크가 두 배 넘게
     * 벌어져 있었다 — 오너가 "너무 흐리다"고 본 것이 그 격차다(2026-08-25).
     *
     * `--pl-gray-600` 은 램프의 다음 칸이다: 다섯 면 전부에서 6.97~7.36:1 로 5:1 을 넉넉히
     * 넘고, 사유 줄보다는 여전히 한 칸 아래라 곁줄 둘의 순서가 뒤집히지 않는다. 램프에
     * 5:1 짜리 칸은 없고, 한 줄을 위해 칸을 새로 만들지는 않는다. 시계 글리프는 이 span
     * 안에서 currentColor 를 상속하므로 같이 올라간다.
     */
    meta: 'flex items-center gap-2 text-[12px] font-medium tabular-nums text-[var(--pl-gray-600)]',
    /**
     * 밴드 안의 곁줄(사유). 상자가 아니라 맨 줄이다 — 카드 안에 상자를 또 두면 계층이
     * 아니라 같은 무게의 상자 둘이 된다.
     *
     * 들여쓰기는 없다 (오너 2026-08-25). 26px 을 물려 제목의 **글 열**에 맞춰 두었더니,
     * 위의 두 줄은 글리프에서 시작하는데 이 줄만 한 칸 안으로 들어가 밴드 왼쪽에 계단이
     * 생겼다. 대신 글리프를 제목과 같은 18px 열에 넣어 세 줄이 한 세로선에서 시작한다.
     */
    note: 'flex items-start gap-2 text-[14px] leading-[1.5] break-keep',
    noteWarn: 'text-[var(--pl-warn-text)]',
    noteWeak: 'text-[var(--pl-text-medium)]',
    /** 곁줄 안의 원문 enum — 라벨과 같은 줄에 mono 로 병기한다. */
    noteRaw: 'text-[12px] text-[var(--pl-text-weak)]',
    /**
     * 진행 트랙. 바닥값(`--pl-gray-200`)이 Step 5 트랙과 **같은 값**이라, 위에 깔리는 행진
     * 무늬(`idcStyles.connProgress.trackMarch`)의 대비 1.42:1 이 그대로 보존된다 —
     * 그 값은 브라우저에서 넷을 1:1로 놓고 고른 것이라 다시 고르지 않는다.
     */
    track: 'relative h-2 overflow-hidden rounded-full bg-[var(--pl-gray-200)]',
    fillOk: 'h-full transition-[width] duration-[250ms] ease-out bg-[var(--pl-ok)]',
    fillFail: 'h-full transition-[width] duration-[250ms] ease-out bg-[var(--pl-err)]',
    /** 카운트 줄 — 세그먼트 문법(점 · 라벨 · 굵은 수).
     *
     * 잉크가 gray-600 인 것은 이 줄의 유일한 임자(`MonitoringEvidenceBody`)가 카드가 아니라
     * **바닥 위에** 서기 때문이다 (AirflowTab: "판정·수·표가 바닥에 바로 서고, 제 표면을
     * 갖는 것은 표뿐이다"). 바닥이 gray-200 이라 weak 는 4.01 로 AA 아래고, 램프의 다음
     * 칸이 6.20 을 낸다. */
    counts: 'flex items-center gap-3 text-[12px] font-medium tabular-nums text-[var(--pl-gray-600)]',
    countSeg: 'flex items-center gap-1.5',
    countValue: 'text-[14px] font-bold tabular-nums',
    /**
     * 실행 밴드의 카운트 줄만 입는 활자 — 라벨 14 / 수 16 (오너 2026-08-27). Step 5 카드가
     * 같은 줄을 같은 두 값으로 그리고(`idcStyles.connProgress.countList`·`countValue`), 이
     * 밴드는 그 줄을 이식한 것이라 같이 움직인다.
     *
     * ⛔ `counts`·`countValue` 자체를 올리지 않는다. 그 둘은 모니터링 근거 줄
     * (`MonitoringEvidenceBody` 의 논리 DB 성공/확인 필요)도 같이 입는데, 그 줄은 실행의
     * 판정이 아니라 카드 본문에 딸린 집계라 12/14 에 남는다(오너가 범위를 그렇게 그었다).
     *
     * `counts` 를 통째로 **대신** 한다 — 크기만 덧대면 한 엘리먼트에 text-[12px] 와
     * text-[14px] 가 같이 서고, `cn` 은 plain join 이라 승자를 Tailwind 의 emit 순서가
     * 정한다. 나머지 선언은 `counts` 와 글자 그대로 같은 값이다.
     */
    countsRow: 'flex items-center gap-3 text-[14px] font-medium tabular-nums text-[var(--pl-text-weak)]',
    countValueRow: 'text-[16px] font-bold tabular-nums',
    countDot: 'h-2 w-2 rounded-full flex-shrink-0',
    countDotOk: 'bg-[var(--pl-ok)]',
    countDotFail: 'bg-[var(--pl-err)]',
    /**
     * 같은 두 점의 **바닥 위** 짝 — `MonitoringEvidenceBody` 의 근거 줄만 입는다. 위의 둘은
     * 흰 카드 위(`TcLatestRunCard`)에 남는다.
     *
     * 8px 이라 글자가 아니라 그래픽이고 기준은 3:1 이다. 바닥이 gray-200 이 되면서
     * `--pl-ok` 는 2.395 → **2.116**, `--pl-err` 는 3.432 → **3.031** 로 내려왔다 — 초록은
     * 원래부터 그 아래였고 빨강은 여백이 0.03 만 남았다. 그래서 둘 다 램프에서 한 칸씩
     * 내려간다: `--pl-ok-text` 4.366 · `--pl-err-solid` 3.897. 탭 옆 점(`tabDotFail`)이
     * 같은 이유로 `-solid` 를 쓰는 것과 같은 판단이다.
     */
    countDotOkGround: 'bg-[var(--pl-ok-text)]',
    countDotFailGround: 'bg-[var(--pl-err-solid)]',
    countDotRest: 'bg-[var(--pl-text-faint)]',
    /** 값이 없다는 사실은 색이 아니라 형태가 말한다 — 채운 점이 아니라 파선 링. */
    countDotMissing: 'h-2.5 w-2.5 rounded-full border-2 border-dashed border-[var(--pl-warn-text)] flex-shrink-0',
    okValue: 'text-[var(--pl-ok-text)]',
    failValue: 'text-[var(--pl-err-text)]',

  },
} as const;
