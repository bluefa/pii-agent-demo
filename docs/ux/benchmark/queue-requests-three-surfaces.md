# 연동 요청 — 승인함의 세 표면

- **날짜** 2026-08-17
- **대상 화면** `/admin/pipelines/queue/requests` (P2 연동 요청 목록)
- **아티팩트** https://claude.ai/code/artifact/49f1967a-9c03-454c-80f0-4400c00c1a78
- **채택** 시안 C — 큐 레일 + 표 한 장
- **선행 라운드** https://claude.ai/code/artifact/d52bbe00-7651-4132-bb2d-d83f17b2100d (상세 화면 대상, 미채택)

## 문제

오너 지적: "승인·반려·history 페이지의 구성이 역삼각형이고, 계층이 전혀 안 보인다."
카드 세 장이었다가 탭 세 개로 바꿨는데 둘 다 같은 병이었다.

실행 중인 dev 서버에서 `getBoundingClientRect` / `getComputedStyle` 로 직접 측정한 값:

| 표면 | 크기 | 면적 | 제목 | 배지 | 할 수 있는 일 |
|---|---|---|---|---|---|
| 연동 요청 확인 | 621×360 | 223,560px² | 17px | 4건 | 승인·반려 (유일한 조치) |
| 연동 요청 반려 확인 | 621×360 | 223,560px² | 17px | 2건 | 없음 |
| 전체 History 확인 | **1267×385** | **487,795px²** | 17px | 23건 | 없음 |

### 발견 (근거 등급 포함)

1. **같은 요청이 한 화면에서 두 계급을 갖는다** `수치` — History 표의 상위 4행(주문·결제·
   포인트·알림서비스)은 상태가 전부 `승인 대기` 로, 왼쪽 카드의 그 4건과 동일한 요청이다.
   표시된 11행 중 4행(36%)이 중복이고, 한쪽에서는 눌러서 처리되고 다른 쪽에서는 아무 일도
   일어나지 않는다.
2. **승인 대기와 반려는 같은 표다** `수치` — 두 카드의 열 구조가 6칸 중 4칸 글자까지 동일
   (서비스 이름 / 서비스 코드 / Cloud / 설명↔반려 사유 / 요청 일자↔반려 일자 / →).
3. **형제에게는 등급을 줘도 평평하다** `오너 규칙` — 이미 확정된 "계층은 포함이지 등급이
   아니다". 카드 3장도 탭 3개도 형제 3개라 크기·순서·굵기 어떤 레버로도 계층이 안 생긴다.
4. **수치 4개가 서로 다른 모집단** `수치` — 문장 6(=4+2), 배지 4·2·23. 23은 이벤트 수,
   4·2는 요청 수인데 같은 모양의 배지를 쓴다.
5. **제목 셋이 같은 17px** `수치` — 레버 차이 0개. 17은 폰트 세트에도 없는 값.
6. **탭 버전은 컴포넌트 계약 위반** `UX 원칙` — NN/g "각 in-page 탭은 같은 레이아웃에 다른
   데이터", Cloudscape "탭은 상세 페이지에서만". History 탭만 레이아웃이 다르고, 여기는
   목록 페이지다.
7. **반려가 왜 내 할 일인지 화면이 말하지 않는다** `UX 원칙`
8. **반려 카드는 절반이 빈 채로 높이를 맞춘다** `수치` — 둘 다 360px, 왼쪽 4행 오른쪽 2행.
9. **기록이 작업면의 스크롤을 먹는다** `제안` — 문서 994px / 뷰포트 810px, 넘치는 184px 전부
   History 카드.

## 실제로 쓴 레퍼런스

아티팩트에는 13종이 있고, 채택안이 직접 빌려온 것은 아래 넷이다. 전부 2026-08-17 세션에서
직접 열어 확인했다.

| # | 레퍼런스 | URL | 빌려온 것 |
|---|---|---|---|
| 01 | Zendesk — Views vs Tabs | https://support.zendesk.com/hc/en-us/articles/4408829483930-Accessing-your-views-of-tickets | 묶음 전환은 탭이 아니라 좌측 뷰 목록이라는 축 분리. 그리고 뷰 목록은 그룹 헤더(shared/personal)로 계층을 **문자로 선언**한다 → 우리의 `작업` / `기록` |
| 10 | Jira Service Management — Queues | https://confluence.atlassian.com/servicemanagementserver/using-service-desk-queues-939926462.html | "This sidebar displays all queues … as well as **the number of issues in each queue**" — 건수를 레일에 두면 세 수가 한 열에 정렬되어 서로 비교된다 (발견 4) |
| 11 | Microsoft Entra — Access reviews | https://learn.microsoft.com/en-us/entra/id-governance/complete-access-review | `Current` 와 `Review history` 를 형제가 아니라 다른 계층에 둔다 — 오너 규칙 "계층은 포함"의 제품 구현체 |
| 13 | Cloudscape — Table view | https://cloudscape.design/patterns/resource-management/view/table-view/ | "**Don't use the content layout component on this type of page.** Instead, use the 'full-page' variant" — 카드 껍데기 3벌을 벗기는 근거 |

탭을 버리는 판단의 근거 두 건(같은 세션 확인):

- Cloudscape — Details page with tabs: "**Use tabs only on details pages.**" /
  "Don't use tabs for hubs, navigation, steps, or containers that link the users to other pages."
  https://cloudscape.design/patterns/resource-management/details/details-page-with-tabs/
- NN/g — Tabs, Used Right: "**Each in-page tab should have the same layout but with different data.**"
  https://www.nngroup.com/articles/tabs-used-right/

## 채택안과 이유

**시안 C — 큐 레일 + 표 한 장.** 왼쪽 168px 레일이 **뷰 목록**을 담고, 그룹 헤더가 계층을
글자로 선언한다 — `작업`(승인 대기 · 반려) / `기록`(전체 이력). 오른쪽은 고른 뷰 하나의 표.

비교표에서 커버 6.5/9 로 최다는 아니었다(D 9/9, E 8/9, A 7.5/9). 오너가 C 를 고른 이유는
계층을 **연출이 아니라 문자로** 선언하는 유일한 안이라는 점이다 — 나머지는 표면을 없애서
문제를 소멸시키지만, C 는 세 뷰를 남긴 채 그 사이의 상하 관계를 화면에 적는다. 큐가
나중에 늘어도(보류·만료) 레일에 줄만 추가된다.

### 기각 판례 뒤집기

워크벤치 라운드(2026-08-15)에서 **"좌측 패널은 항목 3개엔 과하다"**로 레일을 한 번 접었다.
그때 레일이 담던 것은 **요청 목록**(내용이 늘고 페이저가 필요한 것)이었고, 이번 레일이
담는 것은 **뷰 목록**(항목이 3개로 고정된 목차)이다. 전제가 다르므로 그 판정을 뒤집는다
(오너 결정 2026-08-17).

### 같이 정리된 것

- 워크벤치 시트 제거 → 요청 하나는 **기존처럼 상세 라우트**에서 읽고 결정한다(오너 전제).
  행 전체가 그 링크다.
- `RequestDetail.identity` / `RequestDetailHeader.identity` prop 제거 — 시트가 유일한
  `false` 소비자였다.
- 페이지 크기 5·5·8 → **8 하나로**. 2단 카드가 서로 높이를 맞추던 제약이 사라졌고, 셋이
  같은 수라야 뷰를 옮길 때 표가 자라거나 줄지 않는다.
- 승인 대기 뷰에만 **대기 경과** 열 — 기록이 못 하는 말이라 큐만 쓴다.

### 수치 출처

컴포넌트 기본값은 없다. 전부 같은 역할의 기존 화면에서 가져왔다.

| 값 | 출처 |
|---|---|
| 레일 그룹 제목 12px / semibold / 0.06em, 항목 14px / `px-2.5 py-[7px]` | 섹션 내비게이션 `pipelineStyles.layout.sidebarTitle` · `sidebarItem` (`app/admin/pipelines/layout.tsx`) |
| 레일 폭 168px | ServiceAssignmentModal 236 에서 항목 3개용으로 한 단 축소 |
| 표 컬럼 폭 (service/code/cloud/note/when/chev) | 카드 시절 그대로 — 전폭이 되며 남는 폭은 `flex-1` 두 칸으로 |
| 행 hover `--pl-row-hover` | pipelines 대시보드 (PR #700) |
| 대기 pill | 워크벤치 라운드의 `benchWait` / `benchWaitHot` |

**대비 실측** — 훅이 두 건을 잡았고 둘 다 실제 실패였다:

- 레일 그룹 제목: `--pl-text-faint` (#98A2B3) 는 흰 바닥에서 2.58:1. 저 값은 어두운
  사이드바 위 gray-400 이었다. → `--pl-text-weak` (#667085, 4.95:1). 표 머리(faint)보다
  한 단 진한 것은 의도다 — 그룹 제목이 이 화면의 계층 선언이고 컬럼 이름은 그 아래 부속이다.
- 꼬리 글리프(chev): 같은 2.58:1 로 비문자 UI 요소의 3:1 도 못 넘었다. → `weak`.
- 대기 pill: #B54708 on #FFFAEB = **5.20:1** (브라우저 실측, AA 통과).

## 검증

- `tsc --noEmit` 통과, `eslint` 통과, `vitest run app/admin/pipelines/queue/requests` 54 tests 통과
- 브라우저 실측(localhost:3011): 세 뷰 전환 · 컬럼 세트 · 행 링크(`/queue/requests/{id}`) ·
  이력 8행 3페이지 · 가로 스크롤 없음(`scrollWidth === clientWidth`) · 세로 스크롤 없음
  (994 → **810**, 뷰포트와 동일)

## 남은 것

1. **요청 단위 "승인 완료" 집계가 계약에 있는가** — 있으면 레일 위에 시안 D 의 단계 밴드
   (`4 → 2 → 17`, 합 23)를 얹어 발견 4를 완전히 닫을 수 있다. 이력 23건은 **이벤트** 단위라
   요청 단위 집계와 다를 수 있어, 확인 전에는 등식을 화면에 쓰지 않는다.
2. **반려 건이 언제 목록에서 빠지는가** — "서비스 측이 확인하면"이라면 반려는 `작업` 그룹이
   맞다. 조건 없이 영구히 남는다면 큐가 아니라 기록이므로 `기록` 그룹으로 내려가야 한다.
   지금은 `작업` 에 두었다.
3. 대기 임계 `WAIT_WARN_DAYS = 3` 은 그대로 뒀다. 목에서 4/4 가 주황인 것은 픽스처 날짜가
   2026-07-20 로 고정되어 있어 생긴 것(28일 경과)이지 임계값 문제가 아니다.
