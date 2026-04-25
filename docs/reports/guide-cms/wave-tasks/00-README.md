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
W1 Foundation (AI 독립, 디자인 무관)
├── W1-a foundation-types-registry  (types + GUIDE_NAMES + GUIDE_SLOTS + error catalog)
├── W1-b html-validator-renderer    (validateGuideHtml + renderGuideAst + tests)  ← W1-a 의존
├── W1-c api-pipeline               (mock + bff-client + route + swagger + seed + useGuide)  ← W1-a, W1-b 의존
└── W1-d drift-ci                   (drift CI + resolver 6-case tests)  ← W1-a, W1-c 의존
            │
            ├──────────────┬──────────────┐
            ▼              ▼              ▼
W4 Consumer migration   W3 Admin UI      (parallel)
├── W4-a guidecard-split    ├── W3-a page-shell + tabs + step list
└── W4-b providers-migrate  ├── W3-b editor + language tabs + save flow
   ↑ W4-a 의존              ├── W3-c preview (W4-a 의존)
                            └── W3-d confirm + error + a11y
            │
            ▼
W5 QA — 통합 테스트, a11y 스모크, drift CI green
```

## 2. 실행 순서 (sequential within wave, parallel across waves)

```
1. W0 dependency PR (사용자 승인) — 단독
2. W1-a → W1-b → W1-c → W1-d (sequential, 4 PRs)
3. (W1-d merge 후) W4-a 와 W3-a 동시 시작 (parallel)
4. W4-a → W4-b 순차
   W3-a → W3-b 순차 → (W4-a merge 후) W3-c → W3-d 순차
5. W5 QA — 모든 PR merge 후
```

## 3. 모델 효율 가이드 (Opus 4.7 MAX vs Sonnet 4.6)

각 wave-task 의 복잡도 기준 모델 추천:

| Wave | 권장 모델 | 사유 |
|---|---|---|
| **W1-a** foundation-types-registry | Sonnet 4.6 | 28 slots × 7 fields 의 데이터 입력 위주. 디자인 깊이 ↓ |
| **W1-b** html-validator-renderer | **Opus 4.7 MAX** | 보안 critical · 파싱 트리 설계 · 30+ 테스트 케이스 · AST renderer 동시 |
| **W1-c** api-pipeline | **Opus 4.7 MAX** | 10 파일 · ADR-007 경계 준수 · ProblemDetails · seed migration · drift 처리 |
| **W1-d** drift-ci | Sonnet 4.6 | 단순 테스트 추가 · 검증 유틸 호출 |
| **W3-a** page-shell | Sonnet 4.6 | 시안 기반 layout 옮기기 · Provider tabs (간단) |
| **W3-b** editor | **Opus 4.7 MAX** | Tiptap 통합 · 7-button toolbar · roving tabindex · ko/en 상태머신 · 저장 게이트 |
| **W3-c** preview | **Opus 4.7 MAX** | GuideCard 재사용 · timeline compact variant · 250ms debounce · validateGuideHtml 렌더 통합 (W4-a 후) |
| **W3-d** confirm-error-a11y | Sonnet 4.6 | useModal 적용 · 에러 컴포넌트 2종 · a11y polish |
| **W4-a** guidecard-split | **Opus 4.7 MAX** | GuideCard 분리 + AST renderer 통합 + 5 use site 사전 정리 |
| **W4-b** providers-migrate | Sonnet 4.6 | 5 페이지 단순 호출부 교체 |

→ MAX 5건 / Sonnet 5건. 병렬 가능 시 MAX 1+1, Sonnet 1+1+1 식 분산.

## 4. PR 분리 원칙

각 wave-task 는 **단일 PR 1개** 로 한다 (`/wave-task` Phase 6).
- 한 wave 안에서도 logical breakpoint 가 있으면 분리 (예: W1-c 가 너무 커지면 swagger / seed 분리 가능)
- 각 PR 평균 ~250-500 LOC, 최대 800 LOC

## 5. Spec 파일 목록

| 키 | 파일 |
|---|---|
| `W1-a` | [`W1-a-foundation-types-registry.md`](./W1-a-foundation-types-registry.md) |
| `W1-b` | [`W1-b-html-validator-renderer.md`](./W1-b-html-validator-renderer.md) |
| `W1-c` | [`W1-c-api-pipeline.md`](./W1-c-api-pipeline.md) |
| `W1-d` | [`W1-d-drift-ci.md`](./W1-d-drift-ci.md) |
| `W3-a` | [`W3-a-page-shell.md`](./W3-a-page-shell.md) |
| `W3-b` | [`W3-b-editor.md`](./W3-b-editor.md) |
| `W3-c` | [`W3-c-preview.md`](./W3-c-preview.md) |
| `W3-d` | [`W3-d-confirm-error-a11y.md`](./W3-d-confirm-error-a11y.md) |
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
