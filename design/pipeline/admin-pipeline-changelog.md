# Admin Pipeline — 디자인 변경 이력 (changelog)

> `admin-pipeline.html`에 적용된 디자인 변경을 라운드별로 기록한다.
> 시스템 명세는 [admin-pipeline-design-notes.md](admin-pipeline-design-notes.md), 컴포넌트 명세는
> [admin-pipeline-components.md](admin-pipeline-components.md) 참조.

## Round 13 — 파이프라인 상세를 논리 그룹으로 재구성 + API 실사 반영 (2026-07-05)

오너 피드백: "API Response가 상세 페이지에 안 녹아 있다 / 하단 접힘 2개('대상 상세
metadata'·'실행 스케줄 메타')는 왜 필요하냐 / metadata 상단 노출 + 논리 그룹 / Task도
논리적으로 설명 / 새로고침 버튼 삭제 / 파이프라인 목록에도 아이콘 버튼".
RecipePreview·TaskDetail 실응답 계약(스네이크케이스, _V1 레시피 코드) 실사 기반.

- **그룹 3개로 재편**: ① **파이프라인 정보**(IdentityBar 카드, 상단 — CSP 액센트·
  TargetSourceId(↗ 대상 상세)·유형·레시피 display_name / meta: 레시피 설명·코드·서비스·
  생성·마지막 활동·leased·스케줄 지연) ② **상태**(슬림 상태 바 — "지금" 1행만, sb-meta 폐지)
  ③ **Task 흐름**(섹션 승격 + desc). **하단 접힘 2개 폐지** — CSP 세부는 target 페이지 몫(↗).
- h1 "파이프라인 #id" 신설(페이지 제목 규칙 정합).
- **Task 패널 3그룹**: **정의**(task_definition·operation 코드·실행 방식·설명) /
  **실행 계약**(effective 폴링·타임아웃·재시도 예산·TF 슬롯 + kind별 **판정 방식** 문단 —
  success_policy 요약, 전 terraform step 동일 텍스트라는 API 사실 반영) /
  **진행 기록**(시각·실패 누적+error_code·attempts 테이블/폴 관찰(task_check)).
- API 정합: recipe 코드 `*_V1`, RECIPES 카탈로그(display_name·description),
  #128·#124 task에 task_definition·operation·description 채움.
- **새로고침 버튼 전면 삭제**(대시보드·target — 오너 지시). "상세 ›" 텍스트 링크 →
  **↗ 원형 버튼**으로 전 테이블(대시보드 목록·이력·대상 목록) 통일.

## Round 12 — target 상세를 app 문법으로 재구성 (2026-07-05)

오너 피드백: "#/target/204 마음에 안 듦 — 기존 app의 타겟소스 상세 표현 방식으로 /
installation status 우선 삭제 / 최근 파이프라인·CTA 표현 이상함 / 정보 계층 잘".
app `ProjectPageMeta`·`IdentityBar`(`app/integration/target-sources/[id]/`) 실사 후 이식.

- **페이지 헤더**: h1 = **서비스명 (회색 코드)** — app PageHeader 문법. **CTA 3버튼을 헤더
  우측으로 승격**(액션 카드·notice 폐지 — 잠금 사유는 disabled tooltip).
- **IdentityBar 신설**(`.idbar`): CSP 액센트 스트라이프(4px)+아이콘 박스(38, 12% tint) ·
  CSP명/"Cloud Provider" · 세로 구분선 필드(TargetSourceId·계정 — 라벨 12 위/값 mono 14 아래) ·
  우측 새로고침. IDC는 sub 라벨 생략(app v16 규칙).
- **설치 상태(process_status) 표시 전면 제거**(오너: "우선은 삭제") — target 페이지 procChip,
  서비스 검색 열, CSP metadata kv 행 모두. targetButtons 내부 게이팅 판정에만 사용.
- **최근 파이프라인 = 상태 바 문법 재사용**: pill lg + 진행 + 현재 task + error_code +
  [파이프라인 상세→], meta(유형#id·레시피·생성·활동). FAILED면 tint — 미니 카드 폐지.
- 이력 테이블 열 이름 컨벤션 정합(파이프라인 유형·진행도·생성시간). 컴포넌트 시트에
  IdentityBar 섹션(8.5) 추가.
- **보완(오너 2차)**: CSP metadata 접힘 폐지 — IdentityBar **카드 하나**에 구분선으로 상시
  노출(`idbar-meta`). CSP 필드 없는 IDC는 메타 구간 자체를 생략.
- **보완(오너 3차)**: CTA를 헤더에서 내려 **Action Group — metadata 카드 바로 아래**로.
  배치 논리: 태스크 흐름 "① 대상 확인(identity·metadata) → ② 상태 판단 → ③ 행동" —
  행동은 판단 재료 다음. 대시보드 필터바와 같은 "도구는 카드 밖 독립 행" 문법.
  잠금 사유를 그룹 우측 상시 캡션으로(설명 없는 disabled는 버그로 읽힘 — tooltip 병행).
  최종 계층: 제목 → IdentityBar(카드) → 액션 그룹(16px 소속) → [64px] 최근 파이프라인 → 이력.
- **보완(오너 4차)**: **계정(account) 필드 표시 제거** — CSP 식별자의 중복 사본
  (Azure에선 Subscription ID와 같은 값이 두 번 노출). IdentityBar 필드·metadata kv 전부.
- **보완(오너 6차)**: **취소 버튼을 상태 바 안으로** — 취소는 최신 run에 귀속되는 조작
  (파이프라인 상세 상태 바와 동일 문법). 종단 상태면 미노출, 취소 요청 중이면 잠금.
  액션 행은 설치/삭제만. "파이프라인 상세 ›" 텍스트 버튼 → **원형 사선 화살표(↗) 버튼**
  (`btn.round` + `i-arrow-ur` — app CollabChannelChip의 사선 화살표 문법).
- **보완(오너 5차 — 그룹핑 재정의)**: 독립 Action Group 폐기 → **"파이프라인 상태" 그룹**
  = 상태 바 + 액션 행(12px). 근거: 버튼 활성/잠금은 전부 최근 파이프라인에서 파생,
  취소는 그 run에 대한 조작 — 상태와 행동은 한 사고 단위. 잠금 캡션이 다른 그룹을
  가리켜 설명하던 냄새 해소. 최종 그룹: **대상 → 파이프라인 상태(+액션) → 이력**
  (무시간 → 현재 → 과거).

## Round 11 — 3페이지 일관 적용 + 파이프라인 메타데이터 활용 (2026-07-05)

오너 지시: 서비스/target/파이프라인 상세 UX 시나리오 + "최신 main의 풍부한 파이프라인
메타데이터를 전혀 안 쓴다" + 덩어리 간 여백 일관화. 최신 main DTO(PipelineDetail·TaskDetail·
LivePipelineStatistics) 실사 후 반영.

- **간격 3계층 확정**: 섹션 덩어리 간 40→**64**, 같은 섹션 위아래 블록 16 통일(나란한 카드 12와
  구분) — style-guide §2 개정.
- **메타데이터 편성(파이프라인 상세)**: 레시피(recipe_definition)·단계 n/총 m — meta 행,
  **다음 실행(next_due_at)**·**취소 요청됨(cancel_requested) 배지**·재시도 예산(fail/max) —
  상태 바 1행 조건부, leased·due_lag — "실행 스케줄 메타" 접힘(구 ADR-021 미제공 섹션을
  실필드로 재편성, 미결 #3 해소). 사이드 패널: effective_* 라벨·TF 슬롯·설명 행.
- **PENDING(LIN-30) 전면 지원**: 호박색 pill 신설, mock #129(GCP 시작 지연 15:30), 상태 바
  "시작 대기 · 시작 예정", 정렬 FAILED>RUNNING>PENDING, 상태 필터 옵션, 취소 가능(비종단),
  target 잠금 판정 RUNNING∪PENDING.
- **서비스 검색(IA §2 적용)**: 권한 사용자 목록·API 제거, 대상 목록에 설치 상태 procChip +
  활성 파이프라인 pill(#id) 열 추가.
- **target 상세(IA §3 적용)**: kv 5행 해체 — 식별 칩 행(id 16px mono + CSP + 서비스 캡션),
  설치 상태 procChip T1 승격, 계정·CSP metadata 접힘(T4).
- **X 판정 청소(IA §4 #7~9)**: 상설 null 2행(last_response_code/summary)·구현 해명문 2개 제거.
- **mock 정합**: task 표시명을 오너 컨벤션("실행 단위+테라폼+Plan/Apply/Destroy")으로 통일,
  가짜 에러코드 PE_REQUEST_REJECTED → 실제 enum JOB_FAILED.
- usecases §3.5 대표 UX 시나리오 3개(S1 실패 대응 / S2 설치·삭제 / S3 진행·대기 확인) 추가.

## Round 10 — 전역 기간 대시보드 확정 + 목록 정보 재구성 (2026-07-05)

오너 결정(벤치마크 리서치 첨부): "전체 기간에 대한 dashboard라는 느낌" — Round 9의
분리형(현황 고정 24h)을 폐기하고 **전역 기간 조회형**으로 최종 확정.

- **기간 seg → 페이지 헤더 우측**(시계 아이콘 + "기간 · 대시보드 전체 적용" 스코프 라벨).
  현황 실패·성공 카드가 기간과 동기화(라벨도 동적: "실패 · 최근 7일"), 동작 중 카드만
  "· 현재"로 순간값임을 스스로 밝힘.
- **`.section-desc` 신설**: 섹션 제목 아래 12px 캡션 — 현황("최근 24시간(생성시간 기준)
  실패·성공 집계 — 기간 필터와 동기화…"), 목록("최근 24시간 생성 3건 · 상태 FAILED ·
  정렬: 실패 → 진행 중 → 최신순" — 필터 상태 상시 가시화).
- **목록 열 재구성(오너 지정)**: TargetSourceId | CSP | 파이프라인 유형 | 상태 | 진행도 |
  생성시간. "외부" provenance 배지 제거(오너: "AWS면 그냥 AWS지"), Provider 표기 → CSP.
- **TargetSourceId = 숫자**(오너: "target은 그냥 숫자야"): mock id ts-aws-001 등 5종 →
  101/102/103/204/305. 라우트 `#/target/101`. 검색도 숫자 문자열 매칭.
- **행 이동 어포던스**: 목록·이력·대상 테이블 마지막 열에 "상세 ›" rowlink(hover 시 primary)
  — "상세로 이동한다는 느낌이 없다" 해소.

## Round 9 — 오너 피드백: 제목 승격·stat 타일·기간 재배치 + 프로세스 v2 (2026-07-05)

오너 피드백: 제목 더 크게 / stat 카드 연한 회색·라벨↔숫자 간격 / "실패 (FAILED)" 문구 정리 /
필터는 필터대로·기간은 목록에 / **디자인 프로세스 부재 — 유즈케이스·태스크부터**.

- **제목 24/20 승격**: h1 20→24, 섹션 제목 16→20 (본문 14와의 대비 확대).
  16은 다이얼로그 제목 전용으로 강등 — 타입 스케일 5단→6롤 (style-guide §1 개정).
- **stat 회색 타일**: 배경 `--gray-100`·그림자 제거 — "회색 타일=읽기 전용 요약,
  흰 카드=콘텐츠·상호작용" 표면 문법 신설(style-guide §3). 라벨↔숫자 간격 8→12.
- **라벨 한글 단일화**: "실패 (FAILED)"→"실패 · 최근 24시간", "성공 (DONE)"→"성공 · 최근 24시간",
  "순간값" 인라인 캡션 제거(툴팁으로). 병기 금지 규칙 명문화(style-guide §1).
- **기간 seg 재배치(2차)**: 전역 승격안 폐기 → 태스크 분리. **현황=모니터링**(고정 24h 창,
  조작 없음) / **목록=조회**(검색·상태·Provider·기간이 한 필터바). 필터바는 카드 밖
  독립 도구 행으로 분리("필터는 필터대로").
- **프로세스 v2**: design-process.md 개편 — 유즈케이스·태스크 정의를 1단계로 신설(오너 지적:
  기능 정의 없이 형태를 다듬고 있었음), 턴 선언 규칙. `admin-pipeline-usecases.md` 초안 신설.
  오너 제공 가이드 3종(여백 7원칙·수치 시스템·UI 기술 기준) → `.claude/skills/design-guide` 신설.

## Round 8 — 스타일 가이드 수립 + 타입 스케일 5단화 + 기간 전역 승격 (2026-07-04)

계약 문서: **[admin-pipeline-style-guide.md](admin-pipeline-style-guide.md) 신설** (크기·행간·간격
SSOT — typography.md 크기 표 대체). 오너 지시: "폰트/사이즈 근거부터 설계, 섹션 구분 논리,
현황 가로 늘어짐, 기간 필터 위치" → 논리 4개 합의 후 적용 (A안+B안 병합).

- **타입 스케일 11종→5단** {12/14/16/20/32}: 페이지 제목 20/700, 섹션 16/600, 본문 14,
  캡션·배지 12(10.5·11 폐지 — 12 미만 금지), 디스플레이 숫자 32. 행간 120/140 2단.
  44치환(전건 1회 매칭 assert).
- **간격 논리**: 섹션 간 40(>내부×2), 섹션 제목↔내용 12, 카드 패딩 20/24/24,
  페이지 제목 아래 24. 섹션 제목 옆 설명문 폐지(툴팁 강등).
- **stat 카드 폭 260 상한** — `repeat(3,1fr)` 폐기, "박스 폭은 내용이 정한다".
  실측 400×89(4.5:1) → 260×109(2.4:1).
- **기간 seg 전역 승격**(A+B 병합): 페이지 헤더 우측으로 이동, 실패·성공 카드 **및 목록**이
  같은 기간(created_at)을 필터 — 컨트롤 위치=지배 범위. PERIOD_STATS 하드코딩 표 폐기
  → PIPELINES 파생 집계(카드 숫자=목록 행 수 일치). MOCK_NOW(2026-06-30 15:00) 기준.
- 파생 개정: tnode 높이 164→**184**(14px 2줄 클램프 재산정, 실측 -1px 수납) — design-system §1,
  typography.md에 대체 선언 헤더.
- 검증: 4페이지 폰트 크기 집합 ⊆ {12,14,16,20,32} 실측, 섹션 마진 40/12, 카드 260×109,
  1d 기간 카드 실패 1 = 목록 FAILED 1행 일치, 콘솔 에러 0.

## Round 7 — 정보 계층 정리: 대시보드 반영 (2026-07-04)

계약 문서: [admin-pipeline-info-hierarchy.md](admin-pipeline-info-hierarchy.md) §1 (4페이지 정보
전수 인벤토리 + T1~T4/X 판정). 오너 승인 범위 = 대시보드만; §2~§4는 피드백 대기.

- **stat 카드 6→3장**: `동작 중(RUNNING·순간값)` + `실패(기간)` + `성공(기간)` 단일 현황 행.
  제거 — slot 리밋 카드(미제공 분모), 동작 중 TF task 카드(근사), 기간 "실행 중" 카드(중복).
  기간 seg는 현황 섹션 타이틀 우측으로 이동. `renderPeriod` → `renderStats` 통합.
- **목록 열 보강**: `유형(INSTALL/DELETE)` + `생성일` 추가 (5→7열) — target 이력 테이블과 정합.
- **FAILED 우선 정렬**: `FAILED > RUNNING > 나머지, 그룹 내 id desc` (기존 id desc 대체) —
  실패가 페이지네이션 뒤로 밀리지 않게.
- 권위 문서 동시 개정: components.md §4.1 (스케치·블록 표·정렬/제외 이력).
- 검증: 3카드/7열/FAILED 최상단/1h 토글 시 failed 강조 해제/기간 토글·페이지 순회 JS 확인,
  fresh load 후 4페이지 순회 콘솔 에러 0.

## Round 6 — LIN-20 B1: Phase 4 — variant B(다크 크롬) + 사이징 스케일 적용

계약 문서: [design-process.md](design-process.md)(프로세스)·
[admin-pipeline-design-system.md](admin-pipeline-design-system.md)(치수·표면·금지 목록).
오너 결정: Phase 0 캐릭터 = n8n(구조)+Linear(표면), Phase 3 variant = **B 선택**.

**사이징 정렬** (design-system §1 — 실측 결함 7건 해소, 26치환+수정 2건 전부 제자리 편집)
- 컨트롤 높이 3단 고정: `.input`/`select`/`.btn` **32** · `.btn.sm`/`.seg button`/`.pill.lg` **28** ·
  `.pill`/`.kindchip` **20** (kindchip `flex:none` — tnode flex 안 수축 방지)
- 고정 리듬: 아이콘 sm 13→**14**, 테이블 th **34**/td **44**, Task 노드 **높이 164 고정**
  (flex column, nm·meta 2줄 클램프 — 전문은 사이드 패널 몫)
- 나란한 카드 등고: `.detail-grid` sticky→**stretch**(+`min-height:300px`),
  `.two-col` 카드 `margin-top:0`(그리드 안 `.card+.card` 마진 누출 수정) —
  detail-ia.md·components.md의 sticky 계약 동시 개정

**variant B — 다크 크롬 + 라이트 캔버스** (design-system §2)
- 탑네비·사이드바 **#101828 다크** (brand/nav/active/hover 색 재정의, active 인디케이터 유지)
- FAILED 상태 바: inset 좌측 바 → **붉은 틴트 표면**(gradient)+보더, pill.lg 1px 링
- 헤더 주석을 design-system.md 참조로 갱신

**검증** (Phase 4 게이트)
- 게이트 A(기계): 치수 audit 스크립트 4페이지 — 초회 위반 2건(two-col 12px 차·kindchip 19px)
  수정 후 **전 페이지 PASS**. §4.5 스팟체크(FAILED 자동선택·취소 매트릭스·N/M) OK, JS 에러 0
- 게이트 B(비평): fresh-eyes 비전 에이전트가 렌더 4페이지 직접 관찰·채점 —
  R1: P0 0 / **P1 5** → 전건 수정 후 R2 재검증:
  ① FAILED/CANCELLED 진행 바가 RUNNING과 같은 파랑("진행 중" 오독) → progressBar에
  status 인자, `.pbar.s-FAILED .fill` err 색 (바 색=상태색 문법 완성)
  ② 실패 stat 값이 성공과 같은 무채색 → failed>0일 때만 err-text 조건부 틴트
  ③ CONDITION_CHECK kindchip이 primary 파랑(상태 IN_PROGRESS와 등가로 오독,
  anti-slop §3-7) → 무채 + dashed 보더(tnode.cond 문법 공유)
  ④ 사이드 패널 카드 전체 가로 스크롤(kv·제목까지 밀림) → Attempts 표만
  `.tblwrap` 내부 스크롤
  ⑤ `.pbar .lbl` 11.5px/500 = 9롤 밖 → 12px/600 (t-key)
  (+P2: stat 레이블 "Running"→"실행 중 (RUNNING)" 언어 통일)
  **R2: 5건 해소 + 회귀 없음 확인 → PASS.** 잔여 P2 백로그(비차단):
  Attempts 시각 열 기본 절단(error_code ellipsis로 해결 가능) ·
  count-bound 주석 중간 개행 · 노드 상태 아이콘 형태 통일(원형)
- 게이트 C(오너): before/after 승인 후 커밋

## Round 5 — LIN-20 B1: 파이프라인 상세 IA v2 + 타이포그래피 스펙 적용

계약 문서: [admin-pipeline-detail-ia.md](admin-pipeline-detail-ia.md)(레이아웃)·
[admin-pipeline-typography.md](admin-pipeline-typography.md)(타이포) — codex 6라운드 크로스 리뷰 MERGE-READY.

**타이포그래피** (typography.md §0 적용)
- 폰트 스택에 Geist/Geist Mono 복원(App next/font 정렬 — 미설치 시 시스템 고딕 폴백, 외부 의존성 0)
- base 13px + 전역 자간 -0.014em(13px 보정 tier), line-height 1.55
- 롤 정렬: h1 20→18(t-title), kv key weight 500→600(t-key), pill/kindchip 10.5(t-micro),
  formula 12.5(t-mono), stat 값 -0.02em(t-display)

**파이프라인 상세 v2** (components.md §4.4 계약)
- h1·"파이프라인 정보"/"실행 메타" 2카드 해체 → **PipelineStatusBar**(대형 pill + ProgressBar +
  현재 task + 취소 CTA 상주, meta 행에 타입/#id/Provider 칩/서비스/시각/파생 task)
- FAILED: 상태 바 좌측 err 액센트 + error_code 칩 + **실패 노드 자동 선택**(selectedTaskId 초기 파생)
- Task 상세 → **우측 340px sticky 사이드 패널**(grid minmax(0,1fr)+340px, 노드 200→172px 컴팩트,
  scrollIntoView 제거)
- 하단 접힘 각주 2개: **대상 상세 metadata**(CSP별 kv — mock에 App CloudTargetSource 필드명 그대로
  awsAccountId/tenantId/subscriptionId/gcpProjectId 추가, idc는 계정+안내 문구) · ADR-021 미제공 4필드

검증: #128(RUNNING)·#124(FAILED 자동선택)·대시보드/검색/target 타이포 영향 브라우저 확인, 콘솔 에러 0.

## Round 4 — LIN-20 B1: 모던 어드민 리디자인

방향 전환: Toss-소프트 → **모던 어드민(밀도형)**. 로직·라우팅·mock·§4.5 파생 규칙은 무변경,
비주얼/UX 레이어만 교체. (Round 1–3은 Toss 토큰 기준의 정제 이력)

**파운데이션**
- 토큰 전면 교체: Toss surface → 중립 gray 스케일 + 시맨틱 변수(`--bg-*`/`--text-*`/`--border*`).
  다크모드는 `:root` 오버라이드만 추가하면 되는 구조(이번 범위 밖)
- primary `#0064FF`→`#2563EB`, 상태색을 ok/err/info/warn/off 5종 bg·text 페어로 정리(산발 hex 회수)
- radius 20/16→10/8, 카드 그림자 → **1px border + shadow-xs**
- 폰트: 미로딩 Geist/Pretendard 선언 정리 → 시스템 스택 확정, letter-spacing 튜닝 제거
- **이모지·유니코드 글리프 전면 제거 → 인라인 SVG 스프라이트 16종** (외부 의존성 0 유지)

**컴포넌트**
- 탑네비: active `●` → 2px 하단 보더, 브랜드 마크 추가. 사이드바 active: inset 보더
- StatCard: `.formula` 노출 → 카드 `title` 툴팁으로 격하. 미제공 카드 점선 제거(조용한 카드로)
- 테이블: 헤더 11px 캡션, 마지막 행 border 제거, chevron SVG
- StatusPill: radius 999 + RUNNING/IN_PROGRESS dot **pulse 애니메이션**
- ProviderTag: 컬러 텍스트 → **중립 텍스트 + 브랜드 dot**(목록 무지개 소음 제거)
- ProgressBar: N==M이면 success 색(`.pbar.done`)
- TaskNode: 상태 아이콘 → 원형 칩 + SVG, 선택 시 primary ring, 메타 선행 `·` 구분자 버그 수정
- 버튼: variant별 disabled 스타일(opacity 흐림 → 회색 배경/보더로 명확화)
- 검색 입력: placeholder 이모지 → `.searchbox` SVG 아이콘
- 모달 480px/r12/shadow-lg + recipe step 구분선, 토스트 체크 아이콘

**UX**
- `파생`/`process_status` 등 내부 용어 배지 → info 아이콘 `title` 툴팁으로 격하
- Task 노드 선택 시 하단 상세 `scrollIntoView`(클릭 무반응감 해소)
- 서비스 페이지 two-col stretch + min-height(하단 빈 화면 해소), 파이프라인 메타 그리드 align-start

검증: 4페이지 + preview/cancel 모달 + 생성(A10)·취소(A6) 플로우 브라우저 전수 확인, 콘솔 에러 0.

## Round 3 — 전체 육안 점검 pass (최종)

4개 페이지 + 모달을 브라우저에서 전수 재점검하여 발견한 2건 수정.

| # | 변경 | 이유 |
|---|---|---|
| 1 | **진행 바 fill 렌더링 버그 수정** — `.pbar .track`/`.fill`에 `display:block` 추가 | `<span>` 인라인 요소라 `height:100%`가 무시되어 **fill이 전 화면에서 안 보이던 버그**(모든 진행 바가 빈 트랙으로 렌더). 대시보드 목록·대상 이력·최근 카드 전부 영향 |
| 2 | **Provider 외부 태그 소음 제거** — `.ptag.external` 점선 orange 박스 삭제, `외부` ftag 배지만 유지 | 점선 박스 + 배지 = 동일 정보 이중 인코딩. 목록 5행에 반복되며 표 전체를 지배하던 시각 소음 제거. 데이터 출처 표기(정직성)는 배지가 유지 |

## Round 2 — Opus×2 + Codex 재리뷰 반영

| # | 변경 | 이유 |
|---|---|---|
| 1 | `.mono`·`.link` 전역 규칙 추가 | 마크업에서 사용되지만 CSS 미정의(최근 파이프라인 #id가 sans로 렌더, 404 링크 무스타일) |
| 2 | `.meta`에 `font-weight:500` 포함, `.note`(13/medium/1.5) 신설 | 인라인 weight band-aid 제거. 실행 메타 설명 문단이 12/weak로 너무 흐렸음 → 읽는 문단은 `.note` |
| 3 | `.kv` key 13/500/medium ↔ value 14/600/strong (line-height 1.4) | key·value가 같은 14px라 위계가 색에만 의존 → 크기+굵기로도 분리 |
| 4 | `.subsection-title` weak→medium | 헤더가 비활성 캡션처럼 보임 |
| 5 | CONDITION_CHECK kindchip: orange `.ext` → **info-blue `.cond`** (flow·패널·모달 3곳) | orange는 `외부`(warning) 의미와 충돌. dashed border도 gray-400로 가시성↑ |
| 6 | 데이터 배지 이모지 제거 (`근사 ⚙️`→`근사`, `파생 ⚙️`→`파생`, `미채움 ⚠️`→`미채움`) | 이모지가 목업 인상을 줌. 색이 이미 의미 전달. empty-state 아이콘은 유지 |
| 7 | 기간 통계 값 weight 700→600 | grey(비강조)+bold(강조) 혼합 신호 해소 |
| 8 | base letter-spacing `-0.011`→canonical **`-0.018em`** | 토큰 원본 준수(라운드1 완화값 철회). 대형(28/22/18)만 −0.02/−0.015 유지 |
| 9 | `.kv.wide`(150px) 클래스로 인라인 grid override 대체, `.den` 자간, pill 패딩 on-grid | 일관성 |

## Round 1 — 5인 디자인 감사(전역 타이포/대시보드/상세/서비스·대상/스페이싱) 반영

**타이포그래피**
- stat 값 30→**28**(display, 토큰 스케일 복귀) + `tabular-nums`
- 카드/섹션 타이틀 14/700/medium → **18/700/strong**: 헤더가 본문(strong)보다 약했던 **계층 역전** 해소. 서브섹션(Attempts/Check 요약) 14/600 tier 신설
- 자간 tier 도입: 대형 −0.02em(28/22)·−0.015em(18), 소형 캡션 −0.005em, micro/caps 0
- 본문 `line-height:1.5`(한글 가독), display 1.1
- 기술 캡션(`count(status=RUNNING)`, `process_status`, `count-bound`)을 산문에서 분리 → **`.formula`(mono/11/faint)**
- kindchip 10px→11px(micro floor), 인라인 override 제거
- 숫자 열·pager·stat 값 `tabular-nums`

**스페이싱 (4px 그리드 전면 준수)**
- content 28/32→**24/32**, card 22→**24**, section-title 22/12→**24/0/16**, stat 18/20→**20**
- kv gap 9/14→**12/16**, tnode 14/r14→**16/r12**, breadcrumb 14→16, page-head 18→16
- filterbar gap 10→12, seg 패딩 6/14→6/16, btn.sm 0/11→0/12, empty 34→32, toast 26→24, connector 34→32
- 산발 인라인 마진 → `.mt-16`/`.mt-12` 유틸, intra-card 블록 gap 16 통일

**컴포넌트**
- 미제공(❌) stat 카드: inner-bg + dashed border(일반 지표와 구분)
- 기간 통계 카드: 값 medium으로 flatten(순간값 대비 secondary)
- 표 행 어포던스 통일: 중복 `상세보기 ›` 링크 컬럼 제거 → 우측 chevron 하나
- 필터 바: 새로고침 36px(입력과 정렬)+우측 정렬, inert `.grow` 제거
- TaskNode: 상태 아이콘 status 색(✔success/▶info/✕error/○faint/⊘pending), 커넥터 `─▶`→단일 `→`, border 1.5→1px
- 실행 메타 카드: 설명 문단 + 기본 접힘 `<details>`(❌ 4행이 에러처럼 보이던 문제), naTag `미제공 ❌`→중립 `미제공`
- 서비스 목록: 항목별 border 제거(버튼 무더기→리스트), radius 8, active만 primary-light
- 빈 상태 세로 중앙(`.empty.center`), notice 색 중립화(READY pill과 혼동 방지)
- topnav brand 16→18, 버튼 높이 38→36(sm 30→32)

## 검증

- 매 라운드 4개 페이지 브라우저 스크린샷 + 콘솔 에러 0 확인
- 리뷰: Opus 7인(페이지별·시스템별) + Codex(gpt-5.5 xhigh) 2회 — 최종 사인오프 "design system coherent"
