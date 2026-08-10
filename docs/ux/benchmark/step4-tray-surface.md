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

## 후속 — Azure/GCP/IDC 도 같은 카드로 (같은 PR)

프레임을 되돌리고 나니 네 CSP 가 같은 그릇을 쓰게 됐지만, 레일 **내용**은 AWS 만
그룹 레일(v3.6)이고 나머지 셋은 그 이전 형태였다. 셋도 `group` 을 선언해 같은 카드로 맞췄다.

`group` 은 `side`(리소스가 어느 쪽에 생기는가)가 아니라 **누가 실행하는가**다.
AWS 자동 설치에서 `side: '서비스측 리소스 생성'` 인 단계가 `group: 'auto'` 인 것과 같은 규칙.

| CSP | 내가 할 일 | BDC 진행 | 근거 |
|---|---|---|---|
| Azure | VM Subnet 생성 · VM Terraform 적용 · Private Endpoint 승인 | BDC측 Terraform 적용 | `AZURE_STEPS` 주석의 흐름 설명("서비스 측이 VM Subnet 을 만들고…") |
| GCP | PSC용 Subnet 생성 | 서비스측 Terraform 적용 · BDC측 Terraform 적용 | 계약에 실행 주체 근거 없음 → **오너 판단**. Terraform 적용은 AWS 자동 설치처럼 BDC 가 대신 수행 |
| IDC | 방화벽 | BDC CX 영역 · BDC BDP 영역 | 두 Terraform 구간은 BDC, 서비스 측 일은 방화벽 오픈·확인뿐 |

부수 효과 — 그룹 레일에는 `설치 현황 요약` 단계가 없다:

- 카드 헤더 안내문이 가리키던 "아래 설치 현황 요약에서"가 화면에 없는 것을 찾으라고
  시키고 있었다 → "아래 내가 할 일에서"로 정정.
- `serviceAction`(조치 문구)은 요약 패널의 ActionItem 에서만 그려지므로 네 CSP 모두
  화면에서 사라진다. 같은 내용을 단계 `desc` 가 서술형으로 말하고 있어 그대로 두었다 —
  **남은 갭**이며, 필요해지면 우측 패널 헤더 아래가 자리다.
- `InstallationLoadingView` 의 legacy(`railRows`) 분기는 호출자가 사라졌지만 남겨둔다 —
  `group` 을 선언하지 않은 단계가 하나라도 생기면 상세가 legacy 로 떨어지는데, 그 짝이다.

### 해당 없음 = 제목 취소선

Azure 1003(VM 없는 대상)처럼 단계가 통째로 `na`(전부 SKIP)일 때, 상태 글자는 '해당 없음'
이고 옆 단계는 '완료'다 — 둘 다 같은 회색 한 단어라 레일을 훑을 때 **"끝난 단계"와
"애초에 없는 단계"가 구분되지 않았다**(오너 지적).

제목에 취소선을 긋고 톤을 secondary 로 내린다. 취소선이 "없다"를 글자 모양으로 말하고,
톤이 "볼 것 없다"를 말한다. 상태 글자는 긋지 않는다 — 그건 설명이다. 우측 패널은 이미
`naWithoutGuides` 로 표 대신 빈 상태를 세우므로(EmptyState "이 단계에 해당하는 리소스가
없어요") 취소선은 레일에만 있으면 된다. 회귀는 `InstallStatusDetail.na-blocked.test.tsx`
가 잡는다.
