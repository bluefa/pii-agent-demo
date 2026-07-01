# Admin Pipeline — 디자인 변경 이력 (changelog)

> `admin-pipeline.html`에 적용된 디자인 변경을 라운드별로 기록한다.
> 시스템 명세는 [admin-pipeline-design-notes.md](admin-pipeline-design-notes.md), 컴포넌트 명세는
> [admin-pipeline-components.md](admin-pipeline-components.md) 참조.

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
