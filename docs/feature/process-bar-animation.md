# ProcessBar 동적 애니메이션 구현 계획 — Toss-style Interaction Design

대상: `app/components/features/process-status/StepProgressBar.tsx`
작성일: 2026-05-07
난이도: ★★★★☆ — orchestration이 핵심. CSS transition만으로 가능하지만 timing 수식과 edge case 설계가 까다로움.

---

## 0. TL;DR

- 막대(connector)는 좌→우로 채워지고, 막대가 다음 step에 **도달하는 순간** 그 step의 색/아이콘이 변한다 (causal handoff).
- Step1→Step3 같은 점프는 단계별로 **wave-like cascade**로 흐른다. Step3→Step1 역행은 cascade가 우→좌로 뒤집힌다.
- 라이브러리 의존성 없이 CSS `transition` + `transition-delay` 수식으로 구현. 직관 동기화는 **transition-delay 수식**으로 달성.
- 새 의존성 0개, 외부 API(props) 변경 0개. surgical change.

---

## 1. 배경

### 1.1 현재 구현의 한계

`StepProgressBar`는 7단계 설치 프로세스 진행 상태를 보여주는 핵심 위젯이다. 현재:

- **Step circle**: `transition-all duration-200` 으로 색상만 짧게 전환 → OK이지만 너무 빠르고 무미건조.
- **Connector line (원과 원 사이의 막대)**: `isCompleted ? success.dot : pending.bg` 의 **이진 토글**. 채워지는(progress fill) 애니메이션이 전혀 없어 단계가 바뀌면 즉시 점프하듯 색이 바뀐다.
- **점프(Step1→Step3)**: 두 막대가 동시에 토글되어 어떤 단계가 먼저 진행되었는지 시각적 단서 없음.
- **역행(Step3→Step1)**: 마찬가지로 동시 토글, "되돌아간다"는 흐름 부재.

### 1.2 Toss-style Interaction Design 원칙

이번 구현이 추구할 원칙:

1. **인과성 (Causality)** — "막대가 step에 도착했기 때문에 step 색이 바뀐다." 두 변화가 평행하게 발생하지 않고, 하나가 다른 하나를 "유발"하는 것처럼 보여야 한다.
2. **순차성 (Sequence over Simultaneity)** — 여러 변화가 한 번에 일어나도 사용자의 시선이 따라갈 수 있도록 wave처럼 cascade.
3. **자연스러운 easing** — 선형/계단식 변화가 아닌, 물리적 감각의 곡선 (`cubic-bezier(0.22, 1, 0.36, 1)` 류).
4. **의미 있는 색 (Color as Signal)** — 색 변화가 상태 정보를 운반. 장식이 아님.
5. **micro-reward** — 체크 아이콘이 fade-in으로 살짝 등장 → "도달했다"는 작은 성취감.

### 1.3 사용자 요구사항 정리

| # | 요구 | 비고 |
|---|---|---|
| R1 | 단일 step 진행(N→N+1) 시 막대가 좌→우로 채워짐 | 가장 기본 |
| R2 | step 색이 자연스럽게 변함 | 색 단계: pending → current → completed |
| R3 | 점프(Step1→Step3) 시 중간 단계가 차례로 활성화 | wave cascade forward |
| R4 | 역행(Step3→Step1) 시 차례로 비활성화 | wave cascade backward |
| R5 | **막대가 step에 도착하는 순간 그 step 색이 변함 (Toss interaction design)** | causal handoff — 본 plan의 핵심 도전 |

---

## 2. 설계 옵션 비교

### Option A: CSS transitions + transition-delay 수식 ⭐ 권장

각 connector/circle/icon에 `transition-delay`를 정밀 계산해서 cascade를 만든다.

| 장점 | 단점 |
|---|---|
| 추가 의존성 0 | mid-flight interrupt 시 hiccup 가능 |
| 선언적 — JSX에서 timing이 한눈에 보임 | timing 수식이 까다로움 |
| `prefers-reduced-motion` 자동 대응 | 정확한 callback("막대 도착") 불가 — 수식 동기화로 시뮬레이션 |
| 메모리 누수 위험 없음 | |

### Option B: Web Animations API (WAAPI)

`element.animate(...)` 로 keyframe 기반 애니메이션 + Promise(`anim.finished`) 로 chain.

| 장점 | 단점 |
|---|---|
| `anim.finished.then(...)` 으로 정확한 chain | imperative — useEffect orchestration 필요 |
| 인터럽트 시 부드러움 (cancel/reverse 지원) | 코드량 증가 (~2x) |
| 커스텀 easing 자유도 ↑ | unmount 시 cleanup 신경 써야 함 |
| | jsdom에서 테스트 어려움 |

### Option C: requestAnimationFrame + 단일 progress driver

전체를 0..1 progress 값 하나로 통합 관리. JS에서 색/위치를 보간(interpolation).

| 장점 | 단점 |
|---|---|
| 가장 부드러움 (interrupt 완벽 처리) | 코드 복잡도 ↑↑ |
| 임의 timing function 가능 | 색 보간을 JS에서 해야 함 (Tailwind 토큰 우회) |
| | 30fps 미만 환경에서 떨림 |

### Option D: framer-motion 라이브러리

`<motion.div>` + `transition` 객체. layout 애니메이션 자동.

| 장점 | 단점 |
|---|---|
| API 직관적 | 의존성 추가 (~50KB gzipped) |
| 인터럽트 자연 | 이 단일 위젯을 위한 도입은 과함 |

### 판단

**Option A 채택**. 이유:
- 사용자 요구는 "도착 순간 색이 변한다"의 **시각적 동기화**이지, **이벤트 기반 정확한 콜백**이 아님 → 수식 동기화로 충분.
- 의존성 0, 회귀 위험 최소.
- 인터럽트 hiccup은 `STAGGER_MS = 150ms` 정도로 짧기에 실사용에서 거의 인지 불가.
- 만약 추후 인터럽트 부드러움이 이슈가 되면 Option B로 점진 마이그레이션 가능 (props 시그니처 동일).

---

## 3. 핵심 설계: Causal Handoff Timing Model

### 3.1 시간 토큰 (Animation Tokens)

```ts
// 모든 시간 단위는 ms
const STAGGER_MS         = 150;  // 단계당 cascade 지연
const FILL_DURATION_MS   = 450;  // connector 채움/빠짐 시간
const CIRCLE_DURATION_MS = 300;  // 원·라벨 색 전환 시간
const HANDOFF_OFFSET_MS  = 300;  // 막대가 다음 원에 "도착"하는 체감 지점

// Toss-style easing
const FILL_EASING   = 'cubic-bezier(0.22, 1, 0.36, 1)'; // ease-out-quart, 끝맺음 부드럽게
const CIRCLE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';   // material standard, 부드러운 가속/감속
```

#### HANDOFF_OFFSET_MS의 의미

`HANDOFF_OFFSET_MS = 300`은 connector fill의 **약 67% 진행 시점**(`300/450 ≈ 0.67`)에 다음 원의 색 전환이 시작되도록 한다. 시각적으로는:

```
t=0       막대 fill 시작
t=300     막대 약 ⅔ 진행 — 이 순간 다음 원 색 변화 시작
t=450     막대 100% 도달 — 원 색 변화는 진행 중 (약 ½)
t=600     원 색 변화 완료
```

원 변화가 막대 도달 전에 미리 시작해서 **사용자 시선을 다음 원으로 끌어당긴다.** 이 anticipation이 Toss-style의 핵심 디테일.

대안값:
- `HANDOFF_OFFSET_MS = 450` (= FILL_DURATION_MS): 막대가 정확히 100% 도달했을 때 원 변화 시작 → 더 보수적, 약간 늘어지는 느낌.
- `HANDOFF_OFFSET_MS = 200`: 더 일찍 시작 → 매우 빠릿하지만 막대-원 분리감.

**채택값: 300ms**. 시안 구현 후 미세조정.

### 3.2 방향 감지 (Direction Detection)

```ts
function findActiveIndex(items: ProgressBarStep[]): number {
  // 'current' 가 있으면 그 위치
  const currentIdx = items.findIndex(s => s.state === 'current');
  if (currentIdx >= 0) return currentIdx;
  // 없으면 마지막 'completed' 위치 (모두 완료된 케이스 — last index)
  let last = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].state === 'completed') last = i;
  }
  return last; // 모두 pending이면 -1
}

function usePrevious<T>(value: T): T {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}

const activeIndex = findActiveIndex(progressSteps);
const prevActiveIndex = usePrevious(activeIndex);
const isForward  = activeIndex > prevActiveIndex;
const isBackward = activeIndex < prevActiveIndex;
const lowerBound = Math.min(prevActiveIndex, activeIndex);
const upperBound = Math.max(prevActiveIndex, activeIndex);
```

- `usePrevious`: 첫 렌더 시 `prevActiveIndex === activeIndex` → `isForward = isBackward = false` → 모든 delay = 0 → 깜빡임 없이 final state로 그려진다.
- `customSteps` props만 들어오는 경우에도 동일하게 동작 (state 배열에서 active 위치를 도출).

### 3.3 Connector 지연 수식

connector `i` (= step `i` 와 step `i+1` 사이의 막대, `i ∈ [0, len-2]`):

```ts
function connectorDelay(i: number): number {
  const inRange = i >= lowerBound && i < upperBound;
  if (!inRange) return 0;
  return isForward
    ? (i - lowerBound) * STAGGER_MS                  // 좌→우 fill
    : (upperBound - 1 - i) * STAGGER_MS;             // 우→좌 drain
}
```

### 3.4 Step circle 지연 수식 (★ 핵심)

step circle `j` 의 색 전환 delay. 시간 0은 props 변경 시점.

```ts
function circleDelay(j: number): number {
  // 변화 범위 밖 — 즉시(=delay 0)
  if (j < lowerBound || j > upperBound) return 0;

  // forward: 시작 step (lowerBound) 은 즉시 current→completed
  if (isForward && j === lowerBound) return 0;

  // backward: 종료 step (upperBound, 즉 직전 활성) 은 즉시 current→completed (또는 그 반대)
  if (isBackward && j === upperBound) return 0;

  if (isForward) {
    // 막대 (j-1) 의 fill이 HANDOFF 지점 도달 = (j-1-lowerBound)*STAGGER + HANDOFF
    return (j - 1 - lowerBound) * STAGGER_MS + HANDOFF_OFFSET_MS;
  } else {
    // backward: 막대 (j) 가 우→좌로 빠지면서 그 위치를 떠나는 시점
    return (upperBound - 1 - j) * STAGGER_MS + HANDOFF_OFFSET_MS;
  }
}
```

### 3.5 시나리오별 timing trace

#### 시나리오 A: Step1 → Step3 (forward jump, lower=0, upper=2)

```
이벤트                                          시각 (ms)
────────────────────────────────────────────────────────
Step 0 circle: current → completed              0   → 300
Connector 0 (1↔2): 0% → 100%                    0   → 450
Step 1 circle (Step2): pending → completed      300 → 600   ◀ 막대 ⅔ 진행 시점에 시작
Connector 1 (2↔3): 0% → 100%                    150 → 600
Step 2 circle (Step3): pending → current        450 → 750   ◀ 막대 ⅔ 진행 시점에 시작

총 소요: 750ms
```

ASCII timeline:
```
t (ms)   0    150   300   450   600   750
         │     │     │     │     │     │
Step1 ●━━━━━━━━━━━━━━━━━━━━━━━━━━ (current→completed, 0..300)
       │   ↘
Conn0  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░ (fill, 0..450)
       │           ↘
Step2  ○━━━━━━━━━━━━━━━━━━━━━━━━━ (pending→completed, 300..600)
                   ↘
Conn1        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ (fill, 150..600)
                           ↘
Step3                ○━━━━━━━━━━━ (pending→current, 450..750)
```

#### 시나리오 B: Step3 → Step1 (backward, lower=0, upper=2)

```
Step 2 circle (Step3): current → pending        0   → 300
Connector 1 (2↔3): 100% → 0%                    0   → 450
Step 1 circle (Step2): completed → pending      300 → 600
Connector 0 (1↔2): 100% → 0%                    150 → 600
Step 0 circle (Step1): completed → current      450 → 750

총 소요: 750ms (대칭)
```

#### 시나리오 C: Step1 → Step2 (단일 진행, lower=0, upper=1)

```
Step 0 circle: current → completed              0   → 300
Connector 0: 0% → 100%                          0   → 450
Step 1 circle: pending → current                300 → 600

총 소요: 600ms
```

#### 시나리오 D: Step1 → Step7 (최장 점프, lower=0, upper=6)

```
총 소요: 5*150 + 300 + 300 = 1350ms ≈ 1.35초
```

수용 가능 범위. 더 짧게 하려면 `STAGGER_MS = 100`으로 조정해 1초 이내로 내릴 수 있음.

### 3.6 숫자 ↔ 체크 아이콘 crossfade

`completed` 상태에서 숫자가 사라지고 체크가 등장. 단순 swap이 아닌 crossfade로 부드럽게:

```tsx
<div className="relative w-10 h-10 ...">
  {/* Number layer */}
  <span
    className={cn(
      'absolute inset-0 flex items-center justify-center',
      'transition-opacity motion-reduce:transition-none',
      isCompleted ? 'opacity-0' : 'opacity-100'
    )}
    style={{
      transitionDuration: `${CIRCLE_DURATION_MS}ms`,
      transitionDelay: `${cDelay}ms`,
      transitionTimingFunction: CIRCLE_EASING,
    }}
  >
    {String(index + 1).padStart(2, '0')}
  </span>
  {/* Check icon layer */}
  <span
    className={cn(
      'absolute inset-0 flex items-center justify-center',
      'transition-opacity motion-reduce:transition-none',
      isCompleted ? 'opacity-100' : 'opacity-0'
    )}
    style={{
      transitionDuration: `${CIRCLE_DURATION_MS}ms`,
      transitionDelay: `${cDelay}ms`,
      transitionTimingFunction: CIRCLE_EASING,
    }}
  >
    {/* 기존 checkIcon SVG */}
  </span>
</div>
```

- 두 layer를 absolute로 겹치고 opacity만 토글 → 체크 아이콘이 뒷배경 색 위에 자연스럽게 fade-in.
- `cDelay`는 circle 색 전환과 동일 → 색과 아이콘이 같은 박자로 변함.

### 3.7 라벨 텍스트 동기화

```tsx
<span
  className={cn(
    'mt-1.5 text-xs text-center max-w-[120px] leading-tight break-words',
    'transition-colors motion-reduce:transition-none',
    isCompleted && cn(statusColors.success.textDark, 'font-medium'),
    isCurrent && cn(primaryColors.text, 'font-semibold'),
    !isCompleted && !isCurrent && statusColors.pending.text
  )}
  style={{
    transitionDuration: `${CIRCLE_DURATION_MS}ms`,
    transitionDelay: `${cDelay}ms`,
  }}
>
  {item.label}
</span>
```

---

## 4. 전체 구현 스케치

`StepProgressBar.tsx` 전체 구조를 다음과 같이 재작성:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { ProcessStatus } from '@/lib/types';
import { cn, primaryColors, statusColors } from '@/lib/theme';

// ── Animation tokens ────────────────────────────────────────────────────────
const STAGGER_MS         = 150;
const FILL_DURATION_MS   = 450;
const CIRCLE_DURATION_MS = 300;
const HANDOFF_OFFSET_MS  = 300;
const FILL_EASING   = 'cubic-bezier(0.22, 1, 0.36, 1)';
const CIRCLE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

// ── Step list (기존과 동일) ─────────────────────────────────────────────────
export const steps = [ /* ... 기존 7단계 그대로 ... */ ];

// ── Types (기존 시그니처 보존) ──────────────────────────────────────────────
export type ProgressBarStepState = 'completed' | 'current' | 'pending';
export interface ProgressBarStep {
  id: string;
  label: string;
  state: ProgressBarStepState;
}
interface StepProgressBarProps {
  currentStep?: ProcessStatus;
  customSteps?: ProgressBarStep[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function findActiveIndex(items: ProgressBarStep[]): number {
  const currentIdx = items.findIndex(s => s.state === 'current');
  if (currentIdx >= 0) return currentIdx;
  let last = -1;
  for (let i = 0; i < items.length; i++) if (items[i].state === 'completed') last = i;
  return last;
}

function usePrevious<T>(value: T): T {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}

const checkIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const toDefaultProgressSteps = (currentStep: ProcessStatus): ProgressBarStep[] =>
  steps.map((item, index) => {
    const isCompleted = currentStep > item.step;
    const isCurrent = currentStep === item.step;
    const isLast = index === steps.length - 1;
    const isCurrentComplete = isCurrent && isLast;
    return {
      id: String(item.step),
      label: item.label,
      state: isCompleted || isCurrentComplete ? 'completed' : isCurrent ? 'current' : 'pending',
    };
  });

// ── Component ───────────────────────────────────────────────────────────────
export const StepProgressBar = ({ currentStep, customSteps }: StepProgressBarProps) => {
  const progressSteps = customSteps ?? (currentStep ? toDefaultProgressSteps(currentStep) : []);
  const activeIndex = findActiveIndex(progressSteps);
  const prevActiveIndex = usePrevious(activeIndex);

  const isForward  = activeIndex > prevActiveIndex;
  const isBackward = activeIndex < prevActiveIndex;
  const lowerBound = Math.min(prevActiveIndex, activeIndex);
  const upperBound = Math.max(prevActiveIndex, activeIndex);

  const connectorDelay = (i: number): number => {
    if (i < lowerBound || i >= upperBound) return 0;
    return isForward
      ? (i - lowerBound) * STAGGER_MS
      : (upperBound - 1 - i) * STAGGER_MS;
  };

  const circleDelay = (j: number): number => {
    if (j < lowerBound || j > upperBound) return 0;
    if (isForward  && j === lowerBound) return 0;
    if (isBackward && j === upperBound) return 0;
    if (isForward) {
      return (j - 1 - lowerBound) * STAGGER_MS + HANDOFF_OFFSET_MS;
    }
    return (upperBound - 1 - j) * STAGGER_MS + HANDOFF_OFFSET_MS;
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex items-center justify-between flex-1">
        {progressSteps.map((item, index, arr) => {
          const isCompleted = item.state === 'completed';
          const isCurrent   = item.state === 'current';
          const isLast      = index === arr.length - 1;
          const cDelay      = circleDelay(index);
          const connDelay   = connectorDelay(index);

          const circleStyle = {
            transitionProperty: 'background-color, color, border-color, box-shadow',
            transitionDuration: `${CIRCLE_DURATION_MS}ms`,
            transitionDelay:    `${cDelay}ms`,
            transitionTimingFunction: CIRCLE_EASING,
          };

          return (
            <div key={item.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                {/* Circle with crossfade icon layers */}
                <div
                  className={cn(
                    'relative w-10 h-10 rounded-full flex items-center justify-center',
                    'text-xs font-semibold border-2 motion-reduce:transition-none',
                    isCompleted && cn(statusColors.success.dot, 'text-white border-transparent'),
                    isCurrent   && cn(primaryColors.bg, 'text-white border-transparent', primaryColors.haloRing),
                    !isCompleted && !isCurrent && cn(
                      statusColors.pending.bg, statusColors.pending.text,
                      'border-transparent', primaryColors.borderHoverBase, primaryColors.textHoverBase,
                    ),
                  )}
                  style={circleStyle}
                >
                  <span
                    className={cn('absolute inset-0 flex items-center justify-center transition-opacity motion-reduce:transition-none',
                      isCompleted ? 'opacity-0' : 'opacity-100')}
                    style={{ transitionDuration: `${CIRCLE_DURATION_MS}ms`, transitionDelay: `${cDelay}ms`, transitionTimingFunction: CIRCLE_EASING }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn('absolute inset-0 flex items-center justify-center transition-opacity motion-reduce:transition-none',
                      isCompleted ? 'opacity-100' : 'opacity-0')}
                    style={{ transitionDuration: `${CIRCLE_DURATION_MS}ms`, transitionDelay: `${cDelay}ms`, transitionTimingFunction: CIRCLE_EASING }}
                  >
                    {checkIcon}
                  </span>
                </div>
                {/* Label */}
                <span
                  className={cn(
                    'mt-1.5 text-xs text-center max-w-[120px] leading-tight break-words transition-colors motion-reduce:transition-none',
                    isCompleted && cn(statusColors.success.textDark, 'font-medium'),
                    isCurrent   && cn(primaryColors.text, 'font-semibold'),
                    !isCompleted && !isCurrent && statusColors.pending.text,
                  )}
                  style={{ transitionDuration: `${CIRCLE_DURATION_MS}ms`, transitionDelay: `${cDelay}ms`, transitionTimingFunction: CIRCLE_EASING }}
                >
                  {item.label}
                </span>
              </div>
              {/* Connector */}
              {!isLast && (
                <div className="flex-1 mx-1 mt-[-24px]">
                  <div className={cn('relative h-[2px] rounded-full overflow-hidden', statusColors.pending.bg)}>
                    <div
                      className={cn('absolute inset-y-0 left-0 rounded-full motion-reduce:transition-none', statusColors.success.dot)}
                      style={{
                        width: isCompleted ? '100%' : '0%',
                        transitionProperty: 'width',
                        transitionDuration: `${FILL_DURATION_MS}ms`,
                        transitionDelay:    `${connDelay}ms`,
                        transitionTimingFunction: FILL_EASING,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

## 5. Edge Case 처리

### 5.1 첫 렌더 (Initial Mount)

`prevActiveIndex === activeIndex` (usePrevious 초기값) → `isForward = isBackward = false` → 모든 delay=0, 모든 transition은 발동하지 않음 (속성이 변하지 않으므로) → final state로 정적 렌더. **깜빡임 없음.**

### 5.2 mid-flight 인터럽트

사용자가 Step1→Step3 진행 중(아직 750ms 안 지남) Step5로 다시 변경:

- React가 새 props로 re-render → `prevActiveIndex`가 useEffect로 갱신되기 전의 값(2)을 보고, `activeIndex=4` → lowerBound=2, upperBound=4.
- Step 0,1의 circle/connector는 이미 새 final state(completed)로 도착했거나 거의 도착 → CSS는 현재 값에서 새 target으로 자연 보간 (transition이 새로 시작).
- transition-delay는 새 transition에만 적용 → Step 2 circle 같은 곳은 약간의 hiccup 가능 (이전 transition이 완료되기 전 새 transition 시작).
- **수용 가능**: stagger 150ms, fill 450ms 정도라 사용자가 인지하는 어색함은 미미. 본 plan의 trade-off.

완벽한 부드러움을 원하면 Option B (WAAPI)로 마이그레이션. 본 PR scope 외.

### 5.3 prefers-reduced-motion

모든 transition 노드에 `motion-reduce:transition-none` 적용 → 즉시 final state. delay/duration은 무시되고 props 변경 즉시 반영. WCAG 2.3.3 준수.

### 5.4 customSteps 직접 주입

`GuidePreviewPanel` 등에서 `customSteps` props로 임의 state를 주입하는 경우에도 `findActiveIndex`가 'current' 또는 마지막 'completed' 위치를 도출 → 동일하게 동작. props 시그니처 변경 없음.

### 5.5 모두 pending / 모두 completed

- 모두 pending: `findActiveIndex = -1` → `prevActiveIndex = -1` → 모든 delay=0 → 정적 렌더.
- 모두 completed (마지막 step `INSTALLATION_COMPLETE` 등): 모든 connector 100%, 모든 circle 초록 → 변화 없으면 transition 미발동.

### 5.6 unmount 중 timer 누수

CSS transition은 DOM이 unmount되면 자동 정리. JS timer/interval 사용하지 않으므로 누수 없음. 만약 추후 WAAPI로 전환하면 unmount cleanup 필요.

---

## 6. 인수 기준 (Acceptance Criteria)

| # | 기준 | 검증 방법 |
|---|---|---|
| AC1 | 단일 step 진행 시 connector가 좌→우로 채워진다 (~450ms) | 수동 |
| AC2 | step circle 색이 부드럽게 전환된다 (~300ms) | 수동 |
| AC3 | 숫자 ↔ 체크 아이콘이 crossfade로 전환된다 | 수동 |
| AC4 | **막대가 다음 step에 도달하기 직전(약 ⅔ 지점)부터 그 step의 색이 변하기 시작한다** | 수동 (slow-mo 녹화로 검증) + 단위 테스트 |
| AC5 | **Step1→Step3 점프 시 connector 0이 먼저 채워지고 STAGGER_MS 뒤 connector 1이 채워진다** | 단위 테스트 (inline `transitionDelay` 검증) |
| AC6 | **Step3→Step1 역행 시 connector 1이 먼저 빠지고 STAGGER_MS 뒤 connector 0이 빠진다** | 단위 테스트 |
| AC7 | **Step1→Step3 시 step circle이 1→2→3 순서로 색이 cascade된다** | 단위 테스트 (각 circle의 `transitionDelay` 검증) |
| AC8 | 첫 렌더 시 깜빡임 없음 | 수동 |
| AC9 | `prefers-reduced-motion: reduce` 환경에서 즉시 전환 | macOS "동작 줄이기" 토글 |
| AC10 | `customSteps` props로 동일 동작 | `GuidePreviewPanel` 미리보기 |
| AC11 | Step1→Step7 (최장) 약 1.35초 이내 완료 | 수동 + 수식 검증 |
| AC12 | 기존 `ProcessStatusCard.test.tsx` 전부 통과 | `npm run test:run` |

---

## 7. 작업 단계 (Verifiable Chunks)

각 단계는 commit 단위로 분리, 각자 검증 가능.

### Step 1 — Connector fill 구조 + 토큰 추출
- connector를 두 겹(track + fill) 구조로 교체
- 상단에 animation tokens (`STAGGER_MS` 등) 정의
- inline style로 `width` 바인딩
- **검증**: dev 서버에서 단계 정적 표시 정상 + `npm run lint` 통과

### Step 2 — 단일 step 진행 fill 애니메이션
- `transition-[width]` + `FILL_DURATION_MS` + `FILL_EASING` 적용
- 단일 step 진행만 부드럽게 채움 (아직 stagger/circle 동기화 없음)
- **검증**: dev 서버에서 mock seed로 N→N+1 변경 시 자연스러운 채움 확인

### Step 3 — `usePrevious` + 방향 감지
- `findActiveIndex` 헬퍼 추가
- `usePrevious` 헬퍼 추가
- `isForward` / `isBackward` / `lowerBound` / `upperBound` 도출
- 아직 delay 적용 X
- **검증**: console.log로 forward/backward 정확 감지 확인 후 제거

### Step 4 — Connector stagger
- `connectorDelay(i)` 함수 + inline `transitionDelay` 적용
- Step1→Step3 forward, Step3→Step1 backward 시 connector cascade 동작
- **검증**: 단위 테스트로 `style.transitionDelay` 값 검증 + 시각 확인

### Step 5 — Circle 색 전환 동기화 (★)
- Circle 색 변환에 `circleDelay(j)` + `transitionProperty` + `CIRCLE_EASING` 적용
- 라벨도 동일 delay 동기화
- **검증**: Step1→Step3 시 step 1,2,3 circle이 cascade로 색 전환되는지 시각 확인 + 단위 테스트

### Step 6 — 숫자 ↔ 체크 아이콘 crossfade
- 단일 children → 두 layer (number + check) 절대 위치 + opacity 토글
- 색 전환과 동일 delay 적용
- **검증**: 시각 확인 (체크가 swap 아닌 fade-in)

### Step 7 — 접근성 / 회귀 검증
- 모든 transition 클래스에 `motion-reduce:transition-none` 추가
- macOS "동작 줄이기" 토글 ON 검증
- `npm run test:run` 전체 통과
- `GuidePreviewPanel` 미리보기 회귀 없음 확인
- **검증**: 모든 테스트 green

### Step 8 — 단위 테스트 신규 작성
- `StepProgressBar.test.tsx` 작성:
  - AC5: Step1→Step3 시 connector 0 delay=0, connector 1 delay=150
  - AC6: Step3→Step1 시 connector 0 delay=150, connector 1 delay=0
  - AC7: Step1→Step3 시 step circle delays
  - 첫 렌더 시 모든 delay=0
  - customSteps 경로 검증
- **검증**: `npm run test:run -- StepProgressBar` 통과

### Step 9 — Commit / PR
- 각 Step별 commit (rebase로 atomic 유지)
- `git fetch origin main && git rebase origin/main`
- push + PR 생성, 본문에 before/after GIF 첨부

---

## 8. 영향 범위 및 회귀 위험

### 8.1 Consumer

- `app/components/features/ProcessStatusCard.tsx` (line 98)
- `app/integration/admin/guides/components/GuidePreviewPanel.tsx` (line 109)

**시그니처 변경 0건**. 기존 props (`currentStep`, `customSteps`) 그대로 사용. 회귀 위험 낮음.

### 8.2 시각적 변화

| 영역 | 변경 |
|---|---|
| connector 막대 | binary toggle → fill 애니메이션 (450ms) |
| step circle 색 | 200ms → 300ms, 점프/역행 시 cascade |
| 숫자/체크 swap | 즉시 swap → 300ms crossfade |
| 라벨 텍스트 색 | 즉시 swap → 300ms 동기화 |
| 색상 토큰 | 변화 없음 (theme.ts 재사용) |
| 크기/간격 | 변화 없음 |

### 8.3 잠재 부작용

- **장시간 폴링 화면 (`APPLYING_APPROVED` 등)**: 상태가 자주 안 바뀌므로 transition은 props 변경 시에만 발동 → 부담 없음.
- **테스트 환경 (jsdom)**: CSS transition을 시뮬레이션하지 않음. 단위 테스트는 inline `style.transitionDelay`/`style.width` 값으로 검증 → 안정적.
- **성능**: `transition-property` 가 색/box-shadow 4개 + width 1개 → modern 브라우저에서 GPU 가속 가능, 위젯당 7개 step × 5 transition = 35개 transition. 여유.
- **Concurrent rendering (React 18+)**: `usePrevious` 의 ref 패턴은 strict mode에서도 안전. (useEffect로 갱신, render 단계에서 읽기만 함.)

---

## 9. 비-목표 (Out of Scope)

- **현재 단계 펄스/glow 애니메이션** (haloRing 위에 추가 ring) — 별도 follow-up.
- **글로벌 단일 progress 트랙** (Option B 레이아웃 재설계) — 본 plan은 connector 단위 유지.
- **framer-motion / WAAPI 도입** — Option A로 충분하다고 판단.
- **인터럽트 시 완벽한 부드러움** (RAF 기반 single-driver) — Option C, 별도 PR.
- **다른 progress 위젯 통합** (`ScanProgressBar`, `ConnectionTestPanel/ProgressBar`) — 각자 자체 애니메이션 보유, 통합은 별도 작업.
- **점프/역행 시 발생음·햅틱** (Toss-style sound effect) — 데스크탑 환경, scope 외.

---

## 10. 예상 diff 규모

| 파일 | 변경 |
|---|---|
| `StepProgressBar.tsx` | ~120라인 (기존 ~107라인 → ~180라인) |
| `StepProgressBar.test.tsx` | 신규 ~150라인 (cascade 테스트 케이스 포함) |
| 합계 | 약 270라인 (medium PR) |

---

## 11. Open Questions

1. **HANDOFF_OFFSET_MS = 300ms**: 시안 구현 후 시각 확인하며 250 / 300 / 350 비교 미세조정.
2. **STAGGER_MS = 150ms**: 점프 시 cascade 속도. 100 / 150 / 200 비교.
3. **현재 단계 강조 펄스**를 본 PR에 함께 포함할지: 기본은 별도 PR로 분리. 확인 필요.
4. **Step1→Step7 같은 극단 점프**가 실제 BFF 시나리오에서 발생하는지 — 발생한다면 `STAGGER_MS` 추가 단축 검토.
5. **easing curve 미세조정**: `cubic-bezier(0.22, 1, 0.36, 1)` vs `cubic-bezier(0.34, 1.56, 0.64, 1)` (살짝 overshoot) — Toss는 후자에 가까움. 실험 필요.

---

## 12. 참고 — Toss Interaction Design Heuristics 적용표

| 원칙 | 본 구현에서의 발현 |
|---|---|
| 인과성 | connector fill이 ⅔ 진행한 시점에 다음 circle 색 변화 시작 → "막대가 도착해서 색이 변한다"는 인지 |
| 순차성 | Step1→Step3 시 connector·circle 모두 cascade 150ms 간격 |
| 자연스러운 easing | `cubic-bezier(0.22, 1, 0.36, 1)` (fill) / `cubic-bezier(0.4, 0, 0.2, 1)` (circle) |
| 색 = 신호 | gray(pending) → blue(current) → green(completed) — 의미를 운반 |
| micro-reward | 체크 아이콘 fade-in (300ms) — "도달했다"는 순간 확인 |
| 양방향 대칭 | forward는 좌→우 cascade, backward는 우→좌 cascade |

이상의 원칙이 코드 한 줄 한 줄에 어떻게 녹아 있는지는 §3, §4 의 timing 수식과 코드 스케치 참조.
