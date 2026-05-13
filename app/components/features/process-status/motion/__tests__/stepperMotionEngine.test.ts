// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { motion } from '@/lib/theme';
import {
  runStepperMotion,
  type StepState,
} from '@/app/components/features/process-status/motion/stepperMotionEngine';

let now = 0;
let nextRafId = 1;
const rafCallbacks = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  now = 0;
  nextRafId = 1;
  rafCallbacks.clear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
  vi.stubGlobal('performance', { now: () => now });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const tick = (deltaMs: number) => {
  now += deltaMs;
  const cbs = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  cbs.forEach(([, cb]) => cb(now));
};

const tickUntilEmpty = (maxIters = 200) => {
  let i = 0;
  while (rafCallbacks.size > 0 && i < maxIters) {
    tick(16);
    i++;
  }
};

const makeEl = (width = 200): HTMLElement => {
  const track = document.createElement('div');
  const fill = document.createElement('div');
  track.appendChild(fill);
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 2,
    top: 0,
    left: 0,
    right: width,
    bottom: 2,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return fill;
};

interface BuiltRun {
  fromIndex: number;
  toIndex: number;
  fromStates: StepState[];
  toStates: StepState[];
  fillRefs: HTMLElement[];
  circleRefs: HTMLElement[];
  iconNumberRefs: HTMLElement[];
  iconCheckRefs: HTMLElement[];
}

const buildRun = (
  fromIndex: number,
  toIndex: number,
  fromStates: StepState[],
  toStates: StepState[],
  options: { connectorWidth?: number } = {},
): BuiltRun => {
  const n = fromStates.length;
  return {
    fromIndex,
    toIndex,
    fromStates,
    toStates,
    fillRefs: Array.from({ length: n - 1 }, () =>
      makeEl(options.connectorWidth ?? 200),
    ),
    circleRefs: Array.from({ length: n }, () =>
      document.createElement('div'),
    ),
    iconNumberRefs: Array.from({ length: n }, () =>
      document.createElement('span'),
    ),
    iconCheckRefs: Array.from({ length: n }, () =>
      document.createElement('span'),
    ),
  };
};

const extractScaleX = (transform: string): number => {
  const m = transform.match(/scaleX\(([\d.]+)\)/);
  expect(m).not.toBeNull();
  return Number(m ? m[1] : '0');
};

describe('runStepperMotion', () => {
  it('calls onDone immediately when dir === 0', () => {
    const onDone = vi.fn();
    const run = buildRun(2, 2, ['pending', 'pending', 'current'], [
      'pending',
      'pending',
      'current',
    ]);
    runStepperMotion({ ...run, onDone });
    expect(onDone).toHaveBeenCalledOnce();
    expect(rafCallbacks.size).toBe(0);
  });

  it('applies t=0 frame synchronously before any RAF tick', () => {
    // Guards against regressions in transition-deferred layout effects:
    // Next.js App Router navigation runs inside startTransition, where the
    // useLayoutEffect → RAF chain is not guaranteed to fire before the first
    // paint. The engine must lock in the "from" visual state synchronously so
    // entry animation looks the same regardless of mount path.
    const run = buildRun(
      0,
      2,
      ['pending', 'pending', 'pending'],
      ['completed', 'completed', 'current'],
    );
    runStepperMotion(run);
    // No tick — styles must already reflect the t=0 (all-pending) frame.
    expect(run.fillRefs[0].style.transform).toBe('scaleX(0)');
    expect(run.fillRefs[0].style.transformOrigin).toBe('left center');
    expect(run.circleRefs[0].style.backgroundColor).not.toBe('');
  });

  it('forward: fill ends at scaleX(1), origin left center', () => {
    const run = buildRun(
      0,
      1,
      ['current', 'pending'],
      ['completed', 'current'],
    );
    runStepperMotion(run);
    tickUntilEmpty();

    const fill = run.fillRefs[0];
    expect(fill.style.transformOrigin).toBe('left center');
    // finalize() pins inline transform to the target so React's same-value
    // style prop doesn't get diff-skipped, leaving the DOM at CSS default.
    expect(fill.style.transform).toBe('scaleX(1)');
  });

  it('forward: mid-flight produces partial scaleX', () => {
    const run = buildRun(
      0,
      1,
      ['current', 'pending'],
      ['completed', 'current'],
    );
    runStepperMotion(run);
    // single tick (no time advance) yields t=0
    tick(0);
    expect(run.fillRefs[0].style.transform).toBe('scaleX(0)');

    // advance to mid duration
    const mid = motion.fillMsMin / 2;
    tick(mid);
    const value = extractScaleX(run.fillRefs[0].style.transform);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });

  it('backward: fill drains via scaleX(1 -> 0), origin still left center', () => {
    const run = buildRun(
      1,
      0,
      ['completed', 'current'],
      ['current', 'pending'],
    );
    runStepperMotion(run);
    tick(0);
    const fill = run.fillRefs[0];
    expect(fill.style.transformOrigin).toBe('left center');
    expect(fill.style.transform).toBe('scaleX(1)');

    tickUntilEmpty();
    // toStates[0] = 'current' → outgoing connector is not filled.
    expect(fill.style.transform).toBe('scaleX(0)');
  });

  it('Step1 -> Step3 jump: connector 0 reaches arrival before connector 1', () => {
    const run = buildRun(
      0,
      2,
      ['current', 'pending', 'pending'],
      ['completed', 'completed', 'current'],
    );
    runStepperMotion(run);
    tick(0);

    // Initial frame both fills should be at 0
    expect(run.fillRefs[0].style.transform).toBe('scaleX(0)');
    expect(run.fillRefs[1].style.transform).toBe('scaleX(0)');

    // Advance partway. wave-front travels left -> right.
    tick(200);
    const f0 = extractScaleX(run.fillRefs[0].style.transform);
    const f1 = extractScaleX(run.fillRefs[1].style.transform);
    expect(f0).toBeGreaterThan(f1);
  });

  it('Step3 -> Step1 backward: connector 1 drains before connector 0', () => {
    const run = buildRun(
      2,
      0,
      ['completed', 'completed', 'current'],
      ['current', 'pending', 'pending'],
    );
    runStepperMotion(run);
    tick(0);

    expect(run.fillRefs[0].style.transform).toBe('scaleX(1)');
    expect(run.fillRefs[1].style.transform).toBe('scaleX(1)');

    tick(300);
    const f0 = extractScaleX(run.fillRefs[0].style.transform);
    const f1 = extractScaleX(run.fillRefs[1].style.transform);
    // connector 1 (right) drains first -> smaller scale than connector 0
    expect(f1).toBeLessThan(f0);
  });

  it('source step transitions from t=0 in forward direction', () => {
    const run = buildRun(
      0,
      1,
      ['current', 'pending'],
      ['completed', 'current'],
    );
    runStepperMotion(run);
    tick(50);
    expect(run.circleRefs[0].style.backgroundColor).not.toBe('');
  });

  it('source step transitions from t=0 in backward direction', () => {
    const run = buildRun(
      1,
      0,
      ['completed', 'current'],
      ['current', 'pending'],
    );
    runStepperMotion(run);
    tick(50);
    expect(run.circleRefs[1].style.backgroundColor).not.toBe('');
  });

  it('cleanup() snaps inline styles to toStates even mid-flight', () => {
    const run = buildRun(
      0,
      2,
      ['current', 'pending', 'pending'],
      ['completed', 'completed', 'current'],
    );
    const cleanup = runStepperMotion(run);
    tick(100);

    // Mid-flight there should be inline styles set
    expect(run.fillRefs[0].style.transform).not.toBe('');

    cleanup();

    // Fills pin to scaleX(1)/scaleX(0) based on toStates so React's diffing
    // doesn't skip a re-apply that would otherwise leave CSS-default scaleX(1)
    // showing on pending connectors.
    expect(run.fillRefs[0].style.transform).toBe('scaleX(1)');
    expect(run.fillRefs[1].style.transform).toBe('scaleX(1)');
    // Circles still hand back to Tailwind className for color.
    run.circleRefs.forEach((el) => {
      expect(el.style.transform).toBe('');
      expect(el.style.backgroundColor).toBe('');
      expect(el.style.color).toBe('');
    });
    // Icons must end up showing exactly one span per step.
    expect(run.iconNumberRefs[0].style.opacity).toBe('0');
    expect(run.iconCheckRefs[0].style.opacity).toBe('1');
    expect(run.iconNumberRefs[1].style.opacity).toBe('0');
    expect(run.iconCheckRefs[1].style.opacity).toBe('1');
    expect(run.iconNumberRefs[2].style.opacity).toBe('1');
    expect(run.iconCheckRefs[2].style.opacity).toBe('0');
  });

  it('virtual edges (negative or beyond fillRefs.length) are filtered', () => {
    // prevIndex = -1 (all pending) -> activeIndex = 0
    // raw edges = [-1] (filtered out). Distance becomes sum of empty = 0,
    // engine still runs but does nothing meaningful with fills.
    const run = buildRun(
      -1,
      0,
      ['pending', 'pending'],
      ['current', 'pending'],
    );
    expect(() => runStepperMotion(run)).not.toThrow();
  });

  it('icon crossfade: number fades out, check fades in on completion', () => {
    const run = buildRun(
      0,
      1,
      ['current', 'pending'],
      ['completed', 'current'],
    );
    runStepperMotion(run);
    // tick to pass the handoff threshold
    tick(motion.fillMsMin * 0.7);
    const numOp = Number(run.iconNumberRefs[0].style.opacity);
    const chkOp = Number(run.iconCheckRefs[0].style.opacity);
    expect(numOp + chkOp).toBeGreaterThan(0.95);
    expect(numOp + chkOp).toBeLessThanOrEqual(1.05);
  });

  it('7-step entry to index 4: trailing fills pin to scaleX(0), icons split correctly', () => {
    // Regression: previously finalize() cleared transform/opacity, exposing
    // CSS defaults (scaleX(1), opacity 1) on fills/icons that the engine
    // never touched. Result was a green line all the way to step 7 and
    // every step showing number + check at the same time.
    const fromStates: StepState[] = Array(7).fill('pending');
    const toStates: StepState[] = [
      'completed',
      'completed',
      'completed',
      'completed',
      'current',
      'pending',
      'pending',
    ];
    const run = buildRun(0, 4, fromStates, toStates);
    runStepperMotion(run);
    tickUntilEmpty();

    expect(run.fillRefs[0].style.transform).toBe('scaleX(1)');
    expect(run.fillRefs[1].style.transform).toBe('scaleX(1)');
    expect(run.fillRefs[2].style.transform).toBe('scaleX(1)');
    expect(run.fillRefs[3].style.transform).toBe('scaleX(1)');
    expect(run.fillRefs[4].style.transform).toBe('scaleX(0)');
    expect(run.fillRefs[5].style.transform).toBe('scaleX(0)');

    [0, 1, 2, 3].forEach((i) => {
      expect(run.iconNumberRefs[i].style.opacity).toBe('0');
      expect(run.iconCheckRefs[i].style.opacity).toBe('1');
    });
    [4, 5, 6].forEach((i) => {
      expect(run.iconNumberRefs[i].style.opacity).toBe('1');
      expect(run.iconCheckRefs[i].style.opacity).toBe('0');
    });
  });

  it('returns no-op cleanup when dir === 0', () => {
    const onDone = vi.fn();
    const run = buildRun(0, 0, ['current'], ['current']);
    const cleanup = runStepperMotion({ ...run, onDone });
    expect(typeof cleanup).toBe('function');
    cleanup();
    // cleanup should not throw or affect onDone count
    expect(onDone).toHaveBeenCalledOnce();
  });
});
