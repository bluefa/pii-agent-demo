# 운영 탭 줄 「현재 단계」 표시 — 벤치마크 결정 기록

- 날짜: 2026-09-11
- 대상 화면: `/admin/pipelines/ops/target-sources/{id}` — Target Source 운영 탭 줄의 「현재 단계」 표시
  (`OpsTargetView` 탭 버튼 · `opsStyles.tabStepLabel`)
- 아티팩트: https://claude.ai/code/artifact/a73248f8-0807-40bb-bc74-73bd986aa523
- 구현 PR: 이 PR
- 결정: **E안 (옅은 로젠지)**

## 경과

1. 걸린 단계의 탭 우상단에 빨간 코너 점 + 「연결 테스트」 옆 실행 상태 점(빨강·파랑) — 관리자가 두 종류의 점을 헷갈림.
2. 오너 "빨간점 다 빼" → 점 둘을 모두 걷고 탭 이름 오른쪽에 「현재 단계」 낱말 칩.
3. 중립 회색 칩 — 너무 약함(칩 면이 바닥 위 1.19:1).
4. 채운 주황 칩 + 탭 셀 옅은 주황 바닥 + 위 3px 막대 — 너무 셈.
5. 디자인 벤치마크 → **E안** 채택.

## 단계 → 탭 매핑

| ProcessStatus | 탭 |
|---|---|
| IDLE | 스캔 |
| PENDING | 연동 요청 정보 |
| CONFIRMING | 확정 정보 |
| CONFIRMED | 인프라 작업 |
| INSTALLED | 연결 테스트 |
| CONNECTED | 관리자 승인 |
| COMPLETED | 없음 |

매핑된 탭이 그려지지 않는 대상(IDC 의 스캔, SDU 의 연동 요청 정보)에서는 어느 탭에도 서지 않는다 — 다른 탭으로 옮겨 걸지 않는다.

## 진단 (증거 등급)

| # | 문제 | 등급 |
|---|------|------|
| 1 | 칩 + 셀 바닥 + 위 막대, 장치 셋이 동시에 선다 | 사용자 |
| 2 | 칩 글자 11px — 디자인 가이드 하한 12px 미만 | 수치 위반 |
| 3 | 칠한 탭 셀이 열린 탭(파랑 밑줄)과 시선을 다툰다 | UX 원칙 |
| 4 | 채운 주황은 이 콘솔에서 재확정 CTA(`warnSolid`)로 읽힌다 | UX 원칙 |
| 5 | 회색 칩 면이 바닥 위 1.19:1 — 칩이 보이지 않는다 | UX 원칙 |
| 6 | 마스트헤드 단계 알약이 이미 단계를 말한다 — 탭 줄은 "어느 탭인가"만 말하면 된다 | 제안 |

## 참고한 레퍼런스

| 이름 | URL | 가져온 것 |
|---|---|---|
| Salesforce Lightning Path | https://github.com/salesforce-ux/design-system/tree/main/ui/components/path | 현재(current)=테두리 vs 선택(selected)=채움 — 두 사실을 다른 장치로 가른다 |
| Atlassian Lozenge | https://cdn.jsdelivr.net/npm/@atlaskit/lozenge/dist/es2019/lozenge.compiled.css | subtle vs bold 강도 — 상태 표시는 subtle |
| GitHub Primer CounterLabel | https://primer.style/product/components/counter-label/ | secondary vs primary 강도 — 보조 정보는 secondary |
| GOV.UK Task list | https://design-system.service.gov.uk/components/task-list/ | 목록에서 한 항목만 표시한다 |
| Material 3 Badges | https://github.com/material-components/material-components-android/blob/master/docs/components/BadgeDrawable.md | 반면교사 — 코너 점은 알림으로 읽힌다 |

## 시안 (강도 /5)

- **C (1.5)** — 라벨 앞 10px 주황 반원 글리프 + 뒤에 12/500 회색 낱말, 칩 없음 (Carbon). 1차 회색 칩처럼 조용해질 위험, 글리프가 라벨 x 를 민다.
- **A (2)** — 면 없는 칩, 1px 주황 테두리 + 탭과 같은 `--pl-text-medium` 글자 (Atlassian subtle). E 와 칩 면만 다르다(대안). 바닥 위 주황 글자는 4.38 로 12px AA 미달이라 글자는 회색.
- **B (3)** — 마스트헤드 단계 필과 같은 흰 면·1px `--pl-text-strong`·`rounded-full` 칩. 헤더와 이어지지만 「흰 면 = 카드·만질 수 있는 값」 판례와 스치고 주황이 빠진다.
- **E (3)** — 옅은 주황 면 + 주황 테두리·글자 로젠지. 채택.
- **D (3.5)** — A 칩 + 탭 윗선 가운데 24×2px 주황 틱. 장치가 둘이 된다.

## E 를 고른 이유

- 진단 1–5 를 모두 푼다: 장치 하나, 12px, 셀은 칠하지 않음, 채운 주황 아님, 면이 바닥과 구별됨.
- 기존 토큰만 쓴다(`--pl-warn-bg` · `--pl-warn-text`), 스타일 한 줄 변경.
- 대안 A 는 칩 면만 다르다 — E 가 약하다는 판정이 나오면 그쪽으로 한 줄 되돌린다.

클래스: `inline-flex flex-none items-center whitespace-nowrap rounded border border-[var(--pl-warn-text)] bg-[var(--pl-warn-bg)] px-1.5 text-[12px] font-semibold leading-4 text-[var(--pl-warn-text)]`
(16px 줄 + 테두리 2px = 18px — 탭 줄 높이 불변)

## 실측 대비 (design-guard)

- 칩 글자 on 칩 면: 5.20:1 (AA)
- 칩 테두리 on 바닥(`--pl-gray-200`): 4.38:1 (그래픽 3:1)

## ⛔ 재제안 금지

- 빨간 코너 점
- 코너 배지
- 칠한 탭 셀 / 탭 바닥 wash
- 탭 폭 전체의 위 막대
- 채운 주황 칩
- 11px 칩
