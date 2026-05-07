# ProcessBar 동적 애니메이션 구현 계획 v2 — RAF Wave-Front Driver

대상: `app/components/features/process-status/StepProgressBar.tsx` 및 후속 generic 컴포넌트
작성일: 2026-05-08 (v2 개정)
난이도: ★★★★☆ — RAF orchestration + 색 보간 + 가변 N

---

## 0. v2 변경 요약 (vs v1)

v1(CSS transition + delay 수식)은 Codex 외부 리뷰에서 Critical 1 / Major 4 / Minor 3 결함이 발견됨. v2는 다음으로 전면 전환:

| 영역 | v1 | v2 |
|---|---|---|
| 핵심 메커니즘 | CSS `transition-delay` 수식 | **`requestAnimationFrame` 단일 wave-front driver** |
| Connector fill | `width: 0%→100%` (layout 발생) | **`transform: scaleX()` (compositor only)** |
| Circle 색 변화 | CSS color transition + 계산된 delay | **JS 색 보간 (RGB mix from interpolation `t`)** |
| Handoff 시점 | 시간 기반 `HANDOFF_OFFSET_MS=300` (≈99%) | **progress threshold 기반 `VISUAL_HANDOFF=0.98`** (≈260ms) |
| Step 개수 | 7단계 하드코딩 + `customSteps` 옵션 | **`steps` prop 필수**, 도메인은 adapter로 분리 |
| Anti-flicker | `usePrevious(activeIndex)` 비교 | **`hasMountedRef` + `useLayoutEffect` snap pattern** |
| 첫 마운트 delay 잔존 | 위험 | RAF는 끝나면 inline style 정리 |
| Inline SVG | 유지 (AP-H1 위반) | **`CheckIcon` 신규** + 아이콘 barrel |
| Reduced motion | inline `transitionProperty`로 무력화됨 | `useReducedMotion` 훅으로 RAF 미실행 + 즉시 final state |
| 가변 N 적응 | 명시 안 됨 | **distance-scaled duration**, total cap 1200ms |
| 의존성 | 0 | 0 (변경 없음) |

v2의 비용은 코드량 증가(약 ~400라인). 사용자 요구 "최대한 자연스러운 UI" 우선 원칙에 따라 수용.

---

## 1. 배경

### 1.1 현재 구현 한계 (v1 §1.1과 동일)

생략. v1 참조.

### 1.2 사용자 요구사항 (v2 갱신)

| # | 요구 | 비고 |
|---|---|---|
| R1 | 단일 step 진행(N→N+1) 시 막대가 좌→우로 자연스럽게 채워짐 | |
| R2 | step 색이 자연스럽게 변환 (pending→current→completed) | |
| R3 | 점프(Step1→Step3) 시 wave-like cascade forward | |
| R4 | 역행(Step3→Step1) 시 wave-like cascade backward | |
| R5 | **막대가 step에 도착하는 순간 그 step 색이 변함 (Toss interaction design)** | RAF로 정밀 동기화 |
| R6 | **process bar는 여러 곳에서 사용**, 1~N 단계 가변 | generic + adapter 분리 |
| R7 | **최대한 자연스러운 UI > 코드량** | RAF wave-front 채택 정당화 |
| R8 | 기존 디자인(원+라벨+커넥터 가로 레이아웃) 유지 | 시각 변화 최소 |

### 1.3 Toss-style Interaction Design 원칙 (v1 §1.2 강화)

1. **인과성 (Causality)** — wave-front position 한 값이 fill·circle·icon 모두 결정 → 진정한 causal coupling.
2. **순차성 (Sequence over Simultaneity)** — wave가 좌→우(또는 역)로 지나며 단일 시간선 위에 모든 변화가 자리잡음.
3. **자연스러운 easing** — `ease-out-quart` 류 brand-consistent 곡선.
4. **의미 있는 색 (Color as Signal)** — pending(gray) → current(primary) → completed(success).
5. **micro-reward** — circle scale `1.0 → ~1.055 → 1.0` 살짝 펄스 + check icon fade-in.
6. **N에 무관한 정체성** — easing은 step 개수와 무관하게 일정. duration만 거리에 비례.

---

## 2. 아키텍처 개요

### 2.1 두 컴포넌트로 분리

```
┌──────────────────────────────────────┐
│ ProcessProgressBar (generic)          │
│ - props: { steps, ariaLabel? }       │
│ - 모든 process bar의 단일 진실 공급원  │
│ - RAF wave-front driver 보유          │
└──────────────────────────────────────┘
            ▲
            │ wraps
            │
┌──────────────────────────────────────┐
│ InstallationProcessProgressBar (adapter)│
│ - props: { currentStep: ProcessStatus }│
│ - 7-step install map을 ProgressBarStep[]│
│   으로 변환 → ProcessProgressBar 호출  │
└──────────────────────────────────────┘
            ▲
            │ used by
            │
┌──────────────────────────────────────┐
│ ProcessStatusCard, GuidePreviewPanel  │
│ (consumer — props 시그니처 보존)       │
└──────────────────────────────────────┘
```

다른 도메인(onboarding, payment 등)도 직접 `<ProcessProgressBar steps={...} />`을 호출하면 됨.

### 2.2 파일 구조

```
app/components/features/process-status/
├── ProcessProgressBar.tsx              # generic (NEW)
├── ProcessProgressBar.test.tsx         # NEW
├── InstallationProcessProgressBar.tsx  # adapter (renamed from StepProgressBar)
├── InstallationProcessProgressBar.test.tsx
├── motion/
│   ├── stepperMotionEngine.ts          # RAF driver (NEW)
│   ├── stepperMotionEngine.test.ts     # NEW
│   ├── colorMix.ts                     # RGB 색 보간 유틸 (NEW)
│   └── easing.ts                       # easing 함수 (NEW)
└── index.ts                            # re-export

app/components/ui/icons/
├── CheckIcon.tsx                       # NEW
└── index.ts                            # add CheckIcon export

lib/hooks/
└── useReducedMotion.ts                 # NEW

lib/theme.ts                            # motion 토큰 추가 (motion.colors, motion.timing)
```

### 2.3 Public API

```tsx
// 일반 사용
<ProcessProgressBar
  steps={[
    { id: 'step1', label: '단계 1', state: 'completed' },
    { id: 'step2', label: '단계 2', state: 'current' },
    { id: 'step3', label: '단계 3', state: 'pending' },
  ]}
  ariaLabel="Onboarding progress"
/>

// 설치 도메인 (기존 코드 시그니처 유지)
<InstallationProcessProgressBar currentStep={currentStep} />
```

`customSteps`는 deprecate. `currentStep`만 받는 adapter는 유지(consumer 호환). 새 코드는 generic을 사용.

---

## 3. 시간 / 색 토큰

### 3.1 motion 토큰 (lib/theme.ts에 추가)

```ts
export const motion = {
  // 시간 (ms) — distance-scaled, 아래 §4.2 참조
  fillMsMin: 420,    // 초소형 N=2 최소
  fillMsMax: 1200,   // 최장 점프 cap
  fillMsCapAbs: 1400, // 비상 절대 한계 (디버그용)
  circleMs: 180,     // 한 개 circle 색 전환
  iconCrossfadeMs: 220,

  // Visual handoff threshold (0..1)
  visualHandoff: 0.98,

  // Easing
  fillEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',     // ease-out-quart, brand fill
  circleEasing: 'cubic-bezier(0.2, 0, 0, 1)',       // 트리거 느낌
  crossfadeEasing: 'cubic-bezier(0.33, 1, 0.68, 1)', // 잔상 없이 빠른 정리

  // 색 (hex, RGB 보간용)
  // 토큰 raw 값을 motion에서만 노출 — Tailwind 직접 사용 금지
  colors: {
    pendingBg: '#F3F4F6',  // gray-100
    currentBg: '#0064FF',  // primary
    completedBg: '#45CB85', // success
    pendingText: '#9CA3AF', // gray-400
    activeText: '#FFFFFF',
  },
} as const;
```

### 3.2 왜 RGB 보간 색을 토큰화하는가

CSS transition은 `transition-property: background-color` 만 지정하면 알아서 보간하지만, RAF 방식은 JS에서 직접 `style.backgroundColor = mix(from, to, t)` 를 설정해야 한다. 따라서 **raw hex 값**이 필요. Tailwind 클래스(`bg-[#0064FF]`)는 정적이라 사용 불가. 이 raw 값을 feature 코드에 흩어놓지 않고 `motion.colors`에 모아둠 → 변경 시 단일 지점.

---

## 4. 상세 설계

### 4.1 RAF Wave-Front Driver

핵심 아이디어: **하나의 progress 값 `front: 0..distance`** 가 좌우로 이동하며 모든 변화를 결정.

#### 4.1.1 `stepperMotionEngine.ts`

```ts
import { motion } from '@/lib/theme';
import { mixHex } from './colorMix';
import { easeOutQuart, invEaseOutQuart, easeOutCubic } from './easing';

export type StepState = 'completed' | 'current' | 'pending';

export interface MotionRun {
  fromIndex: number;      // 직전 active 인덱스 (-1 가능)
  toIndex: number;        // 현재 active 인덱스
  fromStates: StepState[]; // 직전 각 step 상태
  toStates: StepState[];   // 현재 각 step 상태
  fillRefs: Array<HTMLElement | null>;   // [0..N-2], scaleX target
  circleRefs: Array<HTMLElement | null>; // [0..N-1], background-color target
  iconNumberRefs: Array<HTMLElement | null>;  // [0..N-1], opacity target
  iconCheckRefs: Array<HTMLElement | null>;   // [0..N-1], opacity target
  onDone?: () => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const stateColor = (s: StepState): string => {
  if (s === 'completed') return motion.colors.completedBg;
  if (s === 'current')   return motion.colors.currentBg;
  return motion.colors.pendingBg;
};

const stateTextColor = (s: StepState): string => {
  if (s === 'pending') return motion.colors.pendingText;
  return motion.colors.activeText;
};

/**
 * Toss-style wave-front animation.
 * Returns a cleanup function the caller MUST invoke on unmount or new run.
 */
export const runStepperMotion = (run: MotionRun): (() => void) => {
  const {
    fromIndex, toIndex, fromStates, toStates,
    fillRefs, circleRefs, iconNumberRefs, iconCheckRefs, onDone,
  } = run;

  const dir = Math.sign(toIndex - fromIndex);
  if (dir === 0) { onDone?.(); return () => undefined; }

  // Edges actually traveled (forward: fromIndex..toIndex-1, backward: fromIndex-1..toIndex)
  const edgeCount = Math.abs(toIndex - fromIndex);
  const firstEdge = dir > 0 ? fromIndex : fromIndex - 1;
  const edges = Array.from({ length: edgeCount }, (_, k) => firstEdge + k * dir);

  // Measure each connector's actual width (layout-aware → adapts to responsive)
  const lengths = edges.map(e => {
    const fill = fillRefs[e];
    const track = fill?.parentElement;
    return track?.getBoundingClientRect().width ?? 1;
  });
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((s, n) => s + n, 0));
  const distance = lengths.reduce((s, n) => s + n, 0);

  // Distance-scaled duration with hard cap
  const baseSpeed = 1.6; // px/ms — tuned for "snappy but soft"
  const stepBonus = (edgeCount - 1) * 36;
  const duration = Math.min(
    motion.fillMsMax,
    Math.max(motion.fillMsMin, distance / baseSpeed + stepBonus),
  );

  let frame = 0;
  let cancelled = false;
  const startTime = performance.now();

  const draw = (now: number) => {
    if (cancelled) return;
    const elapsed = now - startTime;
    const t = clamp01(elapsed / duration);
    const front = easeOutQuart(t) * distance;

    edges.forEach((edge, order) => {
      const local = clamp01((front - starts[order]) / lengths[order]);

      // 1) Connector fill — transform: scaleX (compositor)
      const fill = fillRefs[edge];
      if (fill) {
        fill.style.transformOrigin = dir > 0 ? 'left center' : 'right center';
        fill.style.transform = `scaleX(${dir > 0 ? local : 1 - local})`;
      }

      // 2) Circle arrival — when wave reaches VISUAL_HANDOFF of this edge
      const handoffLocal = motion.visualHandoff;
      const handoffElapsed = invEaseOutQuart(
        (starts[order] + lengths[order] * handoffLocal) / distance,
      ) * duration;
      const circleT = easeOutCubic(clamp01((elapsed - handoffElapsed) / motion.circleMs));

      // forward: circle to update is the right end of edge (edge+1)
      // backward: circle to update is the left end of edge (edge)
      const targetCircleIdx = dir > 0 ? edge + 1 : edge;
      const fromState = fromStates[targetCircleIdx];
      const toState = toStates[targetCircleIdx];
      const circle = circleRefs[targetCircleIdx];

      if (circle && fromState !== toState) {
        circle.style.backgroundColor = mixHex(
          stateColor(fromState), stateColor(toState), circleT,
        );
        circle.style.color = mixHex(
          stateTextColor(fromState), stateTextColor(toState), circleT,
        );
        // Micro-pulse on arrival: scale up to ~1.055 then back
        const pulse = 1 + 0.055 * Math.sin(Math.PI * circleT);
        circle.style.transform = `scale(${pulse})`;
      }

      // 3) Number ↔ Check icon crossfade
      const numEl = iconNumberRefs[targetCircleIdx];
      const chkEl = iconCheckRefs[targetCircleIdx];
      const wantsCheck = toState === 'completed';
      const hadCheck = fromState === 'completed';
      if (wantsCheck !== hadCheck && numEl && chkEl) {
        const fade = clamp01((elapsed - handoffElapsed) / motion.iconCrossfadeMs);
        if (wantsCheck) {
          numEl.style.opacity = String(1 - fade);
          chkEl.style.opacity = String(fade);
        } else {
          numEl.style.opacity = String(fade);
          chkEl.style.opacity = String(1 - fade);
        }
      }
    });

    // Source step (the one we're leaving in forward, or arriving in backward)
    // also needs immediate state transition starting at t=0
    if (dir > 0 && fromStates[fromIndex] !== toStates[fromIndex]) {
      const srcCircle = circleRefs[fromIndex];
      const tail = easeOutCubic(clamp01(elapsed / motion.circleMs));
      if (srcCircle) {
        srcCircle.style.backgroundColor = mixHex(
          stateColor(fromStates[fromIndex]), stateColor(toStates[fromIndex]), tail,
        );
        srcCircle.style.color = mixHex(
          stateTextColor(fromStates[fromIndex]), stateTextColor(toStates[fromIndex]), tail,
        );
      }
      const numEl = iconNumberRefs[fromIndex];
      const chkEl = iconCheckRefs[fromIndex];
      if (numEl && chkEl &&
          (fromStates[fromIndex] === 'completed') !== (toStates[fromIndex] === 'completed')) {
        const fade = clamp01(elapsed / motion.iconCrossfadeMs);
        if (toStates[fromIndex] === 'completed') {
          numEl.style.opacity = String(1 - fade);
          chkEl.style.opacity = String(fade);
        } else {
          numEl.style.opacity = String(fade);
          chkEl.style.opacity = String(1 - fade);
        }
      }
    }

    if (elapsed < duration + motion.circleMs) {
      frame = requestAnimationFrame(draw);
    } else {
      // Snap to final state and clear inline styles so CSS hover/focus work normally
      finalize(run);
      onDone?.();
    }
  };

  frame = requestAnimationFrame(draw);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
};

const finalize = (run: MotionRun) => {
  // Apply final colors/transforms via class change (not inline) by clearing inline styles.
  // The component re-renders with toStates, which yields the correct CSS classes.
  run.circleRefs.forEach(el => {
    if (!el) return;
    el.style.backgroundColor = '';
    el.style.color = '';
    el.style.transform = '';
  });
  run.fillRefs.forEach(el => {
    if (!el) return;
    el.style.transform = '';
  });
  run.iconNumberRefs.forEach(el => { if (el) el.style.opacity = ''; });
  run.iconCheckRefs.forEach(el => { if (el) el.style.opacity = ''; });
};
```

### 4.2 Distance-scaled duration

```ts
duration = clamp(distance / 1.6 + (edgeCount - 1) * 36, fillMsMin, fillMsMax)
```

| 케이스 | distance(px, 추정) | edgeCount | duration |
|---|---|---|---|
| N=2, 단일 진행 | 200 | 1 | 200/1.6 = 125 → clamped to **420ms** (min) |
| N=7, Step1→Step2 | 100 | 1 | 100/1.6 = 63 → **420ms** |
| N=7, Step1→Step3 | 200 | 2 | 200/1.6 + 36 = 161 → **420ms** |
| N=7, Step1→Step7 | 600 | 6 | 600/1.6 + 180 = 555 → **555ms** |
| N=15, Step1→Step15 | 1400 | 14 | 1400/1.6 + 504 = 1379 → **1200ms** (max) |

총 길이가 1200ms 이내로 cap → 사용자가 답답하지 않음. min 420ms로 너무 빨라 인지 못 하는 것도 방지.

### 4.3 Visual Handoff = 0.98

`VISUAL_HANDOFF = 0.98` 의미: wave-front가 한 connector 길이의 **98% 지점**에 도달하면 그 끝의 circle이 색 전환을 시작.

ease-out-quart 곡선 위에서 progress 0.98에 도달하는 elapsed 비율은 `invEaseOutQuart(0.98) ≈ 0.526` → 약 절반 시간. 즉 fill 시작 후 **~210ms** (420ms 기준)에 circle이 반응 시작 → 이때 wave-tip은 시각적으로 거의 도착.

이는 v1의 시간 기반 300ms 보다 정확. **wave가 직접 측정한 위치**로 트리거하기 때문에 fill duration이 변해도(distance scaling) 자동으로 따라감.

### 4.4 First-mount snap pattern

```tsx
const hasMountedRef = useRef(false);

useLayoutEffect(() => {
  if (!hasMountedRef.current) {
    hasMountedRef.current = true;
    // 첫 paint: 모든 inline style 비워서 props state대로 CSS 클래스가 적용되게
    return; // RAF 없음
  }
  // 이후 props 변경 시에만 RAF 실행
  const cleanup = runStepperMotion({ ... });
  return cleanup;
}, [activeIndex, JSON.stringify(stepStates)]);
```

`useLayoutEffect` 사용 이유: paint 전에 visual state를 결정해 첫 프레임 깜빡임 방지.

`hasMountedRef`로 "첫 마운트 vs 후속 변경"을 명시적으로 구분 → 같은 인덱스 내 state 변경(예: 라벨만 바뀜)이 잘못 RAF를 트리거하지 않음.

### 4.5 Circle micro-motion (scale pulse)

```ts
const pulse = 1 + 0.055 * Math.sin(Math.PI * circleT);
circle.style.transform = `scale(${pulse})`;
```

`circleT: 0..1` 동안 scale은 `1 → 1.055 → 1` 로 sine 곡선 펄스. 시각적으로 "부풀었다 가라앉음" → wave 도착의 **micro-reward**. 너무 크면 산만하므로 5.5%로 절제.

reduced-motion에서는 pulse 비활성.

### 4.6 Number ↔ Check icon crossfade

absolute로 두 layer 겹치고, RAF가 직접 `style.opacity` 를 0..1 로 보간. 시간 축은 `motion.iconCrossfadeMs = 220ms`.

**중요**: 두 아이콘이 겹치는 동안 합 opacity가 1을 넘지 않도록 `numEl = 1 - fade` / `chkEl = fade` (또는 그 반대) 로 합이 항상 1.

### 4.7 Reduced motion

```ts
// useReducedMotion.ts
import { useEffect, useState } from 'react';

export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};
```

컴포넌트:
```tsx
const reduced = useReducedMotion();

useLayoutEffect(() => {
  if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
  if (reduced) {
    // 즉시 final state로 snap (CSS 클래스만으로 처리)
    return;
  }
  return runStepperMotion({ ... });
}, [activeIndex, ..., reduced]);
```

### 4.8 Accessibility

```tsx
<nav aria-label={ariaLabel ?? '진행 단계'}>
  <ol className="flex items-center" role="list">
    {steps.map((step, i) => (
      <li key={step.id} aria-current={step.state === 'current' ? 'step' : undefined}>
        <div ref={...} className={...}>
          {/* number layer aria-hidden, check icon role="img" with aria-label="완료" */}
        </div>
        <span>{step.label}</span>
      </li>
    ))}
  </ol>
</nav>
```

- `<nav role="list">` semantic
- `aria-current="step"` on current
- `<CheckIcon aria-hidden />` (라벨로 의미 표현하므로 decorative)
- 라벨은 항상 표시됨 → screen reader가 step 정보 충분 획득

---

## 5. 코드 스케치

### 5.1 `useReducedMotion` 훅

§4.7 참조.

### 5.2 `colorMix.ts`

```ts
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

export const mixHex = (from: string, to: string, t: number): string => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const v = a.map((n, i) => Math.round(n + (b[i] - n) * t));
  return `rgb(${v[0]} ${v[1]} ${v[2]})`;
};
```

### 5.3 `easing.ts`

```ts
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
// inverse — 주어진 visual progress y에 대응하는 elapsed time 비율
export const invEaseOutQuart = (y: number) => 1 - Math.pow(1 - y, 1 / 4);
```

### 5.4 `CheckIcon`

```tsx
import type { IconProps } from './types';

export const CheckIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
```

`app/components/ui/icons/index.ts` 에 export 추가.

### 5.5 `ProcessProgressBar` (generic)

```tsx
'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { CheckIcon } from '@/app/components/ui/icons';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { cn, primaryColors, statusColors } from '@/lib/theme';
import { runStepperMotion, type StepState } from './motion/stepperMotionEngine';

export interface ProgressBarStep {
  id: string;
  label: string;
  state: StepState;
}

interface Props {
  steps: ProgressBarStep[];
  ariaLabel?: string;
}

const findActiveIndex = (items: ProgressBarStep[]): number => {
  const cur = items.findIndex(s => s.state === 'current');
  if (cur >= 0) return cur;
  let last = -1;
  for (let i = 0; i < items.length; i++) if (items[i].state === 'completed') last = i;
  return last;
};

export const ProcessProgressBar = ({ steps, ariaLabel }: Props) => {
  const reduced = useReducedMotion();
  const activeIndex = findActiveIndex(steps);

  const fillRefs = useRef<Array<HTMLElement | null>>([]);
  const circleRefs = useRef<Array<HTMLElement | null>>([]);
  const iconNumberRefs = useRef<Array<HTMLElement | null>>([]);
  const iconCheckRefs = useRef<Array<HTMLElement | null>>([]);

  const prevSnapshotRef = useRef<{ idx: number; states: StepState[] }>({
    idx: activeIndex,
    states: steps.map(s => s.state),
  });
  const hasMountedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const currentStates = steps.map(s => s.state);

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevSnapshotRef.current = { idx: activeIndex, states: currentStates };
      return;
    }

    const prev = prevSnapshotRef.current;
    if (prev.idx === activeIndex && prev.states.every((s, i) => s === currentStates[i])) {
      return; // no semantic change
    }

    // Cancel any in-flight animation before starting new one
    cleanupRef.current?.();

    if (reduced) {
      prevSnapshotRef.current = { idx: activeIndex, states: currentStates };
      return; // CSS classes handle final state
    }

    cleanupRef.current = runStepperMotion({
      fromIndex: prev.idx,
      toIndex: activeIndex,
      fromStates: prev.states,
      toStates: currentStates,
      fillRefs: fillRefs.current,
      circleRefs: circleRefs.current,
      iconNumberRefs: iconNumberRefs.current,
      iconCheckRefs: iconCheckRefs.current,
      onDone: () => {
        cleanupRef.current = null;
      },
    });

    prevSnapshotRef.current = { idx: activeIndex, states: currentStates };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [activeIndex, steps, reduced]);

  return (
    <nav aria-label={ariaLabel ?? '진행 단계'}>
      <ol
        className="grid items-start"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        role="list"
      >
        {steps.map((step, index) => {
          const isCompleted = step.state === 'completed';
          const isCurrent   = step.state === 'current';
          const isLast      = index === steps.length - 1;
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative flex items-center"
            >
              <div className="flex flex-col items-center w-full">
                <div
                  ref={(el) => { circleRefs.current[index] = el; }}
                  className={cn(
                    'relative w-10 h-10 rounded-full flex items-center justify-center',
                    'text-xs font-semibold border-2 border-transparent',
                    isCompleted && cn(statusColors.success.dot, 'text-white'),
                    isCurrent   && cn(primaryColors.bg, 'text-white', primaryColors.haloRing),
                    !isCompleted && !isCurrent && cn(statusColors.pending.bg, statusColors.pending.text),
                  )}
                  style={{ willChange: 'transform, background-color' }}
                >
                  <span
                    ref={(el) => { iconNumberRefs.current[index] = el; }}
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ opacity: isCompleted ? 0 : 1 }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    ref={(el) => { iconCheckRefs.current[index] = el; }}
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ opacity: isCompleted ? 1 : 0 }}
                  >
                    <CheckIcon className="w-4 h-4" />
                  </span>
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-xs text-center max-w-[120px] leading-tight break-words',
                    'transition-colors duration-200 motion-reduce:transition-none',
                    isCompleted && cn(statusColors.success.textDark, 'font-medium'),
                    isCurrent   && cn(primaryColors.text, 'font-semibold'),
                    !isCompleted && !isCurrent && statusColors.pending.text,
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className="absolute top-5 left-1/2 right-[-50%] mx-5 h-[2px] -translate-y-1/2">
                  <div
                    className={cn('relative h-full rounded-full', statusColors.pending.bg)}
                  >
                    <div
                      ref={(el) => { fillRefs.current[index] = el; }}
                      className={cn('absolute inset-0 rounded-full', statusColors.success.dot)}
                      style={{
                        transform: isCompleted ? 'scaleX(1)' : 'scaleX(0)',
                        transformOrigin: 'left center',
                        willChange: 'transform',
                      }}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
```

라벨 색은 RAF 대상이 아니라 `transition-colors`로 가벼운 CSS 트랜지션 사용 (시각 동기화 부담이 작음).

### 5.6 `InstallationProcessProgressBar` (도메인 adapter)

```tsx
'use client';

import { ProcessStatus } from '@/lib/types';
import { ProcessProgressBar, type ProgressBarStep } from './ProcessProgressBar';

const INSTALL_STEPS = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 DB 선택' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '연동 대상 승인 대기' },
  { step: ProcessStatus.APPLYING_APPROVED, label: '연동 대상 반영중' },
  { step: ProcessStatus.INSTALLING, label: 'Agent 설치' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.CONNECTION_VERIFIED, label: '관리자 승인 대기' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
] as const;

const toSteps = (currentStep: ProcessStatus): ProgressBarStep[] =>
  INSTALL_STEPS.map((it, idx) => {
    const isCompleted = currentStep > it.step;
    const isCurrent = currentStep === it.step;
    const isLast = idx === INSTALL_STEPS.length - 1;
    return {
      id: String(it.step),
      label: it.label,
      state: isCompleted || (isCurrent && isLast) ? 'completed' : isCurrent ? 'current' : 'pending',
    };
  });

interface Props {
  currentStep: ProcessStatus;
}

export const InstallationProcessProgressBar = ({ currentStep }: Props) => (
  <ProcessProgressBar steps={toSteps(currentStep)} ariaLabel="설치 진행 단계" />
);
```

기존 `StepProgressBar`를 이 어댑터로 대체. `app/components/features/process-status/index.ts` 에서 alias `export const StepProgressBar = InstallationProcessProgressBar` 한 사이클(deprecation period) 유지 후 제거.

---

## 6. Edge Case 처리

| Case | 처리 |
|---|---|
| 첫 마운트 | `hasMountedRef`로 RAF skip → CSS 클래스가 final state 즉시 적용. 깜빡임 0. |
| 같은 index 내 라벨만 변경 | snapshot diff로 RAF skip. |
| Mid-flight 인터럽트 | `cleanupRef.current?.()` 호출로 이전 RAF 즉시 cancel + inline style 정리, 새 RAF 시작. |
| Component unmount | useEffect cleanup이 `cleanupRef`로 전파되어 RAF cancel. |
| `prefers-reduced-motion: reduce` | RAF 미실행 → CSS 클래스로 즉시 final state. |
| `prevIndex === -1` (모두 pending → 첫 step) | dir>0, edges 정상 계산 (firstEdge = -1 → 음수 인덱스 fillRefs[-1] = undefined → noop). circle 변화는 forward 분기에서 정상 처리. |
| `activeIndex === -1` (역행으로 모두 pending) | dir<0, 동일 메커니즘. |
| 모두 completed | activeIndex = N-1. 변화 없으면 RAF skip. |
| Tab 전환 (RAF 일시정지) | `requestAnimationFrame`은 hidden tab에서 throttling. 복귀 시 elapsed 큰 값 → t>1 즉시 final + finalize. 자연 처리. |
| ResizeObserver / 화면 회전 | `getBoundingClientRect()`는 RAF 시작 시 1회만 측정. 진행 중 리사이즈는 다음 RAF 사이클까지 visual mismatch 가능 → 수용 trade-off. 추후 필요 시 ResizeObserver로 lengths 재계산. |
| SSR | `useReducedMotion`이 `typeof window === 'undefined'` 체크. RAF는 useLayoutEffect 안에서만 실행 → SSR 안전. |

---

## 7. 인수 기준 (Acceptance Criteria)

| # | 기준 | 검증 |
|---|---|---|
| AC1 | 단일 step 진행 시 connector가 좌→우로 부드럽게 채워진다 (transform: scaleX) | 수동 |
| AC2 | step circle 색이 RGB 보간으로 부드럽게 전환된다 | 수동 |
| AC3 | 숫자 ↔ 체크 아이콘 crossfade (220ms, 합 opacity = 1) | 수동 + 단위 테스트 |
| AC4 | **막대가 connector 길이의 98%에 도달하면 다음 circle 색 전환이 시작된다** (causal handoff) | 단위 테스트 (engine math) |
| AC5 | **Step1→Step3 점프 시 wave가 좌→우로 한 번에 흐른다** (단일 RAF) | 수동 + 단위 테스트 |
| AC6 | **Step3→Step1 역행 시 wave가 우→좌로 흐르고 fill이 빠진다** | 수동 + 단위 테스트 |
| AC7 | **N=2, N=7, N=15 모든 경우 동작** | 단위 테스트 |
| AC8 | 총 애니메이션 길이 ≤ 1200ms (cap) | 단위 테스트 |
| AC9 | 첫 마운트 시 깜빡임 / 0%부터 fill 채움 없음 | 수동 |
| AC10 | `prefers-reduced-motion: reduce` 환경에서 RAF 미실행, 즉시 final state | macOS "동작 줄이기" + 단위 테스트 (MockMatchMedia) |
| AC11 | Mid-flight 인터럽트 시 새 wave가 자연스럽게 시작 | 수동 (rapid step change) |
| AC12 | Component unmount 시 RAF cancel, console error 0 | 단위 테스트 |
| AC13 | `<nav aria-label>`, `aria-current="step"`, CheckIcon `aria-hidden` 적용 | axe-core 또는 수동 |
| AC14 | 기존 consumer (`ProcessStatusCard`, `GuidePreviewPanel`) props 시그니처 호환 | 회귀 테스트 |
| AC15 | inline 색 hex / 인라인 SVG 0건 | 코드 리뷰 |
| AC16 | 라벨 색은 CSS `transition-colors`로 부드럽게 바뀜 (RAF는 색 안 건드림) | 수동 |
| AC17 | `transitionend`나 `setTimeout` 의존 0건 (RAF 단일 driver) | 코드 리뷰 |

---

## 8. 작업 단계 (Verifiable Chunks)

### Step 1 — motion 토큰 + helper
- `lib/theme.ts` 에 `motion` 토큰 추가 (색, easing, ms)
- `motion/easing.ts` (`easeOutQuart`, `invEaseOutQuart`, `easeOutCubic`)
- `motion/colorMix.ts` (`mixHex`)
- `lib/hooks/useReducedMotion.ts`
- `app/components/ui/icons/CheckIcon.tsx` + barrel export
- 단위 테스트: easing 곡선 수치, mixHex 경계값
- **검증**: `npm run test:run -- easing colorMix`

### Step 2 — RAF Engine
- `motion/stepperMotionEngine.ts` 작성
- `runStepperMotion` 시그니처/cleanup 패턴 확정
- 단위 테스트:
  - `dir === 0` → onDone 즉시 호출
  - `dir > 0` 단순 케이스 → fill scaleX 1까지 도달
  - `dir < 0` → fill scaleX 0까지 빠짐
  - reduced-motion 분기 → RAF 미실행
  - distance 계산 = sum(lengths) 정확
- jsdom에서 `requestAnimationFrame` polyfill 필요 → 시뮬레이션은 `vi.useFakeTimers` + 수동 RAF mock
- **검증**: 엔진 테스트 모두 통과

### Step 3 — Generic ProcessProgressBar
- `ProcessProgressBar.tsx` 작성 (§5.5)
- `useLayoutEffect` + snapshot diff로 RAF 트리거
- `cleanupRef` 패턴
- ref 배열 wiring (`fillRefs`, `circleRefs`, `iconNumberRefs`, `iconCheckRefs`)
- 단위 테스트:
  - 첫 마운트 RAF 미실행
  - props 변경 시 RAF 호출 인자 검증 (mock `runStepperMotion`)
  - reduced-motion 시 RAF 미호출
  - 같은 snapshot 재렌더 시 RAF 미호출
  - unmount 시 cleanup 호출
- **검증**: `npm run test:run -- ProcessProgressBar` 통과

### Step 4 — Domain adapter
- `InstallationProcessProgressBar.tsx` 작성 (§5.6)
- `toSteps(currentStep: ProcessStatus): ProgressBarStep[]` 헬퍼
- 단위 테스트: `currentStep` 모든 값에 대해 올바른 ProgressBarStep[] 생성
- **검증**: 테스트 통과

### Step 5 — Consumer 마이그레이션
- `ProcessStatusCard.tsx`, `GuidePreviewPanel.tsx` import 경로 갱신 (StepProgressBar → InstallationProcessProgressBar)
- 기존 export 경로에 deprecation alias 추가:
  ```ts
  export const StepProgressBar = InstallationProcessProgressBar;
  ```
- 1 cycle 후 alias 제거 (별도 PR)
- **검증**: `npm run test:run` + dev 서버 시각 확인

### Step 6 — 시각 검증 (수동)
- dev 서버 + mock seed로:
  - Step1→Step2, Step1→Step3, Step1→Step7, Step3→Step1 전부 매끄럽게
  - macOS "동작 줄이기" ON 시 즉시 전환
  - GuidePreviewPanel 미리보기 정상
- 발견된 부자연스러움은 토큰 미세조정 (motion.fillMsMin, baseSpeed, visualHandoff)

### Step 7 — 정리
- `StepIndicator.tsx` 의 향후 통합 follow-up 이슈 작성 (이 PR scope 외)
- README/ADR (옵션): `docs/adr/015-process-bar-motion-architecture.md`
- 영문 ADR로 작성 (CLAUDE.md 규칙)

### Step 8 — Commit / PR
- 단계별 atomic commit
- `git fetch origin main && git rebase origin/main`
- PR 본문에 before/after GIF (slow-mo + 정상 속도)

---

## 9. 영향 범위

### 9.1 Consumer (시그니처 변경 없음)
- `app/components/features/ProcessStatusCard.tsx` (line 98) — `currentStep` prop 그대로
- `app/integration/admin/guides/components/GuidePreviewPanel.tsx` (line 109) — `currentStep` prop 그대로

### 9.2 새 도입
- `lib/hooks/useReducedMotion.ts`
- `app/components/ui/icons/CheckIcon.tsx`
- `lib/theme.ts` 에 `motion` 토큰
- `app/components/features/process-status/motion/*`
- `ProcessProgressBar` (generic)
- `InstallationProcessProgressBar` (adapter)

### 9.3 Deprecate
- `StepProgressBar` → alias 1 cycle 후 제거
- `StepIndicator.tsx` → follow-up 이슈로 통합 (이 PR 외)
- `ProgressBarStep['state']`의 `customSteps` 진입점 → 삭제 (외부 consumer 0개)

### 9.4 잠재 부작용
- **첫 paint 비용 약간 증가**: useLayoutEffect로 paint blocking → 7-step 기준 무시 가능 수준.
- **Background tab throttling**: RAF는 hidden tab에서 일시 정지. 복귀 시 elapsed > duration이라 즉시 finalize. 사용자 인지 부담 없음.
- **iOS Safari low-power mode**: RAF 30fps 떨어질 수 있음 → 우리의 0.5초 애니메이션 기준 15프레임. 약간 끊겨 보일 수 있으나 수용 trade-off (CSS transition도 동일 영향).

---

## 10. 비-목표 (Out of Scope)

- `StepIndicator.tsx` 통합 (follow-up issue)
- `ProcessGuideTimeline.tsx` 의 inline SVG 정리 (별도 PR)
- spring physics (Toss 일부 제품에서 사용 — 본 plan은 ease-out-quart로 충분)
- 진행 중 step의 펄스 ring 추가 (별도 micro-interaction PR)
- 사운드 / 햅틱
- ResizeObserver 통한 mid-flight length 재측정
- ADR-015 작성 (별도 docs PR 가능)

---

## 11. 위험 / Open Questions

1. **`baseSpeed = 1.6 px/ms`**: 시각 평가 후 1.4 / 1.6 / 1.8 비교 필요. min/max bounds 보호 있으므로 extreme 값에서도 safe.
2. **Pulse amplitude `0.055`**: 원이 작아서 5.5% scale도 시각적으로 잘 안 보일 수 있음. 7~8% 실험.
3. **RAF에서 `transformOrigin` 매 프레임 set**: forward → 'left', backward → 'right'. 초기 1회만 set하도록 최적화 가능 (성능 영향 미미).
4. **iOS Safari WAAPI fallback?**: RAF는 universal 지원이라 불필요. WAAPI로 마이그레이션은 향후.
5. **Tailwind class on ref'd element + RAF inline style 충돌**: finalize() 가 inline 비우면 CSS 클래스가 다시 우선 → 정상. 단위 테스트에서 명시 검증.
6. **`<ol>` semantic vs `<nav>` 중첩**: 일부 a11y 가이드는 `<ol>` 단독 권장. 현재는 `<nav><ol>` 조합. 합의 필요.

---

## 12. Toss Interaction Heuristics 적용 매핑

| 원칙 | 본 구현에서의 발현 |
|---|---|
| 인과성 | 단일 wave-front position이 모든 변화의 원인 — RAF tick마다 fill·circle·icon이 같은 `t`에서 파생 |
| 순차성 | wave가 좌→우(또는 역)로 이동하며 step별 자연 cascade |
| 자연스러운 easing | fill: ease-out-quart, circle: cubic-bezier(0.2, 0, 0, 1) (트리거 느낌), crossfade: cubic-bezier(0.33, 1, 0.68, 1) |
| 색 = 신호 | gray → primary → success, RGB 보간으로 중간색까지 부드럽게 |
| micro-reward | circle scale pulse 1.0→1.055→1.0, check icon fade-in |
| 양방향 대칭 | dir > 0: 좌→우 채움, dir < 0: 우→좌 빠짐, transformOrigin 자동 전환 |
| 가변 N 동질감 | distance 기반 duration scaling, easing은 N 무관 |
| 인터럽트 자연 | `cleanupRef.current?.()` + 새 RAF — inline style은 그대로 두고 새 wave가 이어서 처리 |

---

## 13. v1과의 호환성

본 plan은 v1을 **전면 대체**. 동일 PR 본 commit으로 doc 갱신.

v1 plan을 따라 이미 구현된 코드는 없음 (plan PR 단계). 따라서 backwards-compat 부담 0.
