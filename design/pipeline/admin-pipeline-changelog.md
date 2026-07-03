# Admin Pipeline — 디자인 변경 이력 (changelog)

> `admin-pipeline.html`에 적용된 디자인 변경을 라운드별로 기록한다.
> 시스템 명세는 [admin-pipeline-design-notes.md](admin-pipeline-design-notes.md), 컴포넌트 명세는
> [admin-pipeline-components.md](admin-pipeline-components.md) 참조.

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
