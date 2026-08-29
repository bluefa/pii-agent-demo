# ops 상세 — 크롬 세 톤을 한 면(gray-200)으로

- 날짜: 2026-08-29
- 대상: `/admin/pipelines/ops/target-sources/[targetSourceId]` (아홉 탭 전부)
- 아티팩트: <https://claude.ai/code/artifact/312ab17b-87df-4ce5-a38a-77b680835010> (바닥 후보 10)
  · <https://claude.ai/code/artifact/f69705d2-f7af-47d8-953e-fae1fee6ec64> (적용 시안)

## 문제

오너 지시(2026-08-28): *"현재는 디자인적으로 헤더, 본문이 구분이 그렇게 크게 되지 않아요.
어떤식으로든 색상으로라도 구분이 되어야합니다. 이건 타협할 부분이 아닙니다."*

브라우저 실측(뷰포트 1900×1052, 8px 격자로 칠해진 면적 집계):

| 근거 | 값 | 등급 |
|---|---|---|
| 마스트헤드 워시 `#F2F4F7` ↔ 본문 캔버스 `#F4F4FB` | **1.006:1** (ΔE00 2.46 이 유일한 분리자) | 수치 |
| 「진행 상태」 탭의 흰색 면적 | **73.0%** · 캔버스 23.7% · 나머지 전부 3.3% | 수치 |
| 가장 센 잉크 ÷ 첫 면 단차 | **16.1** (`#101828` 17.7:1 ÷ 1.102) | 수치 |
| 크롬 톤 수 | 셋 (워시 · 캔버스 · 흰 카드) | UX 원칙 |

즉 헤더와 본문은 **갈라진 적이 없었다.** 그리고 면 단차보다 16배 큰 잉크가 같은 화면에서
계속 울려서, 있는 단차마저 묻혔다.

## 레퍼런스 (전부 브라우저에서 직접 실측)

| 제품 | 잰 것 | 값 |
|---|---|---|
| [Backstage 데모](https://demo.backstage.io/catalog/default/Group/team-a/todo) 다크 | 잉크 ÷ 단차 | 10.1 ÷ 1.26 = **8.0** |
| 같은 페이지 라이트 | 잉크 ÷ 단차 | 21.0 ÷ 1.09 = **19.3** ← 우리보다 나쁘다 |
| [Cloudscape 상세+탭](https://cloudscape.design/examples/react/details-tabs.html) | 밝은 면 | 흰 50.1% / `#FCFCFD` 35.5% |
| [Ant Design Pro](https://preview.pro.ant.design/dashboard/analysis) | 밝은 면 | 흰 65.8% / 캔버스 27.2% |
| [GitHub](https://github.com/vercel/next.js/pulse) | 토큰 | `bgColor-default` / `muted` / `inset` 3단 |
| [Carbon](https://carbondesignsystem.com/elements/color/usage/) | 층 모델 | `background` → `layer-01/02/03`, 밝은 테마는 흰색↔Gray 10 교대 |
| [Atlassian](https://atlassian.design/foundations/elevation) | 규칙 | sunken 은 기본 면 위에서만, raised 는 한 화면에 한 구역 |
| [Primer](https://primer.style/foundations/primitives/color) | 토큰 | `muted`·`inset` 이 **같은 값**, 뜻만 다름 |

**반증이 결론을 바꿨다.** Backstage 라이트가 우리보다 나쁘다는 것은, 좋아 보였던 것이
그 제품의 색이 아니라 **비율**이라는 뜻이다. 그리고 업계 캔버스는 전부 1.04~1.12 구간이라
**바닥만으로 목표에 닿는 제품이 없다** — 다들 잉크에서 벌거나 애초에 다크다.

## 고른 것

**바닥 = `--pl-gray-200` `#E4E7EC`** (오너 선택). 마스트헤드는 제 워시를 버리고 같은 면에 선다.

- 흰 카드 ↔ 바닥 = **1.240** (Backstage 다크의 1.26 과 같은 자리)
- 크롬 톤 셋 → **둘**
- 새 색 **0개** — 이미 있는 토큰이다

⚠️ `--pl-gray-200` 은 `--pl-border` 와 **같은 값**이다. 그래서 바닥 위의 `--pl-border` 획은
1.000 으로 사라진다 — `MonitoringEvidenceBody` 의 구분선이 그 사례이고, `--pl-border-strong`
으로 올렸다. 바닥 위에 새 획을 그을 때 이 충돌을 먼저 확인해야 한다.

## 바닥 위에 **직접 서는** 잉크는 한 칸씩 내려갔다

바닥이 한 칸 어두워지면 그 위의 잉크도 한 칸 내려간다. 카드 안(흰 면 위)은 건드리지 않았다.

| 자리 | 전 | 후 | 바닥 위 |
|---|---|---|---|
| 경로 줄 · 구분자 · 링크 · 종류 | `--pl-text-weak` (4.01, AA 실패) | `--pl-gray-600` | 6.20 |
| 경로 식별자 · 활성 탭 · fmLink · 근거 줄 링크 | `--pl-primary` (4.17, AA 실패) | `--pl-primary-hover` | 5.41 |
| fmCopy · verdictSub · Airflow 머리/메타 · counts | `--pl-text-weak` | `--pl-gray-600` | 6.20 |
| 마스트헤드 스켈레톤 | `gray-200` (바닥과 동일) | `gray-300` | 1.19 |
| 근거 줄 구분선 | `--pl-border` (바닥과 동일) | `--pl-border-strong` | 1.19 |

**기각 판례 하나가 만료됐다.** `ops-tab-band.md` 는 밴드를 "그 위에서 `--pl-primary` 가
4.17 로 AA 실패"라며 기각했다. 이제 그 4.17 이 이 화면의 사실이다 — 죽은 것은 띠가 아니라
**파란 잉크**였다. GitHub 의 `UnderlineNav` 도 활성·비활성이 같은 잉크를 쓰고 굵기와 2px
표시자로만 가른다.

## 검증

- `lib/design-guard.test.ts` — ops 짝 25개를 새 바닥으로 재조준. 두 짝(`fmLink`·`fmCopy`)이
  **빨갛게 잡혔고**, 그게 이 변경에서 눈으로는 못 봤을 회귀였다.
- 전체 스위트 3511개 통과 · `tsc --noEmit` 통과
- 브라우저 실측: 아홉 탭 전부에서 (1) AA 미만 글자 (2) 제 바닥과 같은 칠 (3) 제 면과 같은
  획 — 셋 다 **0건**. 이 사이클에서 잡은 것: Airflow 탭의 머리·메타·근거 줄, 확정 정보의
  판정 부속 줄, 근거 줄 구분선, 근거 줄 링크.

## 남은 것 (이 PR 범위 밖)

- `--pl-text-faint` `#98A2B3` 가 흰 면·gray-50·gray-100 위에서 2.34~2.58 — **선존 문제**다.
  이 변경이 건드리지 않은 면들이고, 별건으로 다뤄야 한다.
- 잉크 천장(`--pl-text-strong` `#101828` 17.7:1)은 그대로다. 그걸 한 칸 내리면 비율이
  16.1 → 8.4 로 떨어지지만 전역 토큰이라 이 PR의 범위가 아니다.
- 아홉 탭을 여섯으로 줄이는 배치 건은 별도 (아티팩트 `64877a68`).
