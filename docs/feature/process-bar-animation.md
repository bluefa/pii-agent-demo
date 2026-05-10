# ProcessBar 동적 애니메이션 구현 계획 v4 — Slow RAF Wave-Front (Design-Validated)

대상: `app/components/features/process-status/StepProgressBar.tsx` 및 후속 generic 컴포넌트
작성일: 2026-05-10 (v4)
난이도: ★★★★☆ — RAF orchestration + 색 보간 + 가변 N
**디자인 reference**: `design/ProcessBar Motion Prototype.html` (Slow Version 채택)

---

## 0. 개정 이력 요약

| 버전 | 변경 |
|---|---|
| v1 | CSS transition + delay 수식 — Codex 외부 리뷰에서 Critical 1 / Major 4 / Minor 3 발견 |
| v2 | RAF wave-front driver로 전면 pivot — 추가 Critical 1 / Major 5 / Minor 5 |
| v3 | 핵심 결함 정정 (left-origin, backward source, cleanup-finalize, snapshot length/ids, motion 토큰 SSOT) |
| **v4** | **`design/ProcessBar Motion Prototype.html` Slow Version 채택**. 모든 duration ×3 → slow 가 default. pulse amplitude 0.06 정정. connector geometry / label transition 등 prototype 수치를 spec으로 고정. |

v3까지의 architecture(RAF wave-front driver, `transform: scaleX()`, useReducedMotion 등)는 prototype 으로 **검증됨** — 본 v4 는 timing/visual 수치만 prototype 과 정합화.

---

## 1. 배경

### 1.1 사용자 요구

| # | 요구 | 비고 |
|---|---|---|
| R1 | 단일 step 진행(N→N+1) 시 막대가 좌→우로 자연스럽게 채워짐 | |
| R2 | step 색이 자연스럽게 변환 (pending→current→completed) | |
| R3 | 점프(Step1→Step3) 시 wave-like cascade forward | |
| R4 | 역행(Step3→Step1) 시 wave-like cascade backward | |
| R5 | **막대가 step에 도착하는 순간 그 step 색이 변함 (Toss interaction design)** | RAF 단일 driver 로 정밀 동기화 |
| R6 | **process bar는 여러 곳에서 사용**, 1~N 단계 가변 | generic + adapter 분리 |
| R7 | **최대한 자연스러운 UI > 코드량** | RAF wave-front 채택 정당화 |
| R8 | 기존 디자인(원+라벨+커넥터 가로 레이아웃) 유지 | 시각 변화 최소 |
| **R9** | **`design/ProcessBar Motion Prototype.html` 의 Slow Version 시각/속도를 default 로 구현** | **prototype = source of truth** |

### 1.2 Toss-style Interaction Design 원칙

1. **인과성 (Causality)** — wave-front position 한 값이 fill·circle·icon 모두 결정.
2. **순차성 (Sequence)** — wave가 단일 시간선 위에서 좌→우(또는 역) 흐름.
3. **자연스러운 easing** — ease-out-quart 류 brand-consistent 곡선.
4. **색 = 신호** — pending → current → completed 의미 운반.
5. **micro-reward** — circle scale pulse + check icon fade-in.
6. **양방향 대칭** — forward / backward 동일 quality.
7. **Slow & soft** — 사용자가 "1, 2, 3, 4 점점 움직이는" 흐름을 충분히 인지할 시간.

---

## 2. 아키텍처 개요

### 2.1 두 컴포넌트로 분리

```
┌──────────────────────────────────────┐
│ ProcessProgressBar (generic)          │
│ - props: { steps, ariaLabel }        │
│ - RAF wave-front driver 보유          │
└──────────────────────────────────────┘
            ▲ wraps
┌──────────────────────────────────────┐
│ InstallationProcessProgressBar (adapter)│
│ - props: { currentStep: ProcessStatus }│
│ - 7-step install map 변환             │
└──────────────────────────────────────┘
            ▲ used by
ProcessStatusCard, GuidePreviewPanel
```

### 2.2 파일 구조

```
app/components/features/process-status/
├── ProcessProgressBar.tsx                  # generic (NEW)
├── ProcessProgressBar.test.tsx
├── InstallationProcessProgressBar.tsx      # adapter (renamed from StepProgressBar)
├── InstallationProcessProgressBar.test.tsx
├── motion/
│   ├── stepperMotionEngine.ts              # RAF driver
│   ├── stepperMotionEngine.test.ts
│   ├── colorMix.ts                         # RGB 색 보간
│   └── easing.ts                           # easing 함수
└── index.ts

app/components/ui/icons/
├── CheckIcon.tsx
└── index.ts                                # add export

lib/hooks/
├── useReducedMotion.ts
└── useIsomorphicLayoutEffect.ts

lib/theme.ts                                # colorRaw + motion 토큰 추가
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

// 설치 도메인 (기존 시그니처 유지 — consumer 무변경)
<InstallationProcessProgressBar currentStep={currentStep} />
```

`customSteps` prop은 deprecate (외부 사용처 0건). `currentStep` 만 받는 adapter는 유지.

---

## 3. 토큰 (Slow Version)

### 3.1 raw 색 상수 (`lib/theme.ts` 신규)

기존 `primaryColors.bg`, `statusColors.success.dot` 등은 모두 **Tailwind 클래스 문자열**. RAF 색 보간은 hex 값이 필요하므로 SSOT 추가:

```ts
// SSOT: hex 값을 한 곳에 모음
export const colorRaw = {
  primary:     '#0064FF',
  success:     '#45CB85',
  pendingBg:   '#F3F4F6',  // gray-100
  pendingText: '#9CA3AF',  // gray-400
  white:       '#FFFFFF',
  successDark: '#2A7D52',  // label completed text
} as const;
```

기존 Tailwind 문자열 토큰(`primaryColors.bg = 'bg-[#0064FF]'`)은 **그대로 보존**. 두 곳에서 동일 hex가 사용된다는 점을 `theme.ts` 상단 주석으로 명시. (Tailwind 4 동적 클래스 분석 한계로 raw 상수에서 클래스 자동 도출은 시도하지 않음.)

### 3.2 motion 토큰 (`lib/theme.ts` 신규) — Slow 가 default

prototype 의 normal speed × 3 = slow base. **이 값이 default**.

```ts
import { colorRaw } from '@/lib/theme';

export const motion = {
  // Duration (ms) — Slow Version (prototype normal × 3)
  fillMsMin:        1260,  // 420 × 3
  fillMsMax:        3600,  // 1200 × 3
  circleMs:          540,  // 180 × 3
  iconCrossfadeMs:   660,  // 220 × 3

  // Distance scaling
  baseSpeed:         0.53, // px/ms — prototype 1.6 / 3
  stepBonus:         108,  // ms per extra edge — prototype 36 × 3

  // Visual handoff threshold (0..1) — easing 무관, prototype과 동일
  visualHandoff:     0.98,

  // Pulse amplitude — prototype 수치
  pulseAmplitude:    0.06,

  // Easing strings (RAF는 자체 easing 함수 사용)
  fillEasing:        'cubic-bezier(0.22, 1, 0.36, 1)',
  circleEasing:      'cubic-bezier(0.2, 0, 0, 1)',
  crossfadeEasing:   'cubic-bezier(0.33, 1, 0.68, 1)',

  // RAF 색 보간용 — colorRaw 참조
  colors: {
    pendingBg:   colorRaw.pendingBg,
    currentBg:   colorRaw.primary,
    completedBg: colorRaw.success,
    pendingText: colorRaw.pendingText,
    activeText:  colorRaw.white,
  },
} as const;
```

#### 왜 multiplier 가 아니라 baked-in?

`speedMultiplier: 3` 같은 knob 을 두면 향후 1× 로 되돌릴 수 있다. 그러나:
- 사용자가 명시적으로 Slow 를 선택했고
- 1× 는 prototype 에서 너무 빠르다고 평가됨
- knob 은 "production 에서 어떻게 쓸까" 결정을 미루는 것

→ **slow tokens 를 직접 박는다**. 향후 변경 필요 시 `motion.fillMsMin = 420` 처럼 한 줄 수정.

### 3.3 Slow Version timing 표

| 케이스 | distance(px) | edgeCount | duration |
|---|---|---|---|
| N=2 단일 진행 | 200 | 1 | clamp(200/0.53, 1260, 3600) = **1260ms** (min) |
| N=7, Step1→Step2 | 100 | 1 | clamp(189, 1260, 3600) = **1260ms** |
| N=7, Step1→Step3 | 200 | 2 | clamp(485, 1260, 3600) = **1260ms** |
| N=7, Step1→Step7 | 600 | 6 | clamp(1672, 1260, 3600) = **1672ms** |
| N=15, Step1→Step15 | 1400 | 14 | clamp(4172, 1260, 3600) = **3600ms** (cap) |

slow 를 채택했으므로 N=15 점프는 최대 3.6초까지 허용. 사용자 인지 흐름이 우선.

---

## 4. 상세 설계

### 4.1 RAF Wave-Front Driver

`stepperMotionEngine.ts` — prototype 의 검증된 구조를 그대로 차용.

```ts
import { motion } from '@/lib/theme';
import { mixHex } from '@/app/components/features/process-status/motion/colorMix';
import {
  easeOutQuart, invEaseOutQuart, easeOutCubic,
} from '@/app/components/features/process-status/motion/easing';

export type StepState = 'completed' | 'current' | 'pending';

export interface MotionRun {
  fromIndex: number;
  toIndex: number;
  fromStates: StepState[];
  toStates: StepState[];
  fillRefs: Array<HTMLElement | null>;     // [0..N-2]
  circleRefs: Array<HTMLElement | null>;   // [0..N-1]
  iconNumberRefs: Array<HTMLElement | null>;
  iconCheckRefs: Array<HTMLElement | null>;
  onDone?: () => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const stateColor = (s: StepState): string =>
  s === 'completed' ? motion.colors.completedBg :
  s === 'current'   ? motion.colors.currentBg   :
                      motion.colors.pendingBg;

const stateTextColor = (s: StepState): string =>
  s === 'pending' ? motion.colors.pendingText : motion.colors.activeText;

export const runStepperMotion = (run: MotionRun): (() => void) => {
  const { fromIndex, toIndex, fromStates, toStates,
          fillRefs, circleRefs, iconNumberRefs, iconCheckRefs, onDone } = run;

  const dir = Math.sign(toIndex - fromIndex);
  if (dir === 0) { onDone?.(); return () => undefined; }

  const edgeCount = Math.abs(toIndex - fromIndex);
  const firstEdge = dir > 0 ? fromIndex : fromIndex - 1;
  const rawEdges = Array.from({ length: edgeCount }, (_, k) => firstEdge + k * dir);
  // 가상 endpoint 제거: connector index ∈ [0, len-2]
  const edges = rawEdges.filter(e => e >= 0 && e < fillRefs.length);

  const lengths = edges.map(e => {
    const fill = fillRefs[e];
    const track = fill?.parentElement;
    return track?.getBoundingClientRect().width ?? 1;
  });
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((s, n) => s + n, 0));
  const distance = lengths.reduce((s, n) => s + n, 0);

  // distance-scaled, slow-default
  const duration = Math.min(
    motion.fillMsMax,
    Math.max(motion.fillMsMin, distance / motion.baseSpeed + (edgeCount - 1) * motion.stepBonus),
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

      // 1) Connector fill — origin 항상 'left center'
      const fill = fillRefs[edge];
      if (fill) {
        fill.style.transformOrigin = 'left center';
        fill.style.transform = `scaleX(${dir > 0 ? local : 1 - local})`;
      }

      // 2) Circle arrival — wave가 connector의 visualHandoff 지점 도달 시
      const handoffElapsed = invEaseOutQuart(
        (starts[order] + lengths[order] * motion.visualHandoff) / distance,
      ) * duration;
      const circleT = easeOutCubic(clamp01((elapsed - handoffElapsed) / motion.circleMs));

      const targetIdx = dir > 0 ? edge + 1 : edge;
      const fromS = fromStates[targetIdx];
      const toS = toStates[targetIdx];
      const circle = circleRefs[targetIdx];

      if (circle && fromS !== toS) {
        circle.style.backgroundColor = mixHex(stateColor(fromS), stateColor(toS), circleT);
        circle.style.color = mixHex(stateTextColor(fromS), stateTextColor(toS), circleT);
        const pulse = 1 + motion.pulseAmplitude * Math.sin(Math.PI * circleT);
        circle.style.transform = `scale(${pulse})`;
      }

      // 3) Number ↔ Check icon crossfade
      const numEl = iconNumberRefs[targetIdx];
      const chkEl = iconCheckRefs[targetIdx];
      const wantsCheck = toS === 'completed';
      const hadCheck = fromS === 'completed';
      if (wantsCheck !== hadCheck && numEl && chkEl) {
        const fade = clamp01((elapsed - handoffElapsed) / motion.iconCrossfadeMs);
        if (wantsCheck) { numEl.style.opacity = String(1 - fade); chkEl.style.opacity = String(fade); }
        else { numEl.style.opacity = String(fade); chkEl.style.opacity = String(1 - fade); }
      }
    });

    // Source step (departing): forward/backward 양방향 즉시 전환
    const srcIdx = fromIndex;
    if (srcIdx >= 0 && srcIdx < toStates.length && fromStates[srcIdx] !== toStates[srcIdx]) {
      const tail = easeOutCubic(clamp01(elapsed / motion.circleMs));
      const srcCircle = circleRefs[srcIdx];
      if (srcCircle) {
        srcCircle.style.backgroundColor = mixHex(stateColor(fromStates[srcIdx]), stateColor(toStates[srcIdx]), tail);
        srcCircle.style.color = mixHex(stateTextColor(fromStates[srcIdx]), stateTextColor(toStates[srcIdx]), tail);
      }
      const numEl = iconNumberRefs[srcIdx], chkEl = iconCheckRefs[srcIdx];
      const wasCheck = fromStates[srcIdx] === 'completed';
      const willCheck = toStates[srcIdx] === 'completed';
      if (numEl && chkEl && wasCheck !== willCheck) {
        const fade = clamp01(elapsed / motion.iconCrossfadeMs);
        if (willCheck) { numEl.style.opacity = String(1 - fade); chkEl.style.opacity = String(fade); }
        else { numEl.style.opacity = String(fade); chkEl.style.opacity = String(1 - fade); }
      }
    }

    if (elapsed < duration + motion.circleMs) {
      frame = requestAnimationFrame(draw);
    } else {
      finalize(run);
      onDone?.();
    }
  };

  frame = requestAnimationFrame(draw);

  return () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(frame);
    finalize(run); // CRITICAL: 인터럽트 시 inline style 정리
  };
};

const finalize = (run: MotionRun) => {
  run.circleRefs.forEach(el => {
    if (!el) return;
    el.style.backgroundColor = '';
    el.style.color = '';
    el.style.transform = '';
  });
  run.fillRefs.forEach(el => { if (el) el.style.transform = ''; });
  run.iconNumberRefs.forEach(el => { if (el) el.style.opacity = ''; });
  run.iconCheckRefs.forEach(el => { if (el) el.style.opacity = ''; });
};
```

### 4.2 Visual handoff (slow에서의 시각 trace)

slow base 에서 N=7, Step1→Step3 forward (두 connector 동일 길이, total fill = 1260ms):
- connector 0 handoff = `invEaseOutQuart(0.5 × 0.98)` × 1260 ≈ **195ms** (전체의 15%)
- connector 1 handoff = `invEaseOutQuart(0.5 + 0.5 × 0.98)` × 1260 ≈ **861ms** (68%)
- circle 색 전환은 각각 540ms 간 진행 → 마지막 circle 완성 = ~1401ms
- finalize 직전 = duration + circleMs = 1800ms

전체 1.8초 동안 wave 가 흘러가며 두 단계가 차례로 활성화 → 사용자가 "1→2→3 흐름"을 충분히 인지.

### 4.3 First-mount snap pattern

```tsx
import { useIsomorphicLayoutEffect } from '@/lib/hooks/useIsomorphicLayoutEffect';

const hasMountedRef = useRef(false);

useIsomorphicLayoutEffect(() => {
  if (!hasMountedRef.current) {
    hasMountedRef.current = true;
    return; // 첫 paint 는 RAF 없이 props state 그대로
  }
  // 이후 semantic 변경 시에만 RAF
  const cleanup = runStepperMotion({ ... });
  return cleanup;
}, [activeIndex, snapshotKey]);
```

#### Snapshot key

```ts
const snapshotKey = useMemo(
  () => steps.map(s => `${s.id}:${s.state}`).join('|') + `:${steps.length}`,
  [steps],
);
```

라벨 변경은 RAF 미트리거. step 추가/삭제·id 변경·state 변경만 트리거.

#### useIsomorphicLayoutEffect

```ts
// lib/hooks/useIsomorphicLayoutEffect.ts
import { useEffect, useLayoutEffect } from 'react';
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

SSR prerender 시 useLayoutEffect 경고 회피.

### 4.4 Reduced motion

```ts
// lib/hooks/useReducedMotion.ts
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

reduced=true 면 RAF 미실행, CSS 클래스만으로 즉시 final state.

### 4.5 Visual specs (prototype 정합)

prototype `design/ProcessBar Motion Prototype.html` 의 CSS 를 spec 으로 채택:

#### Circle (40px × 40px)

```
border-radius: 50%
font: ui-monospace 12px / 600 weight
default (pending): bg #F3F4F6, color #9CA3AF
.is-current:       bg #0064FF, color #fff, box-shadow: 0 0 0 6px rgba(0,100,255,0.10)
.is-completed:     bg #45CB85, color #fff
transition: box-shadow 200ms ease  (RAF 가 bg/color/transform 직접 제어)
```

#### Layer (number / check icon)

```
position: absolute; inset: 0
display: grid; place-items: center
transition: none  (RAF 가 opacity 직접 제어)
SVG: 16×16, stroke-width: 2.5, fill: none, stroke: currentColor
```

#### Label

```
margin-top: 10px
font-size: 12px / 500 weight
max-width: 130px
word-break: keep-all
text-align: center
line-height: 1.35

default (pending): color #9CA3AF
.is-current:       color #0064FF / 600 weight
.is-completed:     color #2A7D52 / 500 weight

transition: color 220ms ease   (slow 에서도 220ms 유지 — 라벨은 RAF 외부)
```

#### Connector

```
position: absolute
top: 19px       /* circle 40px → 중심 20px, bar 2px → 19px */
left:  calc(50% + 24px)
right: calc(-50% + 24px)
height: 2px
background: #E5E7EB
border-radius: 2px
overflow: hidden
z-index: 1
```

#### Connector fill

```
position: absolute; inset: 0
background: #45CB85
border-radius: 2px
transform: scaleX(0)            /* default */
transform-origin: left center
will-change: transform
.is-completed: transform: scaleX(1)
```

#### Layout (variable N)

```
.pbar {
  display: grid;
  grid-template-columns: repeat(N, minmax(0, 1fr));  /* dynamic */
}
```

> ⚠️ Connector geometry 의 `left: calc(50% + 24px)`, `right: calc(-50% + 24px)` 수치는 prototype 검증값. 변경 시 N=2~15 모두 시각 회귀 필수.

### 4.6 Accessibility

```tsx
<nav aria-label={ariaLabel}>
  <ol role="list" className="pbar">
    {steps.map((step, i) => (
      <li
        key={step.id}
        aria-current={step.state === 'current' ? 'step' : undefined}
        className="pbar__item"
      >
        <div className="pbar__col">
          <div ref={...} className={cn('circle', state-class)}>
            <span ref={iconNumberRefs} aria-hidden="true" className="layer">{number}</span>
            <span ref={iconCheckRefs} aria-hidden="true" className="layer">
              <CheckIcon />
            </span>
          </div>
          <span className={cn('label', state-class)}>{step.label}</span>
        </div>
        {!isLast && (
          <div className="connector">
            <div ref={fillRefs} className="connector__fill" />
          </div>
        )}
      </li>
    ))}
  </ol>
</nav>
```

- `<nav aria-label>` semantic
- `aria-current="step"` on current
- 두 icon layer 모두 `aria-hidden` (의미는 라벨이 운반)
- 라벨은 항상 표시

---

## 5. 컴포넌트

### 5.1 `ProcessProgressBar` (generic)

```tsx
'use client';

import { useMemo, useRef } from 'react';
import { CheckIcon } from '@/app/components/ui/icons';
import { useIsomorphicLayoutEffect } from '@/lib/hooks/useIsomorphicLayoutEffect';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import {
  runStepperMotion,
  type StepState,
} from '@/app/components/features/process-status/motion/stepperMotionEngine';

export interface ProgressBarStep {
  id: string;
  label: string;
  state: StepState;
}

interface Props {
  steps: ProgressBarStep[];
  ariaLabel: string; // 필수
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

  const prevSnapshotRef = useRef<{ idx: number; ids: string[]; states: StepState[] }>({
    idx: activeIndex,
    ids: steps.map(s => s.id),
    states: steps.map(s => s.state),
  });
  const hasMountedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const snapshotKey = useMemo(
    () => steps.map(s => `${s.id}:${s.state}`).join('|') + `:${steps.length}`,
    [steps],
  );

  useIsomorphicLayoutEffect(() => {
    const currentIds = steps.map(s => s.id);
    const currentStates = steps.map(s => s.state);

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevSnapshotRef.current = { idx: activeIndex, ids: currentIds, states: currentStates };
      return;
    }

    const prev = prevSnapshotRef.current;
    const sameLen = prev.ids.length === currentIds.length;
    const sameIds = sameLen && prev.ids.every((id, i) => id === currentIds[i]);
    const sameStates = sameLen && prev.states.every((s, i) => s === currentStates[i]);
    if (prev.idx === activeIndex && sameIds && sameStates) {
      return;
    }

    cleanupRef.current?.();

    if (reduced) {
      prevSnapshotRef.current = { idx: activeIndex, ids: currentIds, states: currentStates };
      return;
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
      onDone: () => { cleanupRef.current = null; },
    });

    prevSnapshotRef.current = { idx: activeIndex, ids: currentIds, states: currentStates };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [activeIndex, snapshotKey, reduced]);

  return (
    <nav aria-label={ariaLabel} className="mb-6">
      <ol
        role="list"
        className="pbar grid items-start"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const isCompleted = step.state === 'completed';
          const isCurrent = step.state === 'current';
          const isLast = index === steps.length - 1;
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className="pbar__item relative flex items-start justify-center min-w-0"
            >
              <div className="pbar__col flex flex-col items-center w-full relative z-[2]">
                <div
                  ref={(el) => { circleRefs.current[index] = el; }}
                  className={cn(
                    'circle relative w-10 h-10 rounded-full grid place-items-center',
                    'font-mono text-xs font-semibold',
                    'transition-shadow duration-200 ease-out',
                    isCurrent && 'is-current',
                    isCompleted && 'is-completed',
                  )}
                  style={{ willChange: 'transform, background-color' }}
                >
                  <span
                    ref={(el) => { iconNumberRefs.current[index] = el; }}
                    aria-hidden="true"
                    className="layer absolute inset-0 grid place-items-center"
                    style={{ opacity: isCompleted ? 0 : 1 }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    ref={(el) => { iconCheckRefs.current[index] = el; }}
                    aria-hidden="true"
                    className="layer absolute inset-0 grid place-items-center"
                    style={{ opacity: isCompleted ? 1 : 0 }}
                  >
                    <CheckIcon className="w-4 h-4" />
                  </span>
                </div>
                <span
                  className={cn(
                    'label mt-2.5 text-xs font-medium text-center max-w-[130px] leading-[1.35]',
                    'transition-colors duration-[220ms] ease-out motion-reduce:transition-none',
                    isCompleted && 'is-completed',
                    isCurrent && 'is-current',
                  )}
                  style={{ wordBreak: 'keep-all' }}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className="connector absolute h-[2px] bg-[#E5E7EB] rounded-[2px] overflow-hidden z-[1]"
                  style={{
                    top: '19px',
                    left: 'calc(50% + 24px)',
                    right: 'calc(-50% + 24px)',
                  }}
                >
                  <div
                    ref={(el) => { fillRefs.current[index] = el; }}
                    className="connector__fill absolute inset-0 bg-[#45CB85] rounded-[2px]"
                    style={{
                      transform: isCompleted ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left center',
                      willChange: 'transform',
                    }}
                  />
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

> 🟡 색 hex 인라인(`bg-[#E5E7EB]`, `bg-[#45CB85]`)은 prototype 정합을 위한 임시. 구현 시 `theme.ts` 에 해당 hex 가 누락되어 있다면 `colorRaw.connectorTrack`, `colorRaw.success` 등 SSOT 토큰으로 옮긴다.

#### 추가: cn / Tailwind class 토큰화

`cn` 은 기존 `@/lib/theme` 의 helper. circle/label class 가 prototype 의 `is-current` / `is-completed` 시각을 그대로 따르도록 globals.css 또는 module css 에 다음을 추가하거나, Tailwind class 직접 합성:

```css
/* globals.css 또는 ProcessProgressBar.module.css */
.circle.is-current  { background-color: var(--color-primary); color: #fff;
                      box-shadow: 0 0 0 6px rgba(0,100,255,0.10); }
.circle.is-completed { background-color: var(--color-success); color: #fff; }
.label.is-current    { color: var(--color-primary); font-weight: 600; }
.label.is-completed  { color: #2A7D52; font-weight: 500; }
```

(또는 cn 으로 Tailwind 토큰 합성 — 어느 쪽이든 prototype 시각과 일치하면 OK.)

### 5.2 `InstallationProcessProgressBar` (adapter)

```tsx
'use client';

import { ProcessStatus } from '@/lib/types';
import {
  ProcessProgressBar,
  type ProgressBarStep,
} from '@/app/components/features/process-status/ProcessProgressBar';

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
  <ProcessProgressBar
    steps={toSteps(currentStep)}
    ariaLabel="설치 진행 단계"
  />
);
```

### 5.3 supporting modules

#### `motion/easing.ts`

```ts
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const invEaseOutQuart = (y: number) => 1 - Math.pow(1 - y, 1 / 4);
```

#### `motion/colorMix.ts`

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

#### `app/components/ui/icons/CheckIcon.tsx`

```tsx
import type { IconProps } from '@/app/components/ui/icons/types';

export const CheckIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
```

`app/components/ui/icons/index.ts` 에 export 추가.

---

## 6. Edge Case 처리

| Case | 처리 |
|---|---|
| 첫 마운트 | `hasMountedRef`로 RAF skip → CSS 클래스가 final state 즉시 적용 |
| 같은 index 내 라벨만 변경 | snapshot diff로 RAF skip |
| Mid-flight 인터럽트 | `cleanupRef.current?.()` → `finalize()` → 새 RAF |
| Component unmount | useEffect cleanup chain |
| `prefers-reduced-motion: reduce` | RAF 미실행, CSS 클래스로 즉시 final state |
| `prevIndex === -1` (모두 pending → 첫 step) | edges 필터링으로 negative index 제거 |
| `activeIndex === -1` (역행으로 모두 pending) | dir < 0, 동일 메커니즘 |
| 모두 completed | activeIndex = N-1, 변화 없으면 RAF skip |
| Tab 전환 (RAF throttle) | 복귀 시 elapsed > duration → 즉시 finalize |
| ResizeObserver / 화면 회전 | RAF 시작 시점 1회 측정. 진행 중 리사이즈는 다음 사이클 적용 |
| SSR | `useIsomorphicLayoutEffect` 로 useLayoutEffect 경고 회피 |
| `count` 변경 (N 변경) | snapshot length 차이 → RAF 트리거. 단, animation 의미가 약하므로 무애니메이션 fallback 도 허용 (구현 판단) |

---

## 7. 인수 기준

| # | 기준 | 검증 |
|---|---|---|
| AC1 | 단일 step 진행 시 connector 가 좌→우로 부드럽게 채워짐 (transform: scaleX) | 수동 |
| AC2 | step circle 색이 RGB 보간으로 부드럽게 전환 | 수동 |
| AC3 | 숫자 ↔ 체크 아이콘 crossfade (660ms, 합 opacity = 1) | 수동 + 단위 테스트 |
| AC4 | 막대가 connector 길이의 98%에 도달하면 다음 circle 색 전환 시작 | 단위 테스트 (engine math) |
| AC5 | Step1→Step3 점프 시 wave forward (단일 RAF) | 수동 + 단위 테스트 |
| AC6 | Step3→Step1 역행 시 wave backward (origin: left center 유지, scaleX 1→0) | 수동 + 단위 테스트 |
| AC7 | N=2, N=7, N=15 모든 경우 동작 | 단위 테스트 |
| AC8 | 총 애니메이션 길이 ≤ `motion.fillMsMax + motion.circleMs` = 4140ms | 단위 테스트 |
| AC9 | 첫 마운트 시 깜빡임 없음 | 수동 |
| AC10 | `prefers-reduced-motion: reduce` 시 RAF 미실행 | macOS "동작 줄이기" + 단위 테스트 (matchMedia mock) |
| AC11 | Mid-flight 인터럽트 시 새 wave 자연스럽게 시작 | 수동 (rapid step change) |
| AC12 | Component unmount 시 RAF cancel + finalize | 단위 테스트 |
| AC13 | `<nav aria-label>`, `aria-current="step"`, CheckIcon `aria-hidden` | 수동 |
| AC14 | 기존 consumer (`ProcessStatusCard`, `GuidePreviewPanel`) props 시그니처 호환 | 회귀 테스트 |
| AC15 | inline SVG 0건 (`StepProgressBar` 본체 + adapter) | 코드 리뷰 |
| AC16 | 라벨 색은 CSS `transition-colors duration-220` (RAF는 라벨 색 미관여) | 수동 |
| AC17 | `transitionend` / `setTimeout` 의존 0건 (RAF 단일 driver) | 코드 리뷰 |
| AC18 | **prototype Slow Version 시각·속도와 일치** — `design/ProcessBar Motion Prototype.html` 의 "Slow-mo (×3)" 토글 ON 상태와 비교했을 때 차이 인지 불가 | 수동 (split-screen 비교) |

---

## 8. 작업 단계

### Step 1 — Tokens + helpers
- `lib/theme.ts` — `colorRaw` 와 `motion` 토큰 (slow base) 추가
- `motion/easing.ts`, `motion/colorMix.ts`
- `lib/hooks/useReducedMotion.ts`, `useIsomorphicLayoutEffect.ts`
- `app/components/ui/icons/CheckIcon.tsx` + barrel export
- 단위 테스트 (easing 수치, mixHex 경계값)
- **검증**: `npm run test:run -- easing colorMix`

### Step 2 — RAF Engine
- `motion/stepperMotionEngine.ts`
- 단위 테스트 (RAF mock 셋업 포함)

#### RAF/timer mocking 셋업

```ts
import { afterEach, beforeEach, vi } from 'vitest';

let now = 0;
const rafCallbacks: Array<(t: number) => void> = [];

beforeEach(() => {
  now = 0;
  rafCallbacks.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks[id - 1] = () => undefined;
  });
  vi.stubGlobal('performance', { now: () => now });
});

afterEach(() => { vi.unstubAllGlobals(); });

const tick = (deltaMs: number) => {
  now += deltaMs;
  const cbs = rafCallbacks.splice(0);
  cbs.forEach(cb => cb(now));
};
```

DOM ref 는 `document.createElement('div')` mock. `getBoundingClientRect()` 는 spy 로 length 주입.

테스트 케이스:
- dir === 0 → onDone 즉시
- dir > 0 → fill scaleX 1까지, transformOrigin = 'left center'
- dir < 0 → fill scaleX 0까지, transformOrigin = 'left center'
- Step1→Step3 forward: connector 0 handoff < connector 1 handoff
- Step3→Step1 backward: source step (Step3) 색 즉시 전환
- cleanup 호출 시 모든 inline style 비워짐

### Step 3 — ProcessProgressBar (generic)
- `ProcessProgressBar.tsx`
- 단위 테스트:
  - 첫 마운트 RAF 미실행
  - props 변경 시 `runStepperMotion` 호출 (mock)
  - reduced-motion 시 RAF 미호출
  - 같은 snapshot 재렌더 시 RAF 미호출
  - unmount 시 cleanup 호출

### Step 4 — Domain adapter
- `InstallationProcessProgressBar.tsx`
- `toSteps` 모든 ProcessStatus 값 검증

### Step 5 — Consumer migration
- `ProcessStatusCard.tsx`, `GuidePreviewPanel.tsx` import 갱신
- `app/components/features/process-status/index.ts` deprecation alias:
  ```ts
  export const StepProgressBar = InstallationProcessProgressBar;
  ```

### Step 6 — 시각 검증
- `npm run dev`
- 실제 consumer (`ProcessStatusCard`, `GuidePreviewPanel`) 페이지에서 시나리오 확인
  - mock seed 또는 dev 도구로 `currentStep` 변경: 단일 진행 / 1→3 / 3→1 / 1→7
- `design/ProcessBar Motion Prototype.html` Slow-mo ON 상태와 split-screen 비교 (AC18)
- macOS "동작 줄이기" ON 상태 검증
- 회귀 없음 확인

### Step 7 — 정리
- `StepIndicator.tsx` 통합 follow-up 메모
- 단위 테스트 전체 green
- lint / tsc 통과

---

## 9. 영향 범위

### Consumer (시그니처 변경 없음)
- `app/components/features/ProcessStatusCard.tsx`
- `app/integration/admin/guides/components/GuidePreviewPanel.tsx`

### 새 도입
- `lib/hooks/useReducedMotion.ts`, `useIsomorphicLayoutEffect.ts`
- `app/components/ui/icons/CheckIcon.tsx`
- `lib/theme.ts` 의 `colorRaw`, `motion`
- `app/components/features/process-status/motion/*`
- `ProcessProgressBar`, `InstallationProcessProgressBar`

### Deprecate
- `StepProgressBar` → alias 1 cycle 후 제거
- `customSteps` prop → 외부 사용처 0건, 다음 cycle 제거
- `StepIndicator.tsx` 통합 → follow-up

---

## 10. 비-목표

- `StepIndicator.tsx` 통합 (follow-up issue)
- `ProcessGuideTimeline.tsx` 의 inline SVG 정리 (별도 PR)
- spring physics, sound, haptic
- multiplier knob (`speedMultiplier: 3`) — 직접 baked-in
- ResizeObserver 통한 mid-flight length 재측정

---

## 11. 위험 / Open Questions

1. **Tailwind 4 동적 hex class**: `bg-[${colorRaw.success}]` 가 정적 분석으로 인식되는지 구현 시 검증. 안 되면 globals.css 의 CSS variable 또는 modular CSS 사용.
2. **Slow N=15 점프 3.6초**: 사용자가 답답함 느끼면 fillMsMax 를 3000 정도로 조정 가능 (한 줄 변경).
3. **prototype CSS 가 Tailwind 토큰과 어긋날 때**: prototype = source of truth (사용자 결정). theme 토큰이 부족하면 `colorRaw` 에 추가.

---

## 12. Toss Heuristics 적용 매핑

| 원칙 | 본 구현에서의 발현 |
|---|---|
| 인과성 | 단일 wave-front position 이 모든 변화의 원인 |
| 순차성 | wave 가 좌→우(또는 역)로 이동하며 cascade |
| 자연스러운 easing | fill: ease-out-quart, circle: cubic-bezier(0.2, 0, 0, 1), crossfade: cubic-bezier(0.33, 1, 0.68, 1) |
| 색 = 신호 | gray → primary → success, RGB 보간 |
| micro-reward | circle scale pulse 0.06 amplitude, check icon fade-in |
| 양방향 대칭 | dir > 0 / dir < 0 모두 origin 'left center', scale 0→1 / 1→0 |
| 가변 N 동질감 | distance 기반 duration scaling, easing 무관 |
| **Slow 인지** | 3× 시간 상수 — wave 흐름을 사용자가 충분히 인지 |
| 인터럽트 자연 | cleanup → finalize() → 새 RAF |

---

## 13. 디자인 reference

`design/ProcessBar Motion Prototype.html` 의 **Slow-mo (×3) 토글 ON 상태**가 본 구현의 시각·속도 spec.

prototype 을 브라우저에서 열고 "Slow-mo" 체크 → 시나리오 버튼으로 모든 패턴 확인 가능. 구현 결과물(`ProcessStatusCard`, `GuidePreviewPanel` 등 실제 consumer)은 prototype 과 시각 인지 차이 없음을 목표.

별도 데모 페이지는 만들지 않는다 — prototype HTML 로 시각 검증 충분.
