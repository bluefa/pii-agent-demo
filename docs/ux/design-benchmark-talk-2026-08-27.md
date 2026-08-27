# 디자인 스터디 발표 — 범용 스킬에서 레퍼런스 벤치마크로 (2026-08-27)

> 작성 2026-08-27 (발표 기록, decision-record 형식)
> 발표 흐름: 1) 범용 디자인 스킬로 수정 요청 → 잘 안 됨 2) `design-benchmark` 스킬로 레퍼런스 수집에 집중 3) 개선안 Before/After

## 아티팩트

| 항목 | 위치 |
|---|---|
| 슬라이드 14장 | https://claude.ai/code/artifact/2d9ac978-937a-43ac-8892-ea68dcf0cbeb |
| 원본 HTML | `design/talks/design-benchmark-talk-2026-08-27.html` (← → 키 또는 클릭으로 넘김, 캡처 JPEG 임베드) |

## 1) 범용 디자인 스킬 — 규칙은 맞는데 화면은 아니었다

`ui-ux-pro-max` 등 범용 스킬에 수정을 맡긴 흔적. 파일:줄은 repo 기준 그대로 인용.

| 근거 | 내용 |
|---|---|
| PR #540 (`5c53b88a`, 2026-07-06) | 스킬 설치. `.cjs` 추가로 repo ESLint 파손 → #541로 수습 |
| `docs/ux/step-flow-ux-improvement-report.md:5`, `:217-229`, `:231-232` | 스킬 규칙을 1:1 매핑해 PR #563 (`768dda32`) — 통합 헤더 카드·스텝퍼·CardActionBar. 스킬 기본 처방은 마케팅 랜딩 퍼널 전제라 취사 적용만 가능 |
| `docs/redesign/step2-review-session-log.md:86-87`, `docs/redesign/step2-approval-waiting.md:163-175` | "/ui-ux-pro-max로 개선할 부분 있으면 말해봐" → 자기 회귀 4건 (2.01:1 / 3.04:1 / 3.68:1), 요청 54회 |
| `docs/ux/benchmark/target-source-header.md:13-16`, `:43-48` | 통합 헤더 카드 기각 — "5/5 디자인 시스템이 헤더를 카드로 만들지 않고 스텝퍼를 헤더 카드에 두는 곳 0곳". 워시 대비 회귀 |
| `docs/ux/benchmark/pipeline-detail.md:11-14` | R18~R23 라운드를 거친 화면이 "실패까지 3클릭 · 대비 2.6:1 · 타입 램프 SSOT 모순" |
| `docs/ux/benchmark/tc-card-round3.md:41` | pro-max 규칙 C-1 명시 폐기 |

요약: 규칙 목록은 틀리지 않았지만, 이 제품의 화면(운영 콘솔·단계형 연동 흐름)에 맞는 레퍼런스가 없어서 수정 요청이 자기 회귀로 끝났다.

## 2) design-benchmark — 레퍼런스 수집에 집중

스킬: `.claude/skills/design-benchmark/SKILL.md` (#658). 결정 기록은 `docs/ux/benchmark/*.md` 46건.

| 단계 | 산출물 |
|---|---|
| 진단 | 문제 목록 + 근거 등급 (`수치 위반` / `UX 원칙` / `제안`) |
| 레퍼런스 13 | URL + 검증 표기 (`확인함` / `기억 기반`), 캡처 대신 HTML 재구성 |
| 시안 5 | 방향별 시안 |
| 비교표 | 문제 커버리지 × 구현 비용 × 기존 화면 일관성 |

발표에서 든 레퍼런스: Microsoft Defender for Cloud 권고 · GitHub Actions 패널 · Linear Triage.

## 3) Before → After

- Before = `6a21eb44` (#658 커밋, 벤치마크 도입 직전 상태). 확정 정보 표만 `7f6b49b6`.
- After = main `3a0ac1e1`.
- 공통: mock 모드, 뷰포트 1512×950 @2x.

| 화면 | 라우트 | 벤치마크 문서 | PR |
|---|---|---|---|
| 설치 헤더 + Step4 그룹 레일 | `/pass/target-sources/1008` | `target-source-header.md`, `target-source-layout.md`, `step4-grouped-rail.md` | #627 #747 #659 |
| Admin 파이프라인 상세 (FAILED) | `/pass/admin/pipelines/131` | `pipeline-detail.md`, `pipeline-detail-header.md` | #662 #667 |
| Admin 운영 알림 | `/pass/admin/pipelines/ops/alerts` | `ops-alerts-worklist.md` | #733 |
| 확정 정보 표 | `/pass/target-sources/1012` | `target-source-resource-table-console.md` | #749 |
| Step5 연결 테스트 | `/pass/target-sources/1010` | `tc-card-round3.md`, `tc-card-surface.md` | #714 #746 |

벤치마크 문서 경로는 모두 `docs/ux/benchmark/` 아래.

## 슬라이드 목록 (14장)

1. 커버
2. 1) 규칙은 맞는데 화면은 아니었다
3. 1) 자기 회귀 수치
4. 2) design-benchmark 4단계
5. 2) 레퍼런스 — Microsoft Defender for Cloud
6. 2) 레퍼런스 — GitHub Actions
7. 2) 레퍼런스 — Linear Triage
8. 2) 시안 비교표
9–13. 3) Before → After 5장 (위 표 순서)
14. 정리

## 재현 방법

Before 캡처는 detached worktree에서 뜬 옛 커밋을 그대로 찍었다.

```bash
git worktree add --detach <path> 6a21eb44   # 확정 정보 표는 7f6b49b6
cp .env.local <path>/.env.local             # USE_MOCK_DATA=true
cd <path> && npm ci && npm run dev -- -p 3200
```

- 캡처: Playwright headless, viewport 1512×950, `deviceScaleFactor: 2`.
- After는 main `3a0ac1e1`을 같은 방식으로 띄워 같은 라우트를 찍었다.
- 아티팩트는 저장한 HTML의 루트에 `data-theme="light"`를 박아 로컬에서 렌더했다 (뷰어 테마와 무관하게 라이트 고정).
