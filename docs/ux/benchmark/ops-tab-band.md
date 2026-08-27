# Target Source 운영 상세 — 탭 밴드 → 라인 탭

- **날짜** 2026-08-27
- **대상 화면** `/pass/admin/pipelines/ops/target-sources/{id}` — 마스트헤드 아래 탭 줄
  (`OpsTargetView` 의 `role="tablist"` 블록 + `opsStyles` 의 `tabStrip`/`tab`/`tabActive`/`tabIdle`/`tabGap`)
- **아티팩트** 「탭 밴드 심판」 https://claude.ai/code/artifact/e05a07d0-9935-443b-9c51-429a17854f05
- **채택안** 시안 A — 워시 위 라인 탭 (오너 2026-08-27 채택)
- **구현 PR** #795

## 문제 진단

브라우저 실측(headless Chrome, 뷰포트 1702×913, 대상 5종 = 1029 AWS 자동 · 1006 AWS 수동 ·
1801 Azure · 1583 IDC · 1002 GCP)으로 잡은 것만 적는다. 대비는 계산이 아니라 `getComputedStyle`
로 실제 칠해진 값을 읽어 잰 것이다.

| # | 문제 | 근거 등급 | 증거 |
|---|------|-----------|------|
| D1 | 활성 탭의 파랑을 쓸 수 없었다 — 밴드 위 `--pl-primary` 는 **4.17:1** 로 AA 아래다 | 수치 위반 | 같은 잉크가 워시 위에서는 4.69:1. 밴드가 램프 한 칸을 더 먹은 만큼이 그대로 AA 미달분이다 |
| D2 | 탭 줄이 화면에서 **유일하게 전폭**이다 — 밴드 x216 w1486, 본문 x248 w1422 | 수치 위반 | `-mx-8 … px-8` 로 마스트헤드 패딩을 탈출한다. 위의 사실도 아래의 카드도 닿지 않는 x 를 탭의 경계선만 가로지른다 |
| D3 | 42px 안에 크롬 톤이 셋이다 — gray-100 워시 / gray-200 밴드 / 라벤더 캔버스 | UX 원칙 (계층은 포함) | 마스트헤드는 이미 `fmHead` 가 `--pl-border-strong` 헤어라인으로 블록을 닫고 있어서, 같은 자리에서 두 문법(칠·획)이 같은 일을 한다 |
| D4 | 활성 탭이 **흰 면**이라 아래 콘텐츠 카드와 같은 낱말을 쓴다 | UX 원칙 | 이 화면에서 흰 면은 「카드」이고 또 「만질 수 있는 값」이다(`rawDataTag` 주석). 탭까지 흰 면을 쓰면 한 표면 어휘가 셋을 뜻한다 |
| D5 | 묶음이 셋인데 간격은 **하나**다 | 제안 | 보기 4 / 실행 2 / 승인·근거 2. 실측상 `tabGap` 은 확정 정보↔인프라 작업 한 곳에만 있었다 |
| D6 | `Airflow 확인` 이 도구 묶음 끝에 붙어 있고, `tabGap` 주석은 탭을 **일곱 개**로 센다 | 수치 위반 | 탭은 여덟이다(IDC 는 일곱). PR #783 이 여덟째를 넣으면서 주석이 갱신되지 않았고, 이 탭은 조작하는 것이 아니라 승인 조건 ③ 의 근거를 읽는 곳이다 |
| D7 | 탭 줄이 상태를 **전혀** 말하지 않는다 | UX 원칙 (Cloudscape·Carbon) | 연결 테스트가 실패해 있어도 탭을 열기 전에는 알 수 없다. 화면은 이미 그 사실을 들고 있다(`tcStatus`/`tcLatest`) |

## 사용한 레퍼런스

`확인함` = 이번 세션에서 URL 이 실제로 열리는 것(HTTP 200)을 확인했다.

| # | 레퍼런스 | 검증 | URL | 차용한 것 |
|---|----------|------|-----|-----------|
| R1 | 이 저장소의 접근 권한 화면 탭 (`accessStyles.tab`) | 확인함 | `app/admin/pipelines/access/_components/accessStyles.ts` | **기하 전부** — `px-3 py-2.5` · 14px · `gap-1.5` · `border-b-2` · `-mb-px`. 어드민 콘솔에 라인 탭이 둘일 이유가 없다 |
| R2 | GitHub Primer — UnderlineNav | 확인함 | https://primer.style/product/components/underline-nav/ | 활성은 **잉크 + 2px 밑줄**이고 면을 칠하지 않는다 |
| R3 | GitHub Primer — Navigation 패턴 | 확인함 | https://primer.style/product/ui-patterns/navigation/ | 내비게이션은 **자기가 지배하는 폭 안**에 산다 — D2 를 닫는 규칙 |
| R4 | IBM Carbon — Tabs usage | 확인함 | https://carbondesignsystem.com/components/tabs/usage/ | line tab 이 기본이고 contained(칠한 밴드)는 표면이 더 필요할 때의 변종이다 |
| R5 | AWS Cloudscape — Tabs | 확인함 | https://cloudscape.design/components/tabs/ | 탭 라벨에 **상태 표시는 되지만 카운트 배지는 아니다** — D7 의 점은 여기서 왔고, 배지를 안 다는 근거도 여기다 |
| R6 | NN/g — Tabs, Used Right | 확인함 | https://www.nngroup.com/articles/tabs-used-right/ | 선택된 탭은 "확실히" 구분돼야 한다. 흰 면이 유일한 신호일 때 그 신호는 바닥색에 인질로 잡힌다 |
| R7 | Linear — 리디자인 원칙 | 확인함 | https://linear.app/now/behind-the-latest-design-refresh | "Don't compete for attention you haven't earned" · "Structure should be felt not seen" — 이 화면의 경로 줄이 이미 따르고 있는 규칙을 탭 줄에도 적용한다 |
| R8 | Vercel Geist — Tabs | 확인함 | https://vercel.com/geist/tabs | 밑줄 탭 한 벌 + 잉크 대비만으로 선 탭을 말한다 |

## 시안 비교

다섯 안을 같은 축(대비 · 정렬 · 표면 어휘 수 · 묶음 표현력 · 상태 수용력 · 변경 반경)으로 놓고
점수 낸 표는 아티팩트 §06 에 있다. 시안 A 가 이긴 자리는 셋이다.

- **대비** 활성 잉크가 4.17 → **4.69** 로 AA 를 넘긴다(D1). 다른 어떤 안도 밴드를 남기면 이 값을 못 올린다.
- **표면 어휘** 크롬 톤이 셋에서 **하나**(워시)로 준다. 흰 면은 아래 카드의 것으로 되돌아간다(D4).
- **정렬** 탭과 그 헤어라인이 본문 열과 같은 x248 w1422 에 선다(D2).

지는 자리도 있다: 밴드는 "탭 층"을 칠 하나로 선언해 줬고, 라인 탭은 그 일을 헤어라인 1px 과
간격에 맡긴다. 그래서 헤어라인은 `--pl-border`(옅은 것)가 아니라 `fmHead` 가 쓰는
`--pl-border-strong` 이다 — 칠을 없애면 헤어라인이 하중을 진다.

## 만료된 전제 (아티팩트 §07)

밴드는 오너 지시 **2026-08-20 셋째 조정**의 결과다. 그 지시의 전제는 "마스트헤드가 스스로를
닫지 못한다" 였다 — 당시 워시는 캔버스로 그냥 흘러들었고, 이음매를 그릴 것이 밴드밖에 없었다.

그 전제는 소진됐다. `ops-target-frontmeta.md` 시안 C 가 마스트헤드에 **헤어라인 어휘**를 들여왔고
(`fmHead` 의 `border-b border-[var(--pl-border-strong)]`), 그 뒤로 마스트헤드는 자기 블록을
자기 획으로 닫는다. 같은 획이 마스트헤드 전체도 닫을 수 있으므로 밴드가 하던 일에 임자가 생겼다.
**기각 판례는 그 전제와 함께 만료된다** — 그래서 08-20 지시를 뒤집는 것이 지시를 무시하는 것이
아니다. 오너가 2026-08-27 에 시안 A 를 명시적으로 채택했다.

## 실측 (before → after)

뷰포트 1702×913, 대상 5종 동일.

| 항목 | before | after |
|------|--------|-------|
| 탭 줄 x / w | 216 / **1486** | 248 / **1422** (= 본문 열) |
| 탭 줄 높이 | 41.6 | 41.6 (변화 없음) |
| 탭 줄 바닥 | `bg` gray-200, `border-bottom` 0px | `bg` 없음, `border-bottom` **1px #D0D5DD** |
| 활성 탭 박스 | 248, w82.6, h35.6 (흰 면 + 상단 라운드) | 248, w74.6, h41.6 (잉크 + 2px 밑줄) |
| 활성 탭 대비 | 17.75:1 — 단, **그 흰 면 자체가** 밴드 위 ΔE00 로만 섰다 | **4.69:1** (`--pl-primary` on 워시) |
| idle 탭 대비 | 8.44:1 (밴드 위) | **9.49:1** (워시 위) |
| 마스트헤드 높이 | 197.6 (GCP 251.6) | 동일 |
| 첫 콘텐츠 표면 y | 285.6 (GCP 339.6) | 동일 |
| 묶음 간격 | 1개 (확정 정보 ↔ 인프라 작업) | **2개** (+ 연결 테스트 ↔ 관리자 승인) |
| 탭 전체 폭 | — | 717px / 1422px 열 |

IDC(1583)는 스캔이 빠진 **7탭**이고, 두 간격이 여전히 확정 정보↔인프라 작업 · 연결 테스트↔관리자
승인에 선다 — 간격이 인덱스가 아니라 **탭 이름**에 걸려 있어서다.

## 「연결 테스트」 탭의 상태 점

8px 한 개. 크기는 이 화면이 이미 쓰는 점의 크기다(`tcBand.countDot` · `ConfirmEditorModal.dot`).

- 판정은 승인 탭과 **같은 게이트**(`tcRunGate`)에서 나온다. 탭 줄을 위한 요청은 추가하지 않았다.
- 말하는 것은 둘뿐이다 — 최신 실행이 **실패**(`--pl-err-solid`), 아직 **열려 있음**(`--pl-info-text`).
  이력 없음 · 조회 실패 · enum 밖은 켜지 않는다. 그것들은 "무엇이 있다"가 아니라 **"모른다"**라,
  점 하나로 말할 수 있는 사실이 아니다([[feedback_failure_is_not_an_empty_result]] 와 같은 갈래).
- 색은 그래픽이라 3:1 기준이고 워시 위에서 잰다: `--pl-err-solid` **4.38** · `--pl-info-text` **5.43**.
  같은 계열의 한 칸 위(`--pl-err` 3.41 · `--pl-info` **2.94**)를 쓰지 않은 이유가 이것이다 —
  info 는 3:1 을 **못 넘는다**. `design-guard.test.ts` 의 TEXT 에 `min: 3` 으로 두 쌍을 박았다.
- 점이 켜지면 탭이 86.6 → 100.6px 로 넓어진다(점 8 + `gap-1.5` 6). 자리를 상시 비워 두지 않은
  것은 의도다: 여덟 탭 전부에 14px 짜리 빈 칸을 두면 안 켜지는 일곱 탭이 그 값을 낸다.

## 기각

| 안 | 기각 이유 |
|----|-----------|
| 탭에 건수 배지 | 수를 단 탭은 워크리스트라고 주장한다 — PR #735 가 같은 이유로 이미 기각했다 |
| 옅은 헤어라인(`--pl-border`) | 칠을 없앤 자리에서 헤어라인이 하중을 진다. 워시 위 1.13 으로는(`--pl-border-strong` 은 1.34) 마스트헤드가 안 닫힌다 |
| `accessStyles.tabIdle` 의 `--pl-text-weak` 를 그대로 이식 | 이 워시에서 4.51:1 — AA 바닥에 여유 0.01. 워시는 램프 한 칸을 먹는다 |
| `overflow-x-auto` 유지 | 여덟 탭 전체 폭이 717px 이라 1422px 열에서 넘칠 일이 없고(실측), 스크롤 컨테이너로 두면 활성 탭의 `-mb-px` 가 1px 짜리 세로 스크롤을 만든다(`scrollHeight` 42 vs `clientHeight` 41) |

## design-guard 이동

밴드에 묶여 있던 네 쌍이 임자를 잃었다. 토큰 이름으로 해석하는 테스트라 그냥 두면
`key ... not found` 로 던진다.

| 제거 | 추가 |
|------|------|
| `tabStrip` ↔ 워시 (SURFACES) | `tabActive` 잉크 on 워시 (TEXT, 4.69) |
| `tabStrip` ↔ 캔버스 (SURFACES) | `tabIdle` 잉크 on 워시 (TEXT, 9.49) |
| `tabActive` 면 ↔ `tabStrip` (SURFACES) | `tabDotFail` on 워시 (TEXT, `min: 3` → 4.38) |
| `tabIdle` 잉크 on `tabStrip` (TEXT) | `tabDotRunning` on 워시 (TEXT, `min: 3` → 5.43) |

점 두 쌍은 **SURFACES 가 아니라 TEXT** 에 있다. SURFACES 는 ΔE00 을 재고 TEXT 가 대비를 재는데,
점이 워시에서 견디는지는 ΔE00 이 아니라 대비의 문제다 — 처음에 SURFACES 에 넣었더니 `--pl-info`
(2.94)로 뮤테이션해도 초록이었다. 네 쌍 모두 뮤테이션으로 트립와이어를 확인했다.
