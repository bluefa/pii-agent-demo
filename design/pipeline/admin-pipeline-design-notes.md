# Admin Pipeline — 디자인 시스템 노트 (타이포·스페이싱·계층)

> `admin-pipeline.html`의 시각 언어를 Toss 토큰(`design/v15-extract/00-tokens.md`) 위에서 체계화한다.
> Opus 5인 + Codex 디자인 리뷰(전역 타이포 / 대시보드 / 파이프라인 상세 / 서비스·대상 / 스페이싱)로 도출.
> 원칙: **모든 크기·간격은 토큰 스케일 위에서만**, 계층은 크기+굵기+색+간격 4축으로 동시에 표현.

## 1. 타이포 스케일 (Geist / 토큰 스케일 준수)

스케일(px): display 28 · h1 22 · h2 20 · h3 18 · body 15 · body-sm 14 · caption 13 · label 12 · micro 11.

| 역할 | 적용처 | size | weight | letter-spacing | line-height | color |
|---|---|---|---|---|---|---|
| **display** | stat 값 | 28 | 700 | −0.02em | 1.1 | strong · tabular-nums |
| **page title** | `.page-head h1` | 22 | 700 | −0.02em | 1.25 | strong |
| **section/card title** | `.section-title` | 18 | 700 | −0.015em | 1.35 | strong |
| **subsection** | Attempts/Check 헤더 | 14 | 600 | −0.006em | 1.4 | weak |
| **body** | 기본 | 15 | 400 | −0.011em | 1.5 | strong |
| **body-sm** | 표·버튼·kv 값 | 14 | 500 | −0.006em | 1.5 | medium |
| **kv key** | `.kv .k` | 13 | 500 | −0.005em | 1.4 | **medium**(대비↑) |
| **kv value** | `.kv .v` | 14 | **600** | −0.006em | 1.4 | strong |
| **caption/meta** | `.meta` | 12 | 500 | −0.005em | 1.4 | weak |
| **formula/code** | `.formula` | 11 | 500 · **mono** | 0 | 1.4 | faint |
| **micro badge** | `.ftag`/`.kindchip` | 11 | 700 | 0 | — | — |

핵심 교정:
- **stat 값 30 → 28**(display, off-scale 제거) + `tabular-nums`.
- **section/card title 14/medium → 18/700/strong**: 기존엔 본문(strong)보다 헤더가 더 약한 **계층 역전** → 해소. 페이지 섹션 라벨·카드 헤더·task 패널 타이틀 모두 동일 tier.
- **자간 tier**: 전역 −0.011em로 낮추고 큰 텍스트(28/22)만 −0.02em, 18은 −0.015em, 작은 캡션은 −0.005em, micro/caps는 0.
- **formula/metadata**(`count(status=RUNNING)`, `process_status·getProcessStatus`, `job_ids…제거필드`, `count-bound`)는 산문 본문이 아니라 **mono·11·faint** `.formula`로 → 데이터임을 시각적으로 분리.
- **kindchip 10 → 11**(micro floor), 인라인 override 제거·단일 규칙.
- 숫자(값·표·N/M·pager)는 `tabular-nums`.
- `line-height` 본문 1.5(한글 가독), display 1.1.

## 2. 스페이싱 시스템 (4px 그리드: 4·8·12·16·20·24·32·40·48)

off-scale(9·10·11·14·18·22·26·28·34) 전면 제거.

| 대상 | 변경 |
|---|---|
| `.content` padding | 28 32 → **24 32** |
| `.card` padding | 22 → **24** (모든 primary 카드 24 통일) |
| `.stat` padding | 18 20 → **20 20** |
| `.section-title` margin | 22/12 → **24 0 16** |
| `.card+.card` / 카드 간 | **16**(유지) |
| stat-row / meta-2 / two-col gap | 14/16 → **16** |
| `.kv` gap | 9 14 → **12 16** |
| `.tnode` padding / radius | 14/14 → **16 / 12** |
| `.breadcrumb` mb | 14 → **16** |
| `.page-head` mb | 18 → **16** |
| `.filterbar` gap | 10 → **12** |
| `.seg button` pad | 6 14 → **6 16** |
| `.btn.sm` pad | 0 11 → **0 12** |
| `.recipe` pad | 12 14 → **12 16** |
| `.empty` pad / ico | 34/26 → **32 / 28** |
| `.toast` bottom / `.connector` w | 26/34 → **24 / 32** |
| sub-grid pad(10·7·2) | 세로 8·가로 12 / 7→8 / 2→4 |

**수직 리듬**: page-head→섹션 24 · 섹션→섹션 24 · section-title→본문 16 · 카드→카드 16 · intra-card 블록 16(타이트 그룹만 12) · kv 행 12. 인라인 산발 마진은 `.mt-16`/`.mt-12` 유틸로 통일.

## 3. 컴포넌트 교정

- **stat 카드**: `unavailable` = inner-bg + dashed border(데이터 없음 시각화). 라벨 caption/medium, sub는 `.formula`. 기간 통계 카드는 값 색 medium으로 살짝 flatten(순간값 대비 secondary).
- **표**: 행 클릭 어포던스 **하나로 통일** — 우측 `›` chevron. 대시보드의 중복 `상세보기 ›` 링크 컬럼 제거. thead 미세 구분(inner-bg 선택).
- **filter bar**: `⟳ 새로고침` 높이 36(입력과 정렬) + `margin-left:auto`. inert `.grow` 제거.
- **kv**: key 색 weak→**medium**(대비 4.5:1), value weight 600, label 폭 130 통일(120/150 override 제거).
- **파이프라인 상세**: flow 카드와 task-detail 카드 사이 **16 gap**(현재 0). 패널 타이틀 18/strong, 서브섹션 14/600/weak. `UnavailableMetaGroup`은 **기본 접힘**(open 제거), 값은 중립 "미제공" 그레이 칩(❌ 남용 제거 — 4개 ❌가 에러처럼 보임).
- **TaskNode**: radius 12·padding 16·border 1px·dashed는 gray-300, kindchip 11, **상태 아이콘 status색**(✔success/▶info/✕error/○faint/⊘pending), 내부 크기 3-step(nm14 / seq·pill12 / meta·chip11).
- **connector**: `─▶` → 단일 `→`, 색 weak.
- **서비스 목록**: 항목 border 제거(리스트답게), radius 8, hover inner-bg, active만 primary-light. `#tspanel` 빈 상태 min-height + 세로 중앙.
- **target 헤더**: dev 주석(`getProcessStatus`) 제거/툴팁화, `direct` 태그 green→중립/info.
- **notice**: primary-light(=READY pill색과 혼동) → inner-bg + medium 텍스트.
- **topnav brand** 16 → 18.

## 4. 라운드 2 확정 (재리뷰 Opus×2 + Codex 반영)

- **자간**: base는 canonical `-0.018em`로 확정(라운드1의 −0.011은 과하게 느슨 → 철회). 대형(28/22/18)만 −0.02/−0.015.
- **kv**: key 13/500/medium, value 14/600/strong(둘 다 line-height 1.4). 긴 라벨용 `.kv.wide`(150px) 클래스로 인라인 override 제거.
- **subsection-title**: weak→**medium**(헤더로 읽히게).
- **.meta**: `font-weight:500` 포함(인라인 band-aid 제거). 읽어야 할 설명 문단은 `.meta`(12/weak) 대신 **`.note`(13/medium/1.5)**.
- **전역 규칙 추가**: `.mono`·`.link`(마크업에서 쓰였으나 미정의였음).
- **CONDITION_CHECK 노드/칩**: orange `.ext`(=`외부`/warning과 의미 충돌) 대신 **`.kindchip.cond` info-blue**. dashed border는 gray-400로 가시성↑. (flow·task패널·preview 모달 3곳 모두 `cond`.)
- **데이터 배지 이모지 제거**: `근사 ⚙️`/`파생 ⚙️`/`미채움 ⚠️` → 텍스트만(색이 의미 전달). empty-state 아이콘(📭/👈)은 유지.
- **기간 stat 값**: medium + weight **600**(grey+700 혼재 신호 해소).
- **판정 유지(기각)**: `.meta-2 align-items:start`(자연 높이 — stretch는 실행메타 카드에 빈 여백), 페이지타이틀 22 vs 섹션 18 동일 weight(22→18은 표준 스텝) — 스크린샷상 top-heavy 아님.

## 5. 구현/검증 루프

토큰 재작성 → 페이지별 브라우저 스크린샷 검증 → Opus/Codex 재리뷰 → 반복. 목표: off-scale 0, 계층 역전 0, 어포던스·대비 일관. **결과**: Codex 최종 사인오프 "design system coherent", 콘솔 에러 0.
