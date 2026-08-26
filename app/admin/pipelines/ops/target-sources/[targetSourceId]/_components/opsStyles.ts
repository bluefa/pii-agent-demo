/**
 * Ops target-source page chrome (Figma pYCA7zTWcZysYOpYykuYAN 4:2, adapted to
 * the --pl-* token system — raw Figma hex values map to their semantic tokens).
 */
import { primaryColors } from '@/lib/theme';

export const opsStyles = {
  /**
   * R1 page root (docs/ux/benchmark/ops-detail-ia-redesign.md) — escapes
   * layout.contentFluid's padding (the dash.bleed escape hatch) so the masthead
   * wash and the lavender canvas both reach the viewport edges. The canvas is
   * painted HERE, not on --pl-bg-page: that token is the section's, and every
   * sibling pipelines screen stands on it.
   */
  page: '-mx-8 -mt-6 -mb-12 flex min-h-[calc(100vh_-_64px)] flex-col bg-[var(--pl-bg-canvas)]',
  /**
   * Masthead — one gray-100 wash holding the path line + FrontMeta block, closed by
   * the tab band (tabStrip). The wash separates from the canvas on chroma, not
   * luminance (ΔE00 2.46, guard-pinned).
   */
  masthead: 'bg-[var(--pl-gray-100)] px-8 pt-4',

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
   *     ("Structure should be felt not seen"). 칠이 사라졌으므로 구분자는 faint(워시 위
   *     2.34:1)에서 weak(4.53:1)로 올라간다 — 유일한 묶음 장치가 안 보이면 안 된다.
   *
   * ⛔ 파랑은 **지나온 마디**에서 빠졌다. 링크는 색이 아니라 hover 로 말한다 — 세 마디 중
   * 둘이 링크라 거기에 파랑을 쓰면 줄의 3분의 2가 파래진다.
   * 다만 **서 있는 곳의 식별자 하나만** 파랑이다 (오너 08-26 "#1029 파란색으로 바꿔").
   * 링크가 아니므로 위 규칙과 부딪히지 않고, 굵기·크기·색 세 레버가 한 요소에 모여
   * 줄에서 눈이 가장 먼저 닿는 곳이 "지금 보고 있는 대상"이 된다.
   */
  pathLine: 'flex flex-wrap items-baseline gap-x-3 gap-y-1',
  path: 'flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] leading-[1.5] text-[var(--pl-text-weak)]',
  /** 구분자 — 칠이 없어진 뒤로 이 줄의 유일한 묶음 장치다. 워시 위 4.53:1. */
  pathSep: 'flex-none text-[var(--pl-text-weak)]',
  /** 지나온 마디. 색도 굵기도 없고, 누를 수 있다는 것은 hover 가 말한다. */
  pathLink:
    'flex-none cursor-pointer text-[12px] text-[var(--pl-text-weak)] transition-colors hover:text-[var(--pl-text-strong)] hover:underline',
  /** 지나온 마디 중 **식별자**인 것(서비스 코드) — 낱말보다 한 단 진하다. */
  pathLinkId:
    'flex-none cursor-pointer text-[12px] font-medium text-[var(--pl-text-medium)] transition-colors hover:text-[var(--pl-text-strong)] hover:underline',
  /** 서 있는 곳 — 종류(옅은 낱말) + 식별자(줄에서 유일하게 굵고 큰 것). */
  pathHere: 'flex flex-none items-baseline gap-1.5',
  pathHereKind: 'text-[12px] text-[var(--pl-text-weak)]',
  pathHereId:
    '[font-family:var(--pl-font-mono)] text-[14px] font-semibold tabular-nums text-[var(--pl-primary)]',
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
   *   14px  한 블록 안    머리 헤어라인 ↔ 사실들   `fmGrid`·`aboutList` pt-3.5
   *   20px  블록 사이     경로 줄 ↔ 연동 대상      `fmGroup` mt-5
   *   16px  워시 ↔ 탭 밴드                        `tabStrip` mt-4
   *
   * 탭 밴드만 20 이 아니라 16 인 것은 거기가 **색이 바뀌는 경계**라서다 — gray-100 →
   * gray-200 이 이미 한 번 긋고 있으니 간격까지 최대로 줄 이유가 없다.
   */
  fmGroup: 'mt-5',
  fmHead:
    'flex items-center justify-between gap-4 border-b border-[var(--pl-border-strong)] pb-1.5',
  fmName: 'flex min-w-0 items-center gap-2',
  /** 20px — 운영 대시보드 `identityGlyphMark` 의 칸. 같은 대상의 마크를 24(제목 줄)·
      28(서비스측)·20(대시보드) 세 크기로 그리던 것을 한 크기로 모은다: 이 화면의
      마크는 이제 블록 머리의 하나뿐이라 제목 줄의 24px 는 사라진다. */
  fmGlyph: 'h-5 w-5 flex-none text-[var(--pl-text-medium)]',
  fmLabel:
    'whitespace-nowrap text-[14px] font-semibold tracking-[0.02em] text-[var(--pl-text-medium)]',
  /**
   * 마스트헤드는 두 단이다 (오너 08-26 "헤더 오른쪽에서 Github About처럼") — 왼쪽이
   * 사실(연동 대상 + kv 4열), 오른쪽이 나가는 문(관련 페이지). 관련 페이지가 한 단
   * **아래**에 있을 때는 탭 줄을 그만큼 밀어내렸는데, 그건 이 화면에서 가장 자주 쓰는
   * 것(탭)을 가장 덜 쓰는 것(참고 링크)이 밀어낸 배치였다. 오른쪽으로 서면 kv 그리드가
   * 쓰지 않고 남기던 폭을 대신 쓰므로 마스트헤드 높이가 한 줄도 늘지 않는다.
   * 두 머리 줄의 헤어라인이 같은 y 에 서서 한 줄처럼 읽히고, 열 사이 간격이 그 줄을 끊는다.
   */
  fmSplit: 'flex items-start gap-8',
  /** 200px — kv 열(240px)보다 좁게 잡는다: 이 단은 대조하는 값이 아니라 이정표라
      제 이름 두 개가 들어가는 만큼만 있으면 되고, 남는 폭은 그리드 쪽에 남는다. */
  aboutPanel: 'w-[200px] flex-none',
  /** About 패널의 본문 — 목적지가 **세로로** 쌓인다 (GitHub About). kv 그리드와 같은
      자리에서 시작하도록 머리 아래 여백은 `fmGrid` 의 pt 와 같은 값이다. */
  aboutList: 'flex flex-col items-start gap-2 pt-3.5',
  /** About 패널의 한 줄 — 마크가 앞에 서고 이름이 링크다. 마크는 값이 아니라 이정표라
      본문보다 한 단 옅다. */
  aboutRow: 'inline-flex items-center gap-1.5',
  aboutMark: 'flex flex-none text-[var(--pl-text-weak)]',
  aboutLink:
    'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap text-[12px] font-semibold text-[var(--pl-primary)] hover:underline',
  aboutPlain: 'whitespace-nowrap text-[12px] font-medium text-[var(--pl-text-medium)]',
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
      240 은 이 화면의 가장 긴 라벨(Terraform Service Account, 165px)과 2열 병합
      (498px)이 GCP SA 전문(≈380px)을 받는 폭에서 나온 값이다. */
  fmGrid: 'grid grid-cols-[repeat(4,minmax(0,240px))] gap-x-[18px] gap-y-3 pt-3.5',
  fmCell: 'flex min-w-0 flex-col gap-1',
  fmCellWide: 'col-span-2',
  /** 워시는 램프 한 칸을 잡아먹는다 — `--pl-text-weak` 는 이 gray-100 위에서 4.51:1 로
      AA 바닥이라 12px 라벨에 쓰지 않는다. `--pl-gray-600` 은 같은 자리에서 6.98:1. */
  fmKey: 'text-[12px] font-semibold leading-4 text-[var(--pl-gray-600)]',
  /** 수정할 수 있는 **값** (오너 08-26 "해당 값에 밑줄을 그어야지. 밑줄은 파란색으로") —
      값 옆에 서 있던 「수정」 링크가 값 자신으로 접혀 들어간다. 글자색은 값의 것으로 두고
      밑줄만 파랗다: 파랑이 글자를 먹으면 이 줄에서 나가는 링크들과 같은 것이 되는데, 이건
      여기서 모달을 여는 것이라 신호는 밑줄이 지고 색은 그 밑줄에만 실린다.
      08-20 의 판례는 *태그*가 눌리는 척하지 말라는 것이라 부딪히지 않는다 — 여기서
      눌리는 것은 흰 면 태그가 아니라 mono 값이다. */
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
  fmValue:
    'flex min-h-[22px] min-w-0 items-center gap-2 text-[12px] font-medium leading-4 text-[var(--pl-text-strong)]',
  fmValueText: 'min-w-0 truncate',
  fmNone: 'text-[12px] font-medium text-[var(--pl-gray-600)]',
  fmMono: '[font-family:var(--pl-font-mono)] font-medium',
  fmLink:
    'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap text-[12px] font-semibold text-[var(--pl-primary)] underline underline-offset-2 decoration-[var(--pl-primary-ring)] hover:decoration-[var(--pl-primary)]',

  /**
   * 「상세 정보」 접힘 — 3열이라 열려도 사실이 세로로 쌓이지 않는다. 236px 레일이 지고
   * 있던 서비스 축(이름·코드·Jira·운영)과 설명이 여기로 들어오고, 계약에는 있는데
   * 화면엔 없던 사실(생성일 · Tenant ID)과 주체 **전문**이 함께 선다.
   */
  /** 열 폭은 세 그룹이 지는 것에서 나온다 — 서비스는 짧은 값(이름·코드·티켓)이라 220,
      대상은 설명 문단이 65자 안팎에서 읽히게 460, 식별자는 GCP SA 전문(≈380px)이
      한 줄에 들어가게 460. 같은 폭 3열이면 서비스 칸만 240px 를 비운다. */
  fmFold: 'grid grid-cols-[220px_minmax(0,460px)_minmax(0,460px)] gap-x-6 gap-y-4 pt-3.5',
  fmFoldGroup: 'flex min-w-0 flex-col gap-2.5',
  fmFoldLabel: 'text-[12px] font-bold tracking-[0.06em] text-[var(--pl-gray-600)]',
  /** 설명 본문 — 접힘 안에서는 전문을 편다. 표시를 100자에서 접던 것은 레일이 236px
      였기 때문이고, 3열 접힘에는 그 폭 제약이 없다. */
  fmProse: 'break-words text-[12px] font-medium leading-[18px] text-[var(--pl-text-strong)]',
  /** 전문 값 — 자르지 않는다. ARN·Service Account 는 접힌 이름이 아니라 문자열 전체가
      정보라(복사해 콘솔에서 찾는 값) 이 자리에서만은 truncate 를 걸지 않는다. 이것이
      title 툴팁 안에만 있던 전문을 화면으로 꺼내는 자리다. */
  fmValueFull: 'break-all text-[12px] font-medium leading-[18px] text-[var(--pl-text-strong)]',
  /** 복사 — 값 옆의 아이콘 하나. 글자가 아니라 그래픽이라 3:1 기준이고, weak 는 이
      워시에서 4.51:1 로 그 위다. */
  fmCopy:
    'inline-flex flex-none cursor-pointer items-center rounded p-0.5 text-[var(--pl-text-weak)] transition-colors hover:text-[var(--pl-primary)]',

  /** Neutral tag / region tag — shared with SduOpsNotice·ServiceDetailView·
      TerraformStatusModal (Figma 49:4/34:4). */
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
   * 대비 실측: 글자(--pl-text-strong) on 면(--pl-bg-card) = 17.85:1. 면은 캔버스
   * (--pl-bg-canvas) 위에서 ΔE00 4.12, 카드 hover 틴트 위에서 8.92 (tableRowLift.card
   * 주석의 실측치와 같은 쌍).
   */
  rawDataTag: 'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-semibold border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)]',
  /**
   * Masthead meta tags (오너 08-20 넷째 조정) — the editable values (설치모드·
   * 실데이터) read as emphasized tags and the ACTION moves to a 수정 link beside
   * them, so the tag no longer has to look clickable (no underline, no hover
   * fill). ⚠️ metaTag(흰 면 + 강한 획)는 08-26 에 은퇴했다 — 시안 A+F 로 설정 두 칸이
   * 값 밑줄 하나가 되면서 이 그리드에 흰 면 태그가 남지 않는다. 되살릴 일이 생기면
   * 그 규칙("흰 면 = 수정 가능")부터 다시 세워야 한다. metaTagQuiet = the read-only attribute tag (China/Global · IDC),
   * which must NOT wear the white face — that face means "editable value" here.
   *
   * 그 태그는 gray-200 이었는데 오너가 "회색은 너무 칙칙해 보임" 이라 했다 (08-26).
   * 이 콘솔에서 옅은 칠은 이미 임자가 있다: `--pl-info-bg` 는 RUNNING·진행 중이고
   * (`detailJobStyles` · `ConfirmStatusPill` 등 일곱 자리), `--pl-primary-bg` 는
   * 누를 수 있는 것이다. ok/err/warn 은 판정이라 파티션에 쓸 수 없다. 남는 유일한
   * 계열이 `--pl-current` 바이올렛 — 이 콘솔에서 상태도 링크도 아닌 "정체" 쪽
   * 어휘이고(서비스 레일의 "여기 있음", 캔버스와 같은 가족), 그래서 파티션·환경
   * 같은 **속성**이 앉을 자리다. 칠이 워시와 가까워서 테두리가 형태를 진다.
   */
  metaTagQuiet:
    'inline-flex items-center whitespace-nowrap rounded border border-[var(--pl-current)] bg-[var(--pl-current-bg)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--pl-current-ink)]',

  /**
   * Card tabs in a band (R1, 오너 08-20 셋째 조정) — the strip itself is a
   * gray-200 band one ramp under the wash (ΔE00 2.94 on the wash, 3.53 against
   * the canvas below), so the tab tier reads as its own layer. The active tab
   * is a bare white face with an OPEN bottom — no stroke, because --pl-border
   * IS the band color (ΔE00 0.00): on the darker band the face alone carries
   * the shape (white on band 5.66, vs 2.78 it managed on the wash).
   */
  tabStrip: 'mt-4 -mx-8 flex items-end gap-1 overflow-x-auto bg-[var(--pl-gray-200)] px-8 pt-1.5',
  tab: 'cursor-pointer whitespace-nowrap rounded-t-[8px] px-4 py-2 text-[14px]',
  tabActive: 'bg-[var(--pl-bg-card)] font-semibold text-[var(--pl-text-strong)]',
  /** 워시는 램프 한 칸을 잡아먹는다, and the band eats one more: weak measures
      4.01:1 on gray-200 (AA fail) — idle steps up to medium (8.44:1). */
  tabIdle: 'font-medium text-[var(--pl-text-medium)] hover:text-[var(--pl-text-strong)]',
  /** 보기(진행 상태·스캔·연동 요청·확정) | 도구(인프라·연결 테스트·승인) group gap. */
  tabGap: 'w-3.5 flex-none self-stretch',

  /** Body — 콘텐츠 한 열. 236px 메타 레일은 FrontMeta 의 「상세 정보」로 접혀 들어갔고,
      그 폭은 탭 7개 전부에서 본문으로 돌아간다 (1020 → 1280px). */
  body: 'flex flex-1 flex-col px-8 pt-6 pb-12',
  content: 'flex min-w-0 flex-1 flex-col gap-4',

  /** Skeleton bar ON THE WASH — the gray-100 `skeletonBar` vanishes there (same
      value as the wash), so masthead skeletons step one ramp deeper. */
  skeletonWash: 'animate-pulse rounded-[6px] bg-[var(--pl-gray-200)]',
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

  /**
   * 칸 오른쪽 끝의 관리 입구 (오너 2026-08-25). `countLink` 와 다른 물건이다: 저쪽은 **값이
   * 곧 트리거**라 밑줄이 affordance 를 지지만, 이 링크는 값이 아니라 행위라 옆에 세울 값이
   * 없다. 대신 화살표가 "여기서 끝나지 않고 다른 화면으로 간다"를 말하고, 파랑은 hover
   * 에서만 든다 — 행마다 반복되는 링크가 상시로 파랗면 표에서 가장 시끄러운 것이 된다.
   *
   * 평소엔 **없다** (오너 2026-08-25). 행마다 반복되는 링크가 상시로 서 있으면 표에서
   * 가장 시끄러운 것이 되는데, 이 칸이 늘 말해야 하는 것은 건수지 입구가 아니다. 행에 눈이
   * 가는 순간 그 행이 무엇을 할 수 있는지 파랑으로 함께 켜진다 — 같은 행의 Credential 값도
   * 같이 켜지므로 두 입구가 한 제스처에 답한다.
   *
   * 사라지는 것은 `opacity` 지 자리가 아니다 — `hidden` 이면 hover 마다 건수 두 줄이 옆으로
   * 밀린다. 그리고 `focus-visible` 에서도 켜진다: 키보드로 온 사람에게 안 보이는 버튼에
   * 포커스가 서면 그 정거장은 사라진 것이나 같다.
   *
   * 그룹은 이름 있는 그룹이다(`/row`, `idcStyles.table.row` 가 선언). 맨 `group-hover` 는
   * 조상 중 아무 `group` 에나 걸려 표 바깥의 group 에서도 샌다
   * ([[feedback_bare_group_hover_leaks]]).
   *
   * 바탕 잉크 `--pl-text-medium` 10.46:1, `--pl-primary` 는 흰 면 5.17:1 · 행 hover 틴트
   * 4.95:1 로 두 상태 모두 4.5:1 을 넘는다(실측).
   */
  manageLink:
    'inline-flex flex-none cursor-pointer items-center whitespace-nowrap text-[14px] font-semibold text-[var(--pl-text-medium)] opacity-0 transition-[color,opacity] group-hover/row:opacity-100 group-hover/row:text-[var(--pl-primary)] hover:text-[var(--pl-primary)] focus-visible:opacity-100',

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
    /**
     * 카드 등급의 경고 줄 — 밴드 **밖**, 설명문과 밴드 사이. 여기 서는 것은 실행의 판정이
     * 아니라 다음 실행의 전제다(Credential 미설정). 상자가 아니라 맨 줄인 것은 밴드와 같은
     * 이유고, 들여쓰기(pl)는 없다 — 밴드에 딸린 줄이 아니라 카드의 줄이다.
     */
    cardNote:
      'mt-4 flex items-start gap-2 text-[14px] leading-[1.5] break-keep text-[var(--pl-warn-text)]',
    noteWarn: 'text-[var(--pl-warn-text)]',
    noteWeak: 'text-[var(--pl-text-medium)]',
    /** 곁줄 안의 원문 enum — 라벨과 같은 줄에 mono 로 병기한다. */
    noteRaw: 'text-[12px] text-[var(--pl-text-weak)]',
    /**
     * 곁줄의 토글 링크 — 밑줄이 affordance 를 지고 색은 줄에서 상속한다.
     *
     * 문장 **바로 뒤**에 붙는다. 카드 폭 끝으로 밀면(ml-auto) 1000px 건너편에 서서, 무엇을
     * 거르는 링크인지 문장과 함께 읽히지 않는다 — Step 5 는 이 줄이 자기가 거르는 표 바로
     * 위에 있어서 우측 정렬이 표의 컨트롤로 읽히지만, 여기선 위에 표가 없다.
     */
    noteAction: 'shrink-0 cursor-pointer whitespace-nowrap text-[14px] font-semibold underline underline-offset-2',
    /**
     * 진행 트랙. 바닥값(`--pl-gray-200`)이 Step 5 트랙과 **같은 값**이라, 위에 깔리는 행진
     * 무늬(`idcStyles.connProgress.trackMarch`)의 대비 1.42:1 이 그대로 보존된다 —
     * 그 값은 브라우저에서 넷을 1:1로 놓고 고른 것이라 다시 고르지 않는다.
     */
    track: 'relative h-2 overflow-hidden rounded-full bg-[var(--pl-gray-200)]',
    fillOk: 'h-full transition-[width] duration-[250ms] ease-out bg-[var(--pl-ok)]',
    fillFail: 'h-full transition-[width] duration-[250ms] ease-out bg-[var(--pl-err)]',
    /** 카운트 줄 — 세그먼트 문법(점 · 라벨 · 굵은 수). */
    counts: 'flex items-center gap-3 text-[12px] font-medium tabular-nums text-[var(--pl-text-weak)]',
    countSeg: 'flex items-center gap-1.5',
    countValue: 'text-[14px] font-bold tabular-nums',
    countDot: 'h-2 w-2 rounded-full flex-shrink-0',
    countDotOk: 'bg-[var(--pl-ok)]',
    countDotFail: 'bg-[var(--pl-err)]',
    countDotRest: 'bg-[var(--pl-text-faint)]',
    /** 값이 없다는 사실은 색이 아니라 형태가 말한다 — 채운 점이 아니라 파선 링. */
    countDotMissing: 'h-2.5 w-2.5 rounded-full border-2 border-dashed border-[var(--pl-warn-text)] flex-shrink-0',
    okValue: 'text-[var(--pl-ok-text)]',
    failValue: 'text-[var(--pl-err-text)]',

  },
} as const;
