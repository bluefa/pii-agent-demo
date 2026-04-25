# Guide CMS — Wave Task Index

`/wave-task <key>` 입력으로 바로 사용할 수 있는 specs.

> **전제**: PR #372 (spec.md / implementation-plan.md / swagger / ADR-010 / design 시안) 머지 완료 후 main 기준으로 실행.

---

## 1. 의존성 그래프

```
W0 dependencies (사용자 승인 필요)
└── npm install @tiptap/* + DOM shim
            │
            ▼
W1 Foundation
├── W1-a foundation-types-registry  (types + GUIDE_NAMES + GUIDE_SLOTS + error catalog)
├── W1-b html-validator-renderer    (validateGuideHtml + renderGuideAst + tests)  ← W1-a 의존
└── W1-c api-pipeline               (mock + bff-client + route + swagger + seed + useGuide
                                     + drift CI + resolver 6-case tests — W1-d 통합)
                                     ← W1-a, W1-b 의존
            │
            ▼
W4-a guidecard-split  (split + GuideCardInvalidState + ErrorState — W3-d 일부 통합)
            │              ← W1-b, W1-c 의존
            ▼
W3 Admin UI (sequential)         W4-b providers-migrate
├── W3-a page-shell                (W3-c 머지 후 — facade 제거)
├── W3-b editor + dirty nav guard
│      (UnsavedChangesModal — W3-d 통합)
└── W3-c preview (uses GuideCardPure)

W5 QA — 통합 테스트, a11y 스모크, drift CI green
```

> **구조 변경 (2026-04-24)**: Codex 외부 리뷰 반영.
> - W1-d 는 W1-c 에 통합 (drift CI + resolver 6-case 테스트를 API pipeline 과 같은 PR 에서)
> - W3-d 는 폐지 → 3-I (UnsavedChangesModal + dirty nav guard) 는 W3-b 로, 3-J (`<ErrorState>`, `<GuideCardInvalidState>`) 는 W4-a 로, 3-K (a11y polish) 는 각 W3 wave 와 W5 로 분산
> - W4-b 는 W3-c 와 **병렬 금지** — W3-c 머지 후 순차 실행 (facade 제거가 W3-c 의존성을 깨지 않도록)

## 2. 실행 순서

```
1. W0 dependency PR (사용자 승인) — 단독
2. W1-a → W1-b → W1-c (sequential, 3 PRs)
3. (W1-c merge 후) W4-a 와 W3-a 동시 시작 (parallel)
4. W4-a 머지 후:
   - W3 track: W3-a → W3-b → W3-c (sequential, GuideCardPure 사용)
   - W4 track: W3-c 머지 이후에만 W4-b 착수 (facade 제거가 W3-c 를 깨지 않도록)
5. W5 QA — 모든 PR merge 후
```

## 3. 모델 효율 가이드 (Opus 4.7 MAX vs Sonnet 4.6)

각 wave-task 의 복잡도 기준 모델 추천:

| Wave | 권장 모델 | 사유 |
|---|---|---|
| **W1-a** foundation-types-registry | Sonnet 4.6 | 28 slots × 7 fields 의 데이터 입력 위주 |
| **W1-b** html-validator-renderer | **Opus 4.7 MAX** | 보안 critical + 파싱 트리 설계 + 30+ 테스트 케이스 + AST renderer 동시 |
| **W1-c** api-pipeline | **Opus 4.7 MAX** | API pipeline + drift CI + resolver tests 통합 (~900 LOC, 10+ 파일, ADR-007 경계, ProblemDetails, seed migration, drift 처리) |
| **W3-a** page-shell | Sonnet 4.6 | 시안 기반 layout + Provider tabs (간단) |
| **W3-b** editor | **Opus 4.7 MAX** | Tiptap + 7-button toolbar + ko/en 상태머신 + dirty nav guard + UnsavedChangesModal (~900 LOC) |
| **W3-c** preview | **Opus 4.7 MAX** | GuideCardPure 통합 + ProcessTimelineCompact + 250ms debounce + invalid state 와이어링 |
| **W4-a** guidecard-split | **Opus 4.7 MAX** | GuideCard 분리 + GuideCardInvalidState + ErrorState + 안정 contract |
| **W4-b** providers-migrate | Sonnet 4.6 | 3 페이지 (AWS/Azure/GCP) 호출부 교체 + dead code 제거 (W3-c 후) |

→ MAX 5건 / Sonnet 3건. 병렬 가능 시 MAX 1+1, Sonnet 1+1 식 분산. (이전 5/5 에서 변경)

## 4. PR 분리 원칙

각 wave-task 는 **단일 PR 1개** 로 한다 (`/wave-task` Phase 6).
- 한 wave 안에서도 logical breakpoint 가 있으면 분리 (예: W1-c 가 너무 커지면 swagger / seed 를 파생 PR 로 분리 가능)
- 각 PR 평균 ~250-500 LOC, 최대 ~900 LOC (W1-c, W3-b 예외)

## 5. Spec 파일 목록

| 키 | 파일 |
|---|---|
| `W1-a` | [`W1-a-foundation-types-registry.md`](./W1-a-foundation-types-registry.md) |
| `W1-b` | [`W1-b-html-validator-renderer.md`](./W1-b-html-validator-renderer.md) |
| `W1-c` | [`W1-c-api-pipeline.md`](./W1-c-api-pipeline.md) |
| `W3-a` | [`W3-a-page-shell.md`](./W3-a-page-shell.md) |
| `W3-b` | [`W3-b-editor.md`](./W3-b-editor.md) |
| `W3-c` | [`W3-c-preview.md`](./W3-c-preview.md) |
| `W4-a` | [`W4-a-guidecard-split.md`](./W4-a-guidecard-split.md) |
| `W4-b` | [`W4-b-providers-migrate.md`](./W4-b-providers-migrate.md) |

## 6. 공통 참조 (모든 spec 에서 reading-required)

- 본 문서: `docs/reports/guide-cms/spec.md` — 13 결정 + API 계약 + HTML 보안 + Admin UI 사양
- `docs/reports/guide-cms/implementation-plan.md` — Wave 설명
- `docs/adr/010-guide-cms-slot-registry.md` — 아키텍처 결정 근거
- `docs/swagger/guides.yaml` — OpenAPI 계약
- `design/guide-cms/components.md` — 컴포넌트 구조 (W3 specs 의 spec)
- `design/guide-cms/interactions.md` — 상호작용 (W3 specs 의 spec)
- `design/guide-cms/guide-cms.html` — 비주얼 reference (W3 specs)
- `CLAUDE.md` — ⛔ 규칙
- `docs/api/boundaries.md` — CSR/SSR pipeline (ADR-007)

## 7. 공통 PR body template (모든 wave-task PR 에 포함)

```markdown
## Summary
- Spec: `docs/reports/guide-cms/wave-tasks/<file>.md` @ <SHA>
- Wave: <key>
- 의존: <merged waves>

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — relevant tests pass
- [ ] npm run build — exit 0 (UI/route 영향 시)
- [ ] Dev smoke — wave-specific scenarios

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<없으면 "None">
```
