# Airflow 확인 탭 표면 3종 — 벤치마크 결정 기록

- 날짜: 2026-09-02
- 대상 화면: `/admin/pipelines/ops/target-sources/{id}?tab=airflow` — 리소스별 최근 7일 DAG 표
  (`AgentDagTable`) · 논리 DB 최근 7일 현황 패널(`DbWeeklyBoard`) · DAG 상세 모달의 주소 행
  (`DagDetailModal`)
- 아티팩트: https://claude.ai/code/artifact/1bfc2144-2621-469e-9bdd-4f997fe0d548
- 구현 PR: #870
- 선행 기록: `dag-board-surface-panel.md` (패널 표면 이동 · 범례 · DAG 셀 문구)

## 문제 요약 (증거 등급)

아티팩트의 P1–P18 가운데 시안 A·C·E 가 푸는 것만 적는다.

| # | 문제 | 등급 | 푸는 시안 |
|---|------|------|-----------|
| P1 | 리소스 5개 이하 표에 "1–5 / 5" 페이저 바 — 바가 표보다 많은 말을 한다 | 사용자 지적 | A |
| P2 | 페이저를 걷으면 총계가 사라진다 — 표 위에 총계를 말하는 줄이 없음 | UX 원칙 (수의 주어) | A |
| P3 | 확정 전 대상(404)에서 이름·엔진·리전 세 열이 전 행 대시 — 조인이 깨진 것처럼 읽힘 | 사용자 지적 | A (문장만, 접기는 기각) |
| P4 | 행 py-5 는 두 줄 정체성 + 체크박스를 지는 Step 1 표의 값 — 한 줄 행이 빈 높이를 짐 | 제안 | A |
| P7 | 패널 머리의 "에이전트 전체 N개" — 같은 수를 아래 '전체' 칩과 푸터가 이미 셈 | 사용자 지적 | C |
| P8 | 패널만 열고 보면 무엇을 언제 봤는지(최근 7일 · 조회 시각)를 알 수 없음 — 탭 머리에만 있음 | UX 원칙 (맥락 상실) | C |
| P9 | 범례가 툴바 우측 — 조작 줄에 설명이 섞임. Grafana 를 잘못 읽은 배치 | 리서치 정정 | C |
| P10 | 스트립 열과 판정 열이 둘 다 '최근 7일' | 사용자 지적 | C |
| P11 | 한 페이지짜리 필터에서도 pager 와 페이지 크기 셀렉트가 서 있음(`always`) | 제안 | C |
| P12 | dagName null 행의 "실행 기록 없음" — 없는 것은 기록이 아니라 DAG | 사용자 지적 | C·E |
| P14 | 모달 주소 행이 URL 원문 + 복사 단추 — 관리자가 주소를 읽을 일이 없고 열 일만 있음 | 사용자 지적 | E |
| P15 | 빈 주소와 조회 실패가 같은 문장("DAG 주소 확인 불가")에 접힘 — 재시도 유무만 다름 | UX 원칙 (실패≠빈 결과) | E |
| P16 | 이름도 주소도 없는 행(미생성)에 "확인 불가" — 없는 것을 못 확인한 것처럼 말함 | 사용자 지적 | E |
| P17 | 열 수 있을 때만 푸터 CTA 가 나타나 모달 높이가 상태마다 뜀 | UX 원칙 (자리 보존) | E (CTA 자체를 제거, 오너 09-03) |
| P18 | wire 이름("DAG 주소")이 UI 문구에 섞임 | 규칙 (계약 어휘 금지) | E |

## 실제 차용한 레퍼런스

표 · 페이저 (시안 A):

- Cloudscape Table — "5개 이하면 페이지네이션 없음"(pagination 가이드의 문턱):
  https://cloudscape.design/components/table/ ·
  https://cloudscape.design/components/pagination/
- Cloudscape Empty states — 없는 값은 빈 열이 아니라 한 문장으로 설명:
  https://cloudscape.design/patterns/general/empty-states/
- GitLab Pajamas Pagination — 한 페이지면 pager 를 그리지 않는다:
  https://design.gitlab.com/components/pagination
- Carbon Data table — 표 위의 총계/제목 줄(table title + description), 페이저는 표 아래:
  https://carbondesignsystem.com/components/data-table/usage/
- 앱 내부 라운드 15 R15-3 — 카운트 문법(12px 라벨 + 14px 굵은 수, `opsStyles.tcBand.counts`)

패널 (시안 C):

- Datadog Log side panel — context(검색·필터·범위) / content(표) 두 층:
  https://docs.datadoghq.com/logs/explorer/side_panel/
- Cloudscape Split panel — 제목 안의 배지(heading + badge), 푸터는 한 가지만:
  https://cloudscape.design/components/split-panel/
- GitLab Pajamas Drawer — 머리(제목·닫기)와 본문의 분리:
  https://design.gitlab.com/components/drawer
- Grafana Status history — 범례 자리는 **Bottom / Right** 뿐(툴바에는 없다). 08-20 의
  "툴바 우측" 배치는 이 문서를 잘못 읽은 것:
  https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/status-history/
- GitHub contribution graph — 격자 **아래** 모서리의 "Less … More" 범례(기억 기반)

모달 주소 행 (시안 E):

- Google Cloud Composer "Access the Airflow web interface" — 콘솔은 주소를 보여 주지
  않고 "Open Airflow UI" 링크만 준다:
  https://cloud.google.com/composer/docs/composer-2/access-airflow-web-interface
- Astronomer release notes 2021 — "Open Airflow" 단추가 배포 카드의 1급 동작:
  https://docs.astronomer.io/astro/release-notes-2021
- Google developer documentation style — link text 는 동작·목적지를 말한다("여기" 금지):
  https://developers.google.com/style/link-text
- Grafana Data links — 셀의 값 대신 여는 동작 하나:
  https://grafana.com/docs/grafana/latest/panels-visualizations/configure-data-links/
- Cloudscape Key-value pairs — 라벨/값 스택은 그대로(시안 D 미채택의 근거):
  https://cloudscape.design/components/key-value-pairs/

## 채택안과 이유

오너 채택(2026-09-02): **A · C · E**. D(모달 셸 교체 — 제목 "DAG" 를 이름으로, ✕ 추가)는
채택하지 않았다 — 모달 셸은 그대로다(제목 "DAG" · 부제 · 라벨/값 스택 · ✕ 없음).

시안 A (리소스별 DAG 표):

- 페이저는 6행부터 (Cloudscape 문턱). 5행까지는 `frameClosed` 가 표를 제 라운드로 닫는다.
- 총계는 표 **위**의 카운터 줄 `리소스 N` 이 진다 — 라운드 15 R15-3 카운트 문법 그대로라
  바로 위 논리 DB 카운트 줄과 같은 옷. 6행부터는 바가 밑에서 범위를 말하지만 그 바의 몫은
  범위라 중복이 아니다.
- **판례 충돌과 해소**: 라운드 16 "1페이지 노출 유지"는 필터가 있는 표의 판례였다 —
  필터가 목록을 한 페이지로 줄였을 때 바가 사라지면 필터가 걸렸는지 바가 말해 주지 못한다는
  이유. 이 표에는 필터가 없다(08-25 칩 폐기, 정렬만 남음). 전제가 다르므로 오너가
  2026-09-02 에 이 표에 한해 해소했다. C·E 는 판례 충돌이 없다.
- ② 조인 열 접기 — **기각** (오너 2026-09-03: "Resource Name · Resource ID · Database Type ·
  Region 은 1행이어도 표현되어야 한다"). 확정 전 대상(스냅샷 404 → 빈 index)도 클라우드 네
  정체 열 · IDC 세 정체 열이 그대로 서고 조인 칸은 대시다. 카운터 줄 오른쪽의 사유 문장은
  남는다 — 대시 세 개가 조인이 깨진 것처럼 읽히는 문제는 열이 아니라 문장이 푼다.
  `null`(조회 중·실패)에는 문장이 없다 — 모르는 것과 없다고 답한 것은 다른 사실이다.
- 행 높이는 `approvalCell` 의 py-4 그대로(py-5 덮어쓰기 제거). 로딩 스켈레톤도 같은
  높이로 따라간다.

시안 C (논리 DB 현황 패널):

- 머리 = 제목 + 스코프 배지(제목 **안**, Cloudscape split panel) + ✕. "에이전트 전체 N개"
  삭제.
- 맥락 줄 = 검색 · 판정 칩 · (우측) `최근 7일` 태그 + 조회 시각(타임존) — 탭 머리와 같은
  문법(`DagFetch.fetchedAt` 를 prop 으로 받는다). 표와의 간격은 본문 여백과 같은 mt-5.
- 열 이름: 스트립 열 `최근 7일`, 판정 열 `판정`.
- 범례는 표 아래 우측(mt-3) — Grafana 정정.
- 푸터는 한 가지만: 한 페이지면 `전체 N`, 여러 페이지면 범위 + pager + 페이지 크기.
  높이는 `min-h-[57px]` 로 두 상태가 같다(py-3×2 + 32px 버튼 + 1px 선). `always` 제거.
- DAG 셀의 null 이름은 `DAG 없음` — §10 의 이름은 Pipeline Manager 명부의 거울(PR #707)이라
  없는 것은 기록이 아니라 DAG 다.

시안 E (DAG 상세 모달의 Airflow 행):

- 라벨 `주소` → `Airflow`. 값은 4상태 — 조회 중(스켈레톤) · 생성됨(초록 점 + "DAG 생성됨"
  + "Airflow에서 열기" 링크) · 없음(회색 점 — 이름도 없으면 "DAG가 아직 생성되지 않았어요"
  + 둘째 줄, 이름은 있으면 "Airflow 주소가 없어요") · 실패(빨간 점 + "주소를 확인하지
  못했어요" + "잠시 후 다시 시도해 주세요.").
- URL 원문과 주소 복사 단추는 없다(Composer 문법). DAG 이름 복사만 남는다.
- 푸터 CTA 는 **제거** (오너 2026-09-03) — 시안은 푸터에 primary 링크/잠긴 단추를 항상
  세웠지만, 행의 링크와 같은 라벨이 한 모달에 두 번 섰다. 여는 길은 행의 링크 하나이고,
  푸터는 실패에만 `다시 시도` 하나를 든다(빈 답을 다시 물어도 답은 같다).
- `DAG 주소 확인 불가` 는 어디에도 없다 — wire 이름을 UI 문구에 싣지 않는다.
- 목: `rollup` → 빈 문자열(이름 있음, "주소 없어요"), `ivt_archive`(1583) ·
  `comment_archive`(1511) → 빈 문자열(이름 null, "아직 생성되지 않음"), `moderation`(1511)
  → 502(실패).

## 계약 미결

1. **§11 빈 주소의 모양** — 지금 목과 화면은 `200 ""` 을 "주소 없음"으로 읽는다. 업스트림이
   없는 주소를 **404** 로 답하면 그 응답은 지금 '실패' 갈래(재시도 있음)에 떨어진다. BE 가
   404 라고 확인하면 어댑터에 그 팔을 하나 더 세워 '없음' 으로 접어야 한다(재시도 없음).
2. **`dagName === null` 을 "DAG 미생성"으로 읽어도 되는가** — 근거는 §10 의 이름이 Pipeline
   Manager 명부의 거울이라는 것(PR #707). BE 가 아니라고 하면(이름이 비는 다른 경우가
   있으면) 문구는 `DAG 이름과 주소가 아직 없어요` 로 물러난다 — 사실만 말하고 원인은 말하지
   않는 문장이다. 보드의 `DAG 없음` 도 같이 재검토한다.

## 라운드 3 (2026-09-03)

오너 지시 셋 — 같은 PR 에 반영.

1. **DAG 상세 모달은 ScanDetailModal 문법으로** ("기존 모달 디자인을 따라가라, 픽셀·계층 표현
   충실히"). ModalShell 기본 폭(480) · 제목 줄 `DAG 상세` + 판정 알약 · LdbViewModal 의 메타
   줄(회색 태그 = 에이전트, mono = Database · Schema) · "최근 7일 중 **N**일 성공했어요"
   (20px primary 수 하나, 0 이면 수 없이 문장) + 스트립 · 12/500 라벨의 두 절(DAG 이름 ·
   Airflow) · 바닥은 `TimeField` 줄(마지막 성공 · 기준). 「현재 상태」 필드와 `Field` 헬퍼
   제거. 다시 시도는 실패 문장 옆 `PlButton size="sm"` — 푸터 없음. 시안 D 의 셸 교체가
   기각됐던 자리에, 형제 모달의 셸을 그대로 가져온 것이다.
2. **보드의 DAG 셀은 이름과 진입을 가른다** ("dag 상세 보기와 dagName을 구분"). 이름은 맨
   글자(mono, 접힘, title 에 전문 / `DAG 없음`), 오른쪽 끝 "상세 보기 ›" 가 유일한 단추 —
   승인 탭 GateRow(PR #783)의 옷, 셀 안이라 12px. 열 폭 200 → 240px.
3. **패널 머리는 제목/설명 두 단** ("계층 문제가 크다"). 제목 아래 `modal.desc` 값의 14px
   설명 한 줄 — `최근 7일 DAG 실행 기록 · KST · {조회 시각} 조회`. 툴바 우측의 `최근 7일`
   태그 + 시각(라운드 2 의 맥락 줄)은 걷혔다 — 툴바는 조작만 남는다.

