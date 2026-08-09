# Step4 · Agent 설치 그룹 레일 (v3.6)

> 작성 2026-08-09 · 대상 화면 `/target-sources/{id}` 4단계 "Agent 설치" (AWS 선행)
> 적용 컴포넌트: `InstallStatusDetail`(이중 레이아웃) / `AwsInstallStatusDetail`(그룹 선언) / `InstallationLoadingView`(grouped 스켈레톤)
> 신규 토큰: `shadows.hair` / `shadows.hairRing` (`lib/theme.ts`)
> 진행 방식: UX 리서치(레퍼런스 13) → 방향 5안 → v1 기각 → v2 레일 → 레이아웃 v3 시안 6회전 → 구현
> 시안 원본: `design/step4/step4-layout-v3.html` (리서치 아티팩트는 4MB 캡처본이라 repo 제외)

처음 온 담당자의 질문은 "내가 뭘 해야 하고, 뭘 안 해도 되는가"다. 상태별 리소스
나열은 이 질문에 답하지 않는다 — 레일을 **주체 기준 2그룹(내가 할 일 / BDC 자동
진행)** 으로 갈랐다.

---

## 1. 확정 결정

| 결정 | 내용 | 근거 |
|---|---|---|
| 그룹 레일 | `내가 할 일` / `BDC 자동 진행` 2그룹, 첫 미완료 todo 자동 선택 | 주체가 곧 정보 구조 — 요약 스텝·n/m 카운트·항목별 side 줄 제거 |
| 감싸기 문법 | 회색 래퍼(`bgColors.panel`, rounded-2xl p-2) ⊃ 메타바 + 레일 + 흰 카드 | admin ops 콘솔의 "패널이 카드를 감싼다" 문법 — 한 컴포넌트로 읽힘 |
| 높이 고정 | `h-[560px]`, 스크롤은 카드 본문에서만 (헤더 = 클리핑 지점) | 리소스 수에 따라 화면이 무한 성장하지 않게 (오너 A안) |
| Primer 카드 | 헤어라인 테두리(gray-200) + blur 없는 1px 오프셋 그림자(`shadows.hair`) | GitHub Actions 패널 — 계층은 낮게, 윤곽은 또렷하게. blur 그림자 퇴역 |
| 메타바 | "설치 진행 상황" 16px 좌 + "마지막 확인 HH:MM (KST)" 우, 한 줄 | 하단 배치는 빈 공간을 만들었다(기각). 새로고침·주기 컨트롤 비노출 |
| 자동 단계 순서 | 서비스 측 TF → **BDC 공통** → BDC 서비스, 약한 순번 1·2·3 | 실행 순서 확정. 순번은 캡션 크기로 가라앉힘 |
| 레일 푸터 | 분절 진행바(4px) + "n개 중 m개 완료 · 실패 k" (`mt-auto` 앵커) | WinUI PaneFooter — 레일 바닥 여백을 요약으로 마감 |
| 할 일 0 상태 | 그룹 숨기지 않고 "(0)" + "지금 하실 일이 없어요…" + 완료 이력 잔류 | 부재도 정보다 — 완료된 todo가 사라지면 이력이 끊긴다 |
| 안내 열 | guide가 전부 null이므로 Empty ("—" 금지, 가짜 사유 금지) | 없는 데이터를 있는 것처럼 그리지 않는다 |

## 2. 켜지는 조건 — 전부 선언해야 켜진다

`InstallTableStep.group('todo'|'auto')`는 옵트인이고, **모든 스텝이 선언해야**
그룹 레일이 켜진다(`every`, `some` 아님). 그룹 레일은 `filter(group === …)` 로
분할하므로 미선언 스텝은 어느 그룹에도 못 들어가 레일에서 사라진다 — 반쯤
이관된 어댑터는 레거시 레이아웃으로 안전하게 떨어진다.
`feedback_allowlist_over_negative_predicate` 규칙의 적용 사례.

레거시 렌더는 `InstallStatusDetail.legacy.test.tsx`가 고정한다 — Azure/GCP/IDC는
자체 컴포넌트 테스트가 없고 AWS 스위트는 이제 그룹 분기만 지나므로, 이 파일이
공유 코드 리팩터에서 레거시 경로를 지키는 유일한 가드다.

## 3. 리뷰에서 잡힌 것 (codex sol + opus 교차)

- **(KST) 라벨인데 타임존 미고정** — `formatDateTime`은 브라우저 로컬 tz.
  해외 접속 시 KST 아닌 시각에 KST 라벨. → `formatDateTimeKst`(Asia/Seoul 고정) 신설.
  라벨이 타임존을 주장하면 포맷터가 그 타임존을 고정해야 한다.
- **패널 위 tertiary** — gray-500 on gray-100 = 4.37:1 (AA 미달), #0064FF도 4.47:1.
  조용한 텍스트 전부 secondary(gray-700), hot 라벨은 `primaryColors.textOnLight`(#0050D6).
  `design-guard.test.ts`에 이 표면 쌍 등록 — panel 위 텍스트는 gray-700↑ (PR #625 규칙 재확인).
- **카드 테두리 gray-100** — 래퍼도 gray-100이라 테두리가 소멸, "분리는 테두리가
  담당"이라는 주석이 거짓이 됐다. → `borderColors.default`(gray-200, hairRing과 동일 값).
- **로딩 스켈레톤 불일치** — 스켈레톤은 레거시 프레임(320px 레일·흰 바탕·가변 높이)을
  그리는데 착지는 회색 래퍼·224px·560px 고정. → `InstallationLoadingView`에 `grouped`
  변형 추가(스켈레톤은 실제 마크업 복사 — PR #626 규칙).
- **분절바 반올림** — 600개 중 실패 1건이면 `Math.round` → 0%로 빨간 조각 소멸.
  → 0이 아닌 버킷에 1% 바닥값 (합이 100% 넘으면 flex-shrink가 흡수).

## 4. 기각된 지적 (재플래그 금지)

- `bg-white`/`rounded-2xl`/inline `style={{width}}` 토큰 위반 주장 — repo 선례
  각 44곳/5곳/7곳 (Card.tsx 자체가 bg-white, 진행바 전부 inline width).
- `aggregates.get(id)!` 비널 단언 — main에 동일 패턴 2곳 선존, navSteps와 같은
  소스에서 구축되는 불변식.
- running=info 파랑이 warning 위반 주장 — 이 화면의 선존 관례가 info
  (`NAV_STATUS_TEXT`·`RollupStat` 모두). 화면 내 일관성이 우선.
- 레일 `overflow-y-auto` 이중 스크롤 주장 — 스텝이 560px를 넘을 때만 발동하는 방어.

## 5. 남긴 것 (후속)

- `InstallStatusDetail` 분리(그룹/레거시 이중 분기 ~800줄) — 타 CSP 이관이 끝나
  레거시 분기를 지울 때 함께. 지금 쪼개면 이관 기간 내내 두 벌 수정.
- Azure/GCP/IDC 그룹 레일 이관 — 각 어댑터가 `group` 전부 선언하면 켜진다.
- 수동 모드 순번 — manual에서는 서비스 TF가 todo 그룹으로 올라가 auto 순번이
  1(BDC 공통)부터 시작. 순번은 "자동 그룹 내 순서"로 정의했지만 INSTALLING 수동
  목 대상이 없어 육안 미검증.
- 계약 협의 4건 — guide null, TF Role 재검증 endpoint, GCP PSC 서브넷 필드,
  installation_status_unavailable 정책 (리서치 문서 §계약 갭).
