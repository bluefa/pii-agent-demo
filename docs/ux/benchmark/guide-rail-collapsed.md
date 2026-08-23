# 접힌 가이드 레일 — 정체와 협업 채널 (디자인 벤치마크 결정 기록)

- **일자**: 2026-08-23
- **대상**: `/pass/target-sources/{id}` 우측 가이드 레일의 **접힌 상태** (`GuidePanel` 스트립)
- **아티팩트**: https://claude.ai/code/artifact/b15b1d6a-59ea-4148-a5bf-46445372f2d4
- **구현 PR**: [#759](https://github.com/bluefa/pii-agent-demo/pull/759)
- **선행 아티팩트**: 폭 배분 감사 https://claude.ai/code/artifact/ceeb4bd1-b35e-43c3-b4b0-94cceaca2cc0

레일 접기(1단계)를 넣은 직후 오너가 지적: *"접혔을 때 가이드 패널이라는 걸 명시할 수 있어야 하고,
협업 채널도 어느 정도 표현돼야 한다."* + *"우측 패널이 깜빡인다."*

## 문제 요약 (근거 등급)

| # | 문제 | 등급 |
|---|---|---|
| P1 | 접힌 48px 스트립에 방향 셰브런 하나뿐 — 무슨 패널인지 화면에 없음(`aria-label` 만 존재) | 사용자 지적 |
| P2 | `CollabChannelCard` 가 `collapsed !== true` 안에만 있어 접으면 티켓 키·연결 상태·조회 실패까지 통째로 사라짐. **바로 그 자리 주석이 "협업 채널은 모든 단계의 탈출구라 접힘선 위에 둔다"고 약속** — 접으면 접힘선이 없어져 스스로 모순 | 사용자 지적 |
| P3 | 서버 HTML 이 `w-12 min-[1360px]:w-[320px]` — 서버는 저장된 선호를 못 봐서 1360↑ 이면 항상 열린 320px 을 칠하고, 하이드레이션 뒤 48px 로 스냅 | 사용자 지적 |
| P4 | 스트립이 브라우저 기본 `title` 사용. 앱에 `Tooltip`(`position`/`openOn`) 프리미티브가 이미 있고, 48px 에서는 툴팁이 유일한 설명 채널 | UX 원칙 |
| P5 | 패널 이름이 셋 — `aria-label` 「단계 가이드 및 진행 내역」 / 버튼 「가이드 펼치기」 / 실제 내용물 3종. 접힌 상태에 한 단어를 새기려면 먼저 이름을 정해야 함 | UX 원칙 |
| P6 | 48px 은 아이콘·배지는 담아도 **가로** 라벨을 못 담음. M3 레일이 80dp 인 이유가 그것 | 수치 |

## 실제 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 |
|---|---|---|
| AWS Cloudscape — Secondary panels | https://cloudscape.design/patterns/general/secondary-panels/ | 접혀도 트리거 바는 남는다 · **도움말이 스택 맨 위**라는 고정 순서. ⚠️ 동시에 **반증**: 아이콘 전용은 자기 문서가 인지 부하라고 자백 |
| JetBrains IntelliJ — Tool window stripe | https://plugins.jetbrains.com/docs/intellij/tool-windows.html | 아이콘 **아래** 이름 · 2단어 이하, 길면 약어 · 20px 회색 모노크롬 글리프 |
| VS Code — Activity Bar | https://code.visualstudio.com/api/ux-guidelines/activity-bar | 배지가 접힌 아이콘 위에서 상태를 말한다 · 기존 아이콘 복제 금지 |
| Material Design 3 — Navigation rail | https://m3.material.io/components/navigation-rail/specs | **가로 라벨의 값 = 80dp** 라는 가격표(반대 근거) · 목적지 3~7개 |
| Atlassian Jira — Issue context panel | https://developer.atlassian.com/cloud/jira/platform/issue-view/ | 접는 손잡이가 곧 제목 — 접혀도 이름이 남는다 |
| IBM Carbon — UI shell side rail | https://carbondesignsystem.com/components/UI-shell-left-panel/accessibility/ | hover 확장은 **반드시 focus 와 쌍**(시안 C 검토용) |
| VS Code — Sidebars / Views | https://code.visualstudio.com/api/ux-guidelines/sidebars | 뷰 3~5개가 편안한 상한 — 스트립 항목 수 예산 |
| IBM Carbon — Tooltip | https://v10.carbondesignsystem.com/components/tooltip/style/ | 아이콘 전용 컨트롤엔 툴팁 필수 · 잘릴 것 같으면 방향 플립 |
| Slack 스레드 페인 (기억 기반) | https://slack.com/ | **반증**: 진입점을 본문으로 옮기면 레일이 필요 없다 (시안 E) |
| 내부 — `HistoryTimeline` | `GuidePanel.tsx` | 8px 상태 점 = `statusColors[tone].dot` |
| 내부 — 설치 화면 헤더 | memory: `project_ts_header_two_tier` | 20px 글리프 (`lg` 28 로 올라가기 전 값) |
| 내부 — `#754` 열 폭 | `WaitingApprovalTable.tsx` | 확정 표 바닥 988px — 레일 폭 상한의 근거 |

## 채택 — 시안 D (아이콘 + 가로 라벨), **단 56px**

오너가 D 방향을 채택. 아티팩트의 D 는 64px 로 그렸으나 **구현은 56px** 로 내렸다.

```
표 가용 폭 = 뷰포트 − 296(서비스 레일) − R(가이드 레일) − 40(페이지 거터) − 56(카드 키라인)
표가 맞으려면  뷰포트 ≥ 1380 + R

  R=48 → 1428    R=56 → 1436    R=64 → 1444
  @1440 실측 —  56px: 1440−392−56 = 992 ≥ 988  ✔
                64px: 1440−392−64 = 984 <  988  ✘  (4px 모자라 가로 스크롤)
```

⛔ **64px 로 올리지 말 것.** 8px 차이가 1440px 노트북에서 표에 가로 스크롤이 생기느냐를 가른다.
56px 은 12px 라벨(디자인 가이드 폰트 하한)을 담으면서 1440 을 지키는 유일한 값이다 —
아티팩트가 D 에 붙였던 "10px 라벨이 필요하다"는 우려는 56px 에서 해소된다(「가이드」 3자 × 12px = 36px,
가용 48px).

### 기각한 시안과 이유

- **A 아이콘 스택** — 정체를 아이콘으로만 말한다. Cloudscape 가 자기 입으로 인지 부하라 부른 설계이고,
  오너가 쓴 단어는 「명시」였다.
- **B 한글 세로 라벨** — 아티팩트 추천안이었으나 오너가 D 선택. 세로 텍스트는 스캔이 느리다는 비용이
  실재하고, 56px 이면 가로로도 들어간다는 점에서 D 가 상위 호환.
- **C hover 미리보기** — 정보량 1등이지만 **상태를 남기지 않는다.** 표를 보며 티켓을 참조하는 화면에서
  hover 전용은 치명적이고, 포인터가 화면 우변을 스치기만 해도 열린다.
- **E 레일 삭제 + 헤더 칩** — 발주 밖(요구는 "접힌 레일 표현"). 이 레일이 대체했던 인라인 앰버 가이드
  카드로 회귀한다. 다만 *"레일이 꼭 필요한가"* 라는 반증으로 기록.

## 구현 (수치 출처)

| 요소 | 값 | 출처 |
|---|---|---|
| 스트립 폭 | 56px (`w-14`) | 위 산수. ⛔ 64 금지 |
| 셰브런 | 32×32, 글리프 16px | `railStyles.toggle` — 변경 없음 |
| 구분선 | 32×1px | 셰브런 폭과 동일 |
| 엔트리 글리프 | 20px | 설치 화면 헤더가 `lg`(28) 로 가기 전 값 |
| 엔트리 라벨 | 12px / 행간 120% | 디자인 가이드 폰트 하한 · 행간 2단 중 "한 줄 성격" |
| 상태 점 | 8px + `ring-2 ring-white` | `HistoryTimeline` 의 `h-2 w-2` |
| 점 색 | `success` / `pending` / `error` | `statusColors` — 연결 · 미연결 · 조회 실패 |
| 툴팁 | `<Tooltip position="left">` | 네이티브 `title` 대체 (P4) |
| 패널 이름 | 「가이드」 | 오너 어휘. `aria-label` 도 이걸로 통일 (P5) |

스트립 구성: 셰브런 → 헤어라인 → **가이드**(GuideIcon) → **채널**(ChatIcon + 상태 점).
가이드 항목이 위인 것은 Cloudscape 의 "도움말이 항상 맨 위" 순서 규칙.

### 규칙 (재제안 방지)

- ⛔ **`entryLabel` 12px 은 하한이지 출발점이 아니다.** 라벨이 안 들어가면 폰트가 아니라 **단어**를 줄여라
  (JetBrains 스트라이프 규칙: 2단어 이하, 노출 시 약어).
- ⛔ **상태 점은 `aria-hidden`** — 엔트리의 `aria-label` 이 상태를 **말로** 담아야 한다. 색만으로는 채널이 아니다.
- 「가이드」를 누르면 `selectTab('guide')` 를 함께 건다. 접을 때 진행 내역에 있었다고 진행 내역으로
  펼쳐지면 스트립의 한 단어가 거짓말이 된다.
- ⚠️ **셰브런 위치 불변식은 원래 성립하지 않았다.** 이전 주석은 "접힘·펼침에서 버튼이 같은 x·y 라 포인터가
  안 움직인다"고 썼지만, 그 x 는 **레일 기준 좌표**이고 레일은 우변 고정이라 접히면 왼쪽 모서리가 264px
  이동한다. 포인터는 어느 쪽이든 움직인다 — 주석을 사실대로 고쳤다.

## 미해결 — P3 플래시

시안과 무관한 별개 결함이라 이 커밋에 포함하지 않았다. 방법은 셋:

1. **쿠키** — 선호를 `document.cookie` 에 쓰고 서버 컴포넌트가 `cookies()` 로 읽어 `initialCollapsed` 를
   내려보낸다. 첫 페인트부터 정답. 비용: `page.tsx` → `ProjectDetail` → `GuidePanel` prop 배선.
2. **페인트 전 인라인 스크립트** — 루트 레이아웃에 블로킹 스크립트. 화면 하나 때문에 앱 첫 바이트를 무겁게 한다.
3. **저장 폐기** — `readStored`·스토리지 키 삭제. 플래시가 **구조적으로 불가능**해지고 코드 −30줄.
   비용: 하드 리로드마다 초기화.

권장은 ①. 다만 **접힘 기억 자체가 발주에 없던 기능**이라 ③ 도 정당하다 — 오너 결정 사항.
