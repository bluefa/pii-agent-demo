# Step4 · Agent 설치 — 트레이 표면 벤치마킹 → 시안 B(레거시 프레임) 채택 기록

> 작성 2026-08-10 (design-benchmark §6 decision record)
> 대상 화면: `/pass/target-sources/{id}` 4단계 "Agent 설치" (AWS 선행 적용)
> 선행 기록: `docs/ux/benchmark/step4-grouped-rail.md` (레일 정보구조 — 이번 건은 그 위의 **표면**만 다룬다)

## 아티팩트

| 단계 | 아티팩트 |
|---|---|
| 리서치 (진단 7 · 레퍼런스 13 · 시안 5) | https://claude.ai/code/artifact/8f9f0585-a31e-493d-819d-c1b06c7e7188 |

## 발단

"설치 진행 트레이의 좌/우/아래 여백을 아예 없애보자, 대신 색은 좀 바꿔야 할 것 같다"(오너).
full-bleed + 새 토큰 `bgColors.tray #DFE3EC` 로 구현했고(`fix/step4-flush-tray`, 미머지),
결과를 보고 "조금 이상하다"는 판단이 나와 벤치마킹으로 되돌아왔다.

## 문제 요약 (근거 등급)

1. **P1 raised 카드 위에 sunken 면을 얹었다** — `수치 위반`
   CIE L\* 실측: 신규 트레이 `#DFE3EC` **90.2** < 서비스 레일 `#E2E7EA` **91.4**.
   화면에서 가장 뒤에 있어야 할 면이 가장 앞에 있는 카드 안에 들어갔다.
   Atlassian: *"Don't apply sunken elevations on raised or overlay elevations."*
2. **P2 full-bleed가 카드를 두 조각으로 자른다** — `UX 원칙`
   카드 803px 중 트레이 630px(78%) → "흰 헤더 띠 + 회색 박스"로 읽힘. 여백 제거의 목적과 정반대.
3. **P3 우측 패널의 죽은 공간** — `UX 원칙` · **이번 변경 이전부터 존재**
   패널 1166×560 에 내용은 약 120px. `h-[560px]` 고정 탓이고, 트레이는 그 빈 면을 더 크게 감쌌을 뿐.
4. **P4 바닥 18px 회색 띠** — `제안` (bleed 의 pb 만 남아 "덜 지운 여백"으로 읽힘)
5. **P5 제목이 두 개다** — `UX 원칙` (카드 "Agent 설치" ↔ 트레이 "설치 진행 상황", 170px 간격)
6. **P6 새 토큰이 기존 토큰과 역할·값 모두 중복** — `수치 위반`
   `bgColors.tray #DFE3EC` ↔ `serviceSidebarStyles.surface #E2E7EA` = ΔE00 **3.28**, 같은 밝기 대역·같은 역할.
7. **P7 구 트레이(gray-100)는 애초에 면이 아니었다** — `수치 위반`
   `#F3F4F6` ↔ 캔버스 `#F4F4FB` ΔE00 **2.67**, 흰색과 ΔE00 **2.47**. 색이 아니라 라운드로만 트레이인 척했다.

## 실제로 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 | 검증 |
|---|---|---|---|
| Atlassian Design System — Elevation | https://atlassian.design/foundations/elevation | sunken/default/raised/overlay 4단계와 **"sunken 은 default 위에만"** 금지 조합 — P1 판정의 출처 | `확인함` |
| AWS Cloudscape — Split view | https://cloudscape.design/patterns/resource-management/view/split-view | 상세 쪽에 컨테이너를 **더 두르지 말 것** — 우측 셀에서 흰 카드 한 겹을 걷어낸 근거 | `확인함` |
| GitHub Primer — PageLayout.Pane | https://primer.style/product/components/page-layout | 좌우 분할의 기본 수단은 `divider: 'line'`, 면(filled)은 예외 — "나눈다 ≠ 칠한다" | `확인함` |
| (사내) `InstallStatusDetail` legacy 분기 | Azure/GCP/IDC 4단계 화면 | 프레임 수치 전량 재사용: `grid-cols-[224px_minmax(0,1fr)] rounded-xl border overflow-hidden`, 레일 `p-2 border-r bgColors.panel`, 우측 `px-5 py-4` | `확인함` |

레퍼런스 13종 전체(Cloud Build, Carbon layering, Material 3, Polaris, Vaadin master-detail,
GitHub Actions, Cloudscape details/secondary panel/empty state 등)와 각각의 벤치마킹 요소는
리서치 아티팩트에 있다 — 위 표는 **출시 코드에 실제로 남은 것**만.

## 채택안과 이유

시안 5안(A 우물을 한 칸만 / B 레거시 프레임 복귀 / C 탭 전환 / D 카드 2장 분리 / E 레일 컬럼만 채색)
중 리서치 권장은 **E**, 후퇴선이 **B** 였다. 오너 결정은 **B**.

- **B 채택 근거** — 4개 CSP(AWS/Azure/GCP/IDC)가 같은 그릇을 쓰는 일관성이 우선.
  회색이 "카드 위에 얹은 판"이 아니라 **프레임 안쪽 셀의 채움**이 되므로 P1 이 성립하지 않는다.
- **해소** — P1 P2 P5 P6. `bgColors.tray` 는 main 에 들어간 적이 없어 토큰 추가 자체가 철회됐다(P6).
- **미해소·수용** — P3(고정 높이의 빈 패널)은 별건으로 남는다.
  P4 는 오너의 최초 요구(여백 제거)를 되돌리는 형태로 닫힌다.
  P7(gray-100 이 흰색과 ΔE00 2.47)은 **수용** — 여기서는 담는 일을 테두리가 하므로 색이 약해도 구조가 버틴다.

## 구현 범위

- `InstallStatusDetail.tsx` grouped 분기: 회색 래퍼(`rounded-2xl p-2 bgColors.panel`) → 레거시 헤어라인 프레임.
  우측 셀은 카드의 흰 바닥을 그대로 쓴다(흰 카드+`shadows.hair` 제거). 메타바의 20px 제목 삭제,
  조회 시각 한 줄만 프레임 위에 남긴다.
- `InstallationLoadingView.tsx` grouped 스켈레톤: 같은 프레임으로 동기화(안 하면 데이터 도착 시 프레임이 튄다).
  레일 바 톤을 `RAIL_BAR`(gray-200)로 교정 — 레일이 gray-100 이라 기본 톤(gray-100)은 보이지 않았다.
- `fix/step4-flush-tray` 브랜치는 미머지 상태로 폐기.
