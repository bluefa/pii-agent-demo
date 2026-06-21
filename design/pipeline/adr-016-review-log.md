# ADR-016 리뷰 로그 (codex + opus)

> 이 세션에서 ADR-016 문서군·HTML 가이드에 대해 받은 codex(gpt-5.5, xhigh)·opus 리뷰의 통합 정리.
> 정본 변경 이력은 [decision-history.md](./decision-history.md), 본 파일은 **리뷰 점수·findings·해소 추적** 전용.
> 최신순으로 위에서부터 읽으면 된다.

---

## 0. 최종 상태 (2026-06-21)

| 산출물 | 최신 점수 | 판정 |
|---|---|---|
| **HTML 가이드** (`adr-016-guide.html`) | **codex 94 / opus 95** | ✅ 정확·완결·사용 가능한 단독 explainer, 회귀 0 (확인 리뷰의 잔여 1건도 후속 수정 완료) |
| **HTML 빌드 스펙** (`adr-016-html-spec.md`) | opus 93 readiness / codex 86→해소 | ✅ build-ready |
| **ADR 문서군** (rename 후) | codex 89 / opus 92 | ✅ N/M/K rename 회귀 0 |

**확정 사실**: 정확성/설계 회귀 0. RLE · CANCELLING precedence · 단일 writer · dispatch 5단계 · backpressure cadence · errorCode 3분류 · HANDLER_NOT_FOUND synthetic 행 · fail-count 회계 · Definition/snapshot — 전 라운드에서 무손상 확인.

---

## 1. 점수 추이

```
[ADR rename]   codex 88→89 (+1) · opus 93→92 (−1, noise)   → 회귀 없음
[스펙 md]      v1: codex 70 / opus(섹션) 86 / opus(용어) 78
               v2 readiness: opus 93(ready) / codex 86(blocker 해소)
[HTML]         빌드: codex 84 / opus 92
               확인: codex 94 / opus 95  (+ 잔여 "요구사항 subset" 후속 해소)
```

---

## 2. HTML 확인 리뷰 (최신) — codex 94 / opus 95

**대상**: `adr-016-guide.html` (빌드 리뷰 수정본). **VERDICT 둘 다 긍정** (opus "yes", codex는 요구사항 표만 NOT FIXED로 지적 → 후속 해소).

### 확인된 수정 (FIXED)
- 인덱스 "6종→7종" · fail-count 행 라벨(EXECUTION_TIMEOUT/JOB_FAILED는 RUNNING) · HANDLER_NOT_FOUND synthetic 행 전 필드 · external_handle 한정(task_check는 유지) · fail_count 글로서리 정밀화 · task.started_at 규칙 + 타임스탬프 글로서리 · 설정표 보강 · 모바일 메뉴 CSS 순서 · stray `</p>` · a11y(aria-expanded·Escape 드로어·터치 바깥탭).
- **codex JSDOM 실측**: menu 토글·aria-expanded·Escape·바깥탭·툴팁 포커스 전부 정상 동작 확인.

### 잔여 → 후속 해소
- **codex**: 요구사항 표가 subset(FR-6·NFR-8·PR-2~7 누락) → **전체 FR-1~8/NFR-1~8/PR-1~7로 완성**(3 캡션 테이블).
- opus: pill 툴팁 미연결(optional) · 글로서리 50개 미인라인링크(정상 — 사전이 인라인 집합보다 큼). → optional, 미적용.

### opus가 codex 오판으로 판정 ("고치지 말 것")
- HANDLER_NOT_FOUND synthetic 필드 · workerPoolSize "IM 보호/배포전용" — 둘 다 정본(state-machine·orchestrator·ADR) 그대로라 정확.

---

## 3. HTML 빌드 리뷰 — codex 84 / opus 92

**대상**: 최초 빌드본. 모든 항목 후속 수정됨(§2 참조).

### codex (84) 주요 findings
- fail-count 행 라벨 오류 · 인덱스 6→7 · HANDLER 행 불완전 · external_handle 모호 · fail_count 글로서리 광의 · task.started_at 누락 · 설정표 얕음 · 요구사항 subset · **모바일 메뉴 CSS 버그**(`.util .menu{display:none}`이 media query 뒤라 override) · **stray `</p>`** · a11y 갭.

### opus (92) 주요 findings
- 인덱스 6→7(유일 hard error) · task.started_at 누락(리뷰축 명시) · 요구사항 9/23행 · 인쇄 시 용어 밑줄 소실 · ~80 스펙 글로서리 용어 드롭(soft) · pill 미링크(optional).
- **정확성 전 축 PASS**로 명시 확인: RLE·CANCELLING·단일 writer·dispatch 5단계·backpressure·errorCode·HANDLER·fail-count·M/N/K·started_at·DISPATCHING span·23505 계약.
- 툴팁 단일출처(글로서리 dd 직독) 구조 정확성 확인.

---

## 4. 스펙 md readiness 리뷰 — opus 93 / codex 86

**대상**: `adr-016-html-spec.md` v2. opus "READY", codex "거의 — 정확성 4건 먼저 고치라" → 전부 수정 후 빌드.

### codex (86) 정확성 지적 → 수정
1. fail-count 매트릭스 "취소 정리=미가산" 불완전 → drain 중 실제 실패는 가산(pipeline은 CANCELLED 수렴).
2. `task.started_at` = READY→DISPATCHING/WAITING(BLOCKED→READY 아님).
3. `DISPATCHING` = 다음 tick RUNNING 전까지(response 적재돼도 승격은 다음 tick).
4. `definition_version` 제거는 pipeline 컬럼만(snapshot 필드 유지).
+ 누락 용어(legacy D1~D13·circuit breaker 상태·canary·WORKER_RECOVERED·C-budget·cancel_requested_at·1.1~3.4 라벨·derived PENDING) 추가.

### opus (93) 지적 → 수정
- glossary 키 미스매치 2건: `check.kind` 미정의 → 추가 · `pending.apiresult`↔`apiresult.pending` 충돌 → 정렬.
- 구조·페다고지·정확성은 build-ready로 판정.

---

## 5. 스펙 md v1 리뷰 — codex 70 / opus(섹션) 86 / opus(용어) 78

**대상**: 최초 스펙 초안. 3 리뷰 합의 반영해 v2로 재작성.

### 합의 핵심 수정
- **구조**: 생성 계약(23505→기존 반환) 섹션 승격 · 단일 writer·deadline≠tick axiom S2 선행 · S2 결정카드를 정본 결정 1~7에 매핑 · tick 바깥 순서(task-pass→파생) · 완료관측>timeout · crash/N-pod walkthrough 승격.
- **용어 전수**: 원시 컬럼·enum 값·DTO 필드·하위결정 라벨(4a~4d·7.1~7.4·D-T1~T7 개별)·open-question ID·구현 런타임·제거/v2 용어 대량 추가(§7.15 구현·§7.16 open-question·§7.17 제거 카테고리 신설).
- **사용성**: `__term__` 표기 규약 · 동음이의 namespace 키 · 툴팁 a11y(touch·Escape·aria·no-JS) · alias 해소.

---

## 6. ADR rename 리뷰 — codex 88→89 / opus 93→92

**대상**: N/M/K → `workerPoolSize`/`slotCap`/`maxFailCount` rename 후 ADR 문서군(8개). **VERDICT 둘 다 "회귀 없음".**

### rename 결함 → 수정
- stray: `api.md` bare `M`/`K` 2건 · `impl-notes` `slot N` 1건 → 치환.
- garble: ADR `slotCap (N)(slotCap ≈ ...)` 괄호 중복 · orchestrator `slotCap(≈workerPoolSize)` 간격 → 정리.
- false positive 보존 검증: `N pod`(다중 replica)·`N개/1:N/N번 폴링`(cardinality)·`max_fail_count`(snake 컬럼) 전부 무변경.

### 정확성 회귀 = 0
- workerPoolSize(hard cap) vs slotCap(soft throttle) 구분 유지 · `slotCap × maxFailCount`는 sizing(상한 아님) 유지 · 전 fragile 개념 무손상.

---

## 7. 검토 방법론 메모

- **리뷰 도구**: codex(`codex exec -c model_reasoning_effort=xhigh`, 백그라운드) + opus 서브에이전트 병렬. codex는 한 라운드에서 JSDOM으로 JS 동작까지 실측.
- **단일 writer 규율**: 모든 정본/스펙 수정은 내가 단독 author, 리뷰만 병렬 — cross-agent 모순 방지(과거 교훈).
- **rename 같은 기계적 일괄작업**은 고정 매핑을 공유 파일로 박고 파일 분할 병렬(disjoint) → 직후 통합 리뷰가 누락 포착.
- **무결성 게이트**: 매 HTML 수정 후 dangling 글로서리 링크 0 · 태그 밸런스 · 파서 OK · (JS는) JSDOM 기능 테스트.

---

## 8. 미해소 / Optional (의도적 보류)

- HTML pill(상태 칩) 툴팁 미연결 — 두 리뷰가 optional 판정(상태명은 글로서리에 정의·도달 가능, 칩은 색으로 자명).
- 글로서리 ~50개 항목 미인라인링크 — 사전이 인라인 집합보다 큰 건 정상(전수 등재 목적).
- 인쇄 시 툴팁 정의 각주화는 미적용(용어 밑줄 cue는 유지, 글로서리 섹션이 인쇄되어 정의 도달 가능).
