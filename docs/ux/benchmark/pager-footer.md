# 표 마감 페이지네이션 바 — 세 칸 그리드 (시안 A + C)

- **일자**: 2026-08-26
- **대상**: `Pagination` (표 21곳) — 발단은 Airflow 확인 탭
  (`/admin/pipelines/ops/target-sources/[id]?tab=airflow`)
- **아티팩트**: https://claude.ai/code/artifact/1b8c15d6-667d-4398-8071-c4da3d037d7c
- **구현 PR**: (이 커밋이 속한 PR)

## 발단

> "airflow 확인탭의 pagination footer가 왜 이모양이냐?? ㅋ.. 괜찮은 디자인 찾아보자."

## 문제 (실측, 근거 등급 포함)

Chrome 1920×902, `main @ 864ecf9d`, #1801(리소스 30개) 기준.

| # | 문제 | 등급 | 실측 |
|---|------|------|------|
| 1 | 바 한가운데 스페이서가 협곡을 만든다 | UX 원칙 · 거리=정보 구조 | 왼쪽 231px + **스페이서 903px(66%)** + 페이저 208px / 총 1,372px |
| 2 | 1건짜리 표에도 컨트롤 6개 | UX 원칙 · 스캔 속도 | #2103: 행 1개 · 컨트롤 6개 · 그중 상시 비활성 4개 |
| 3 | 비활성 화살표 명도비 미달 | **수치 위반** | `opacity-35` × `#374151` on `#FCFCFD` → **1.89:1** (텍스트 4.5, 비텍스트 3.0 둘 다 미달) |
| 4 | 셀렉트 화살표가 렌더되지 않음 | **수치 위반(버그)** | `getComputedStyle(select).backgroundImage === "none"` — 그런데 `pr-[22px]` 는 살아 있어 55px 상자 오른쪽이 빈다 |
| 5 | 푸터가 표의 열과 어긋남 | **수치 위반** | 셀 텍스트 x=267 / 푸터 텍스트 x=263 — **4px**. `px-[14px]`·`gap-0.5(2px)` 는 간격 세트(4/8/12/16/24) 밖 |
| 6 | 같은 탭에 페이저 문법이 둘 | UX 원칙 · 케이스 축소 | 표 푸터 28×28 "표시 N건씩" 양끝정렬 / 논리 DB 모달 32×32 "페이지당" 가운데정렬 |
| 7 | 마감 바가 데이터 행처럼 읽힘 | 제안 | 푸터 53px vs 행 62px |

### 4번의 원인

```
bg-[url("data:image/svg+xml;utf8,<svg ... width='9' height='9' ...>")]
                                            ↑ arbitrary value 안의 공백
```

Tailwind v4 가 이 클래스를 만들지 않는다. `appearance-none` 과 `pr-[22px]` 만 살아남아
드롭다운이 **비활성 텍스트 인풋**처럼 보였다. 이 바를 쓰는 표 21곳 전부 해당.

## 참고한 레퍼런스

아티팩트에 13개가 있고, 실제로 코드에 반영된 것은 다음 다섯이다.

| 레퍼런스 | URL | 빌린 것 |
|---|---|---|
| 이 앱의 논리 DB 모달 푸터 | (사내 · `DbWeeklyBoard.tsx`) | **3열 그리드 구조**(범위 / 페이저 / 페이지당), 컨트롤 32px, 낱말 "페이지당" |
| Material UI TablePagination | https://v6.mui.com/base-ui/react-table-pagination/ | 스페이서를 가운데 두지 않는다는 원칙 (MUI 는 맨 앞, 우리는 세 칸으로 나눔) |
| Vercel Geist Pagination | https://vercel.com/geist/pagination | "Hide unavailable slots rather than disabling them" → first/last 제거 |
| AWS Cloudscape Table view | https://cloudscape.design/patterns/resource-management/view/table-view/ | "Display the pagination even if the resources set fits in one page" → **바는 항상 그린다**(시안 D 기각 근거) |
| NN/g Infinite Scrolling | https://www.nngroup.com/articles/infinite-scrolling-tips/ | 비교·탐색 과업엔 페이저가 맞다 → 페이저를 없애는 방향 기각 |

## 선택: 시안 A + C

비교표의 결론 그대로다.

- **A 가 진단 7개 중 6개를 덮는다** — 가장 넓은 커버리지.
- **A 만 "이미 있는 답"을 쓴다** — 3열 그리드는 같은 탭 모달 푸터의 구조다.
  새 문법을 만드는 게 아니라 갈라져 있던 둘을 합치는 것이라, 표 21곳이 한 번에 바뀌는
  변경치고 위험이 가장 낮다.
- **C 의 세 건(3·4·5)은 시안과 무관한 버그**라 어느 배치를 골랐어도 나가야 했다.

### 기각

- **시안 D (데이터 양이 컨트롤 수를 정한다)** — 진단 2 를 정면으로 푸는 유일한 안이지만
  `Pagination.tsx` 의 ⛔("Do not gate the controls on `totalPages > 1`" · 오너 답변
  "pagination은 왜 없음?")와 같은 계열이다. 오너가 그 판례를 다시 열 때만 진행한다.
- **시안 E (푸터를 표 머리로)** — Airflow 탭만 바꾸면 페이저 문법이 둘에서 셋이 된다.
- **시안 B (오른쪽 한 뭉치)** — 공백이 사라지지 않고 왼쪽으로 옮겨 갈 뿐이고,
  진단 6 도 그대로다.

## 바뀐 것

| 항목 | 전 | 후 | 출처 |
|---|---|---|---|
| 배치 | `flex` + 가운데 `flex-1` | `grid-cols-[1fr_auto_1fr]` | 논리 DB 모달 푸터 |
| 칸 | 표시 / 범위 / (공백) / 페이저 | 범위 / 페이저 / 페이지당 | 〃 |
| 좌우 여백 | 14px | **18px** | ConsoleTable 셀 gutter |
| 컨트롤 높이 (md) | 셀렉트 26 · 버튼 28 | **32 · 32** | `OpsPagination` |
| 컨트롤 높이 (sm) | 셀렉트 26 · 버튼 28 | **28 · 28** | design-guide "버튼=셀렉트=인풋 동일 높이" |
| 버튼 간격 | `gap-0.5` (2px) | `gap-1` (4px) | 간격 세트 |
| 셀렉트 화살표 | 커스텀 data-URI (렌더 안 됨) | **네이티브** | — |
| 낱말 | `표시 [N] 건씩` | `페이지당 [N]` | 논리 DB 모달 푸터 |
| 가장자리 컨트롤 | `‹‹ ‹ › ››` (기본) | `‹ ›` (기본, `controls="full"` 로 복원 가능) | Geist |
| 비활성 | `opacity-35` → 1.89:1 | `--pl-text-weak` → **4.85:1** | 관리자 승인 카드 라벨 (#792) |
| 색 위치 | 컴포넌트 안 hex | `lib/theme.ts` `paginationStyles` | CLAUDE.md #4 |

**팔레트는 한 값도 바뀌지 않았다.** `paginationStyles` 는 원래 리터럴을 그대로 옮겼다 —
이웃한 CSS 변수(`--pl-primary` #2563EB, `--pl-border` #E4E7EC)로 "정리"하면 표 21곳의
파랑과 테두리가 조용히 달라진다. 유일한 예외가 위 표의 비활성 색이다.

## 되돌린 결정 하나

`ConfirmedIntegrationTable.test.tsx` 에 라운드 17 의 기록이 있었다 —
"시안 A had dropped them on MUI's precedent; adopting 1006's design brings the whole
control set back". 즉 first/last 는 **한 번 빠졌다가 돌아온** 컨트롤이고, 이번이 세 번째
왕복이다. 이번엔 오너가 그 요소를 직접 보고 뺀 것이고(시안 C), 근거는 둘이다:
① 한 페이지짜리 표에서 넷 다 죽은 채 1.89:1 로 서 있었고,
② 끝 페이지는 `buildVisiblePages` 가 마지막 인덱스를 항상 그려 한 번에 닿는다.
그 근거가 무너지면 결정도 무너지므로 테스트로 박아 뒀다.

## 검증

- `tsc --noEmit` PASS
- `eslint` PASS
- `vitest run` — 310 파일 / 3,171 테스트 PASS
- 새 테스트 4건: 기본값에서 first/last 부재 · `controls="full"` 복원 ·
  끝 페이지 1클릭 도달 · 비활성이 opacity 가 아닌 색 · 셀렉트가 네이티브 화살표
