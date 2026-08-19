# Admin 사이드바 항목 아이콘 — 시안 A 채택 기록

- **날짜**: 2026-08-19
- **대상**: `/pass/admin/pipelines/**` 공용 사이드바 (`app/admin/pipelines/layout.tsx`)
- **아티팩트**: <https://claude.ai/code/artifact/307af4ef-3aa8-47c3-b4df-9b3e9732de50>
- **구현 PR**: #731

## 1. 왜 했나

"메뉴 그룹 옆에 아이콘으로 표현되면 가시성이 높아질 것 같다"는 요청.
아이콘을 **그룹 라벨에 둘지, 항목에 둘지**부터 레퍼런스로 검증했다.

## 2. 진단 (실측: localhost, getComputedStyle)

| # | 문제 | 등급 |
|---|---|---|
| P1 | 항목 식별이 100% 라벨 독해 의존 — "대시보드"×2·"권한"×3·"운영"×3 어휘 중복 | UX 원칙 |
| P2 | 그룹 타이틀 uppercase 레버가 한글 4/5개 타이틀에서 무효 | UX 원칙 |
| P3 | 그룹 경계 신호가 여백 16px 하나 | 제안 |
| P4 | 비텍스트 신호가 빨간 배지 3개뿐 → 배지 항목만 시각 앵커 | 제안 |
| P5 | 최장 라벨 89.8px / 행폭 192px — 아이콘 16px+갭 8px 추가 여유 확인 | 수치 실측 |

대비 위반 0건(타이틀 6.89:1 · 항목 9.70:1). 문제는 색이 아니라 형태 채널 부재.

## 3. 실제로 쓴 레퍼런스

| 레퍼런스 | 빌린 것 | URL |
|---|---|---|
| GitLab Pajamas nav sidebar | 레벨당 아이콘 전원 지급, 서브는 플레인 | <https://design.gitlab.com/patterns/navigation-sidebar/> |
| AWS Cloudscape side navigation | "apply icons consistently at one level" 일관성 규칙 | <https://cloudscape.design/patterns/general/service-navigation/side-navigation/> |
| shadcn/ui Sidebar | 아이콘 슬롯은 MenuButton(항목)에만, GroupLabel은 텍스트 | <https://ui.shadcn.com/docs/components/sidebar> |
| Ant Design Menu | ItemGroup엔 icon prop 자체가 없음 | <https://ant.design/components/menu> |
| Filament Panels Navigation | 그룹 아이콘 = 접힘 rail 전제 + 두 레벨 동시 금지 | <https://filamentphp.com/docs/3.x/panels/navigation> |
| Wave Sidebar Navigation | "Avoid mixing items that have leading visuals with items that don't" | <https://wave.volue.com/components/sidebar-navigation> |
| NN/g Icon Usability | 라벨 상시 노출, 아이콘은 보조 채널 | <https://www.nngroup.com/articles/icon-usability/> |
| NN/g Vertical Navigation (반증) | "a word is worth a thousand pictures" — 기대효과 한정 | <https://www.nngroup.com/articles/vertical-nav/> |
| USWDS Side navigation (반증) | 무아이콘 성립 조건 = 라벨 고유성 (우리는 P1로 불성립) | <https://designsystem.digital.gov/components/side-navigation/> |

## 4. 결정 — 시안 A (항목 아이콘 10종, 16px)

시안 5종 비교(아티팩트 §05)에서 P1(항목 변별)을 해결하는 것은 A·D뿐.
A는 TopNav `NAV_ITEMS`가 이미 쓰는 아이콘 언어(16px 박스·24 viewBox·stroke 1.8·
`currentColor`·gap 8)의 연장이라 일관성 비용이 0. D(A+그룹 디바이더)와의 차이는
CSS 두 줄이므로 **A 출고 → 그룹 혼동이 관찰되면 디바이더 증분**으로 순서를 정했다.

기각 판례:

- **그룹 라벨 아이콘(시안 B, 질문의 원안)**: 레퍼런스 14종 중 판례가 Filament
  1건뿐이고 그마저 접힘 rail 전제. P1·P4를 건드리지 못함. 단독 채택 기각.
- **그룹 승격 2단 IA(시안 E)**: 5그룹 10항목 규모에 과잉, 접기는 발견성 훼손. 기각.

## 5. 구현 노트

- 글리프는 `ui/icons/` 공용 세트가 아니라 layout.tsx 인라인 — TopNav `NAV_ITEMS`와
  같은 선례(내비 메타포는 해당 레이아웃의 어휘). 공용 세트는 viewBox 16·24,
  stroke 1.5~2.2 혼재라 세트 균일성(Wave 규칙)을 지키려면 인라인이 정답이었다.
- `sidebarItem` 토큰 block → flex: badge 조건부 `flex` 클래스가 block과 co-occur
  하던 기존 어긋남도 함께 해소. badge 우측 도킹은 라벨 `flex-1`로 대체.
- 아이콘은 `currentColor` 상속 — idle 9.70:1 / active 흰색, 신규 색 0개.
