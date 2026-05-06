# Loading Strategy — Open Questions & Decision Checklist

> 작성일: 2026-05-01
> 상태: ADR 작성 직전 단계
> 선행 문서: [`loading-strategy-report.md`](./loading-strategy-report.md) (PR #450) — 현황 진단 + 4-Tier 제안
> 다음 산출물: 본 문서의 **C. 결정 체크리스트** 답변 → `docs/adr/014-loading-strategy.md` 초안

이 문서는 외부 리서치 (ChatGPT, 시간 임계값 / shimmer & dots 구현 / Button loading API 비교) 결과를 받은 뒤, **여전히 결정되지 않은 항목**을 ADR 작성 전에 정리한 의사결정 가이드입니다. 채팅 인터페이스에서 길게 흐른 논의를 한 번에 검토할 수 있도록 정리했습니다.

---

## 0. 리서치 핵심 Takeaway (요약)

선행 리서치 3건의 결과를 5줄로 요약하면:

1. **공개 일차자료 기준 ms threshold는 NN/g만 명시적**(0.1초/1초/10초). Toss·Linear·Vercel·Stripe·Notion·Material 3 모두 "skeleton vs spinner ms" 공식 문서 없음. 따라서 권고 임계값(150/200/400/1000ms)은 **합성 규칙**임.
2. **Shimmer/dots 구현은 transform/opacity만 애니메이션** 하면 합성 단계에서 처리 가능. base bar 크기 불변 + ::after pseudo-element를 `translate3d`로 sweep, dots는 `1ch` 고정폭 + opacity 점멸. `prefers-reduced-motion`은 CSS 레벨에서 분기.
3. **Button loading API는 Radix/Mantine/MUI에서 단일 prop + 폭 안정성 + 자동 disabled 패턴으로 수렴**. shadcn/ui는 수동 조합, Tremor·HeroUI는 prop naming 흔들림. 핵심 계약: label `opacity:0` + spinner absolute overlay → 폭 고정.
4. **검증은 trace로**: Chrome DevTools Paint flashing / Layer borders / Performance 탭 / Lighthouse "non-composited animation" 항목. "체감 부드러움"은 증거 아님.
5. **최소 표시시간(400ms hold)은 운영 합리성**이지만 어떤 일차자료도 ms를 명시하지 않음.

---

## A. ADR 작성을 막는 결정 (Blocker — 먼저 풀어야 함)

### A-1. Threshold의 합성 규칙을 우리 제품 응답 시간과 매칭 안 함 ⚠️

**문제**: 리서치는 "150/200/400ms는 합성 규칙"이라고 솔직하게 적었음. 그런데 **우리 BFF의 실제 응답 시간 분포를 모름**. 이게 빠지면 inline 150ms가 거의 모든 클릭에서 spinner를 띄울 수도, 거의 안 띄울 수도 있음.

**옵션**

- **A**: 1주일 정도 BFF 응답 시간을 mock client에 logging 박아서 p50/p90/p99 확인 후 임계값 결정
- **B**: 측정 없이 권고안 그대로 채택하고 ADR에 "측정 없이 채택" 명시

**추천**: **B**. 측정에 들어가는 시간 대비 효용이 낮고, threshold는 운영하면서 조정 가능.

---

### A-2. Toss 가이드(5초)와 ChatGPT 권고(1초)가 충돌

**문제**: 메모리의 Toss 가이드는 "**5초** 이상 progress bar"인데, ChatGPT는 "**1초** 이상 외부 progress". 5배 차이.

**옵션**

- **1초**: 외부 progress 영역이 자주 등장 → 화면이 산만해질 위험
- **5초**: 1~5초 구간은 button spinner + TextDots만 보여 사용자가 "멈춘 줄 알았다"고 느낄 위험
- **3초 절충**: NN/g 1초 + Toss 운영 관행 5초의 중간

**추천**: **3초 절충안**. 메모리 Toss 가이드를 ADR에서 amend하면서 절충점 명시. 단, 이 절충도 측정 근거가 없는 것은 동일.

---

### A-3. Button의 텍스트 변경 케이스 처리 — 권고와 우리 코드가 충돌

**문제**: ChatGPT 권고는 "label `opacity:0` + spinner absolute overlay → **폭 고정**". 그런데 우리 코드는 `'테스트 진행 중...' : '연결 테스트 수행'`처럼 **텍스트를 일부러 바꿔서 진행 상황을 알리는** 패턴이 있음 (`ConnectionTestPanel.tsx:167`).

**옵션**

- **A**: 폭 고정 우선, 텍스트 변경 금지 → 12+ 호출처 중 텍스트 바꾸던 곳들 모두 원문 유지로 마이그레이션
- **B**: `<Button loading loadingText="...">`처럼 두 번째 prop 노출 → API가 한 번에 비대해짐
- **C**: 폭 고정은 default, 텍스트 변경이 정말 필요한 곳만 caller가 children을 직접 분기 → API 1개 유지, 예외는 일관된 escape hatch

**추천**: **C**. 권고대로 단일 prop을 지키되, 1~2곳 예외는 `<Button loading><LoadingSpinner /> 진행 중...</Button>` 식으로 caller가 children을 직접 줄 때만 그렇게 동작.

---

## B. ADR을 막지는 않지만 후속에서 결정해야 할 항목

### B-1. Minimum display time(400ms hold)을 어디에 박을지

400ms hold가 합리적이라고 결정해도 위치 선택이 남음.

**옵션**

- `useApiMutation` 훅에 옵션으로 (`minDuration: 400`)
- `<Button loading>` 내부에 자동 (caller 책임 0)
- 둘 다

**현재 상태**: `ScanController`가 이미 ad-hoc `setTimeout(500)`을 사용 (`ScanPanel.tsx:59`). 이걸 표준 자리로 옮길 좋은 기회.

**추천**: **`useApiMutation`에 `minDuration` 옵션, 기본값 0**. button 자동 hold는 안 함 — 너무 짧은 액션에서 강제 hold가 사용자에게 더 거슬림.

---

### B-2. Indeterminate→determinate 승격 가능 여부 인벤토리

operation tier 권고: "가능해지면 determinate로 승격". 우리 BFF API 중 progress %를 주는 게 어디인지 정리 안 됨:

| 작업 | progress 가능? | 비고 |
|---|---|---|
| Scan | ✅ | `scanProgress` 필드 있음 |
| Connection test | ✅ | `completed/total` 계산 가능 |
| Install (자동 설치) | ❓ | 폴링하지만 % 주는지 미확인 |
| Approval 처리 | ❓ | 보통 즉시 끝남 |

**추천**: **별도 인벤토리 작업** (BFF Swagger 훑으면 30분). 결과를 ADR "결과" 섹션에 표로 첨부. 원하시면 worktree 하나 더 떼서 병렬로 진행.

---

### B-3. Route-level loading의 client/server boundary 재정리

`loading.tsx`가 의미를 가지려면 페이지 일부가 server component여야 하는데, 우리는 거의 모든 페이지가 `'use client'` + `useEffect`. 그대로면 `loading.tsx`가 거의 발화 안 됨.

**옵션**

- **A**: 작은 server shell + client 본문 split (큰 리팩터)
- **B**: `loading.tsx`는 navigation 전환 시점에만 발화하므로 그것만으로도 가치 있다고 보고 도입

**추천**: **B로 시작**. A는 별도 ADR (page architecture)로 분리. 본 ADR은 "loading.tsx 도입 + skeleton shell 디자인"만 담음.

---

### B-4. Skeleton의 surface variant 정책

`GuideCardSkeleton`은 amber 배경 위에 amber-200 skeleton을 사용 (`cardStyles.warmVariant.skeletonBar`). 신규 표준이 단일 gray-100만 정의하면 GuideCard는 다시 ad-hoc 분기가 됨.

**추천**: **`skeletonStyles.bg`를 default로, surface variant별 override를 `cardStyles.{variant}.skeletonBar` 패턴으로 유지**. 이미 GuideCard가 잘 한 패턴을 일반화.

---

### B-5. `animate-pulse` vs 신규 shimmer 마이그레이션 범위

현재 4+ 곳이 Tailwind `animate-pulse` 사용. 이건 opacity 펄싱이고, 권고 shimmer는 sweep이라 시각적으로 다름.

**옵션**

- 모두 shimmer로 통일
- pulse는 그대로 두고 shimmer는 새 컴포넌트로만 도입

**추천**: **모두 shimmer로 통일**. 두 패턴이 공존하면 "어디는 펄싱, 어디는 sweep"이 되어 일관성 깨짐.

---

### B-6. `<TextDots>`의 aria 책임 분담

ChatGPT 컴포넌트는 `<span role="status" aria-live="polite">`를 자체에 박았음. 그런데 우리가 이걸 이미 `aria-busy`가 있는 `GuideCardChrome` 안에 넣으면 live region이 중첩됨.

**추천**: **TextDots는 자체에 `role`/`aria-live`를 안 박고, caller 컨테이너가 책임**. 사용 가이드를 ADR에 명시. (또는 `announce` prop으로 노출.)

---

## C. 명확한 미확인 — 그러나 결정 안 해도 됨

- **400ms hold 자체의 ms 값**: 200~600ms 사이라면 사실상 효용 차이 없음. 400으로 박고 가면 됨.
- **Lighthouse "non-composited animation" 검증 결과**: 실제 구현 후 트레이스로 확인. ADR 사전에 답을 알 필요 없음.
- **Tremor/HeroUI prop 흔들림**: 우리는 외부 라이브러리를 쓰는 게 아니라 자체 Button을 가지므로 영향 없음.

---

## D. 결정 체크리스트 (ADR 작성 직전 7개 질문)

ADR-014 초안에 들어갈 결정. 아래 7개에 답해주시면 ADR 작성 가능.

| # | 질문 | 옵션 | 추천 | 답 |
|---|---|---|---|---|
| 1 | Threshold 채택 방식 | A: 측정 후 채택 / B: 측정 없이 채택 | **B** | ☐ |
| 2 | Operation tier 임계값 | 1초 / 3초 / 5초 | **3초** | ☐ |
| 3 | Button 텍스트 변경 케이스 | A: 금지 / B: 별 prop / C: children escape hatch | **C** | ☐ |
| 4 | Minimum display time 위치 | `useApiMutation.minDuration` (default 0) / Button 자동 hold / 둘 다 | **`useApiMutation.minDuration`, 기본 0** | ☐ |
| 5 | Route loading 범위 | A: server/client 리팩터 / B: 리팩터 없이 도입 | **B** | ☐ |
| 6 | Skeleton surface variant | 단일 gray만 / default + variant override | **default + variant override** | ☐ |
| 7 | `animate-pulse` 처리 | 그대로 둠 / 전부 shimmer로 통일 | **전부 shimmer로 통일** | ☐ |

---

## E. ADR-014 초안 구조 예고 (확정 시 채우는 형태)

위 결정이 확정되면 ADR-014가 아래 형태로 작성됩니다 (008번 ADR 포맷 준수).

```
# ADR-014: Loading 처리 전략

## 상태
승인 예정

## 맥락
- 현황 진단 (loading-strategy-report.md 인용)
- 외부 리서치 결과 (NN/g 0.1/1/10초, ChatGPT 권고 합성 규칙)
- 기존 Toss 메모리 가이드와의 충돌점

## 결정
### 4-Tier 표준
- L1 Inline / L2 Local / L3 Operation / L4 Route
- 각 tier의 threshold (위 D-1, D-2 결정 반영)

### Button loading API
- 단일 `loading` prop
- 폭 고정: label opacity:0 + spinner absolute overlay
- 텍스트 변경: children escape hatch (D-3)
- aria-busy 자동 부여

### Minimum display time
- useApiMutation.minDuration 옵션, default 0 (D-4)

### 컴포넌트 인벤토리
- <Button loading>, <Skeleton>, <SkeletonRow>, <TextDots>, <ProgressBar>
- 색·모션 토큰 (skeletonStyles, motion keyframes)

### Route loading
- app/integration/admin/loading.tsx
- app/integration/target-sources/[targetSourceId]/loading.tsx
- (D-5에 따라 server/client 리팩터는 별 ADR로 분리)

## 결과
- DESIGN.md loading: / motion: 토큰 추가
- lib/theme.ts skeletonStyles 추가
- 12+ 호출처 마이그레이션 PR 분리
- BFF progress 인벤토리 (B-2 후속)
- 검증 계획 (Chrome DevTools Paint flashing + Lighthouse)

## 관련 문서
- docs/reports/loading-strategy-report.md
- docs/reports/loading-strategy-open-questions.md (본 문서)
- memory/toss-design-research.md (amended)
```

---

## F. 다음 단계

1. **본 체크리스트의 D 표 작성** — 7개 결정 답변
2. (선택) **B-2 BFF progress 인벤토리** 병렬 작업 — 30분 별 worktree
3. 답변 받으면:
   - `docs/adr/014-loading-strategy.md` 초안 작성
   - `memory/toss-design-research.md` amend (3초 임계값 등)
   - DESIGN.md `loading:` / `motion:` 토큰 섹션 추가
4. 마이그레이션 PR 분리:
   - PR-1: 토큰 + 표준 컴포넌트 (`<Button loading>`, `<Skeleton>`, `<TextDots>`, `<ProgressBar>`) 도입
   - PR-2: 12+ 호출처 마이그레이션
   - PR-3: route-level `loading.tsx` 도입
   - PR-4: anti-pattern 정리 (raw hex, 6개 ad-hoc spinner SVG)
