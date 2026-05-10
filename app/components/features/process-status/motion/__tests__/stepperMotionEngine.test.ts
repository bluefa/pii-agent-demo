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
    // After completion, finalize() clears inline transform.
    expect(fill.style.transform).toBe('');
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
    expect(fill.style.transform).toBe('');
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

  it('cleanup() clears inline styles even mid-flight', () => {
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

    // After cleanup all inline styles cleared
    run.fillRefs.forEach((el) => expect(el.style.transform).toBe(''));
    run.circleRefs.forEach((el) => {
      expect(el.style.transform).toBe('');
      expect(el.style.backgroundColor).toBe('');
      expect(el.style.color).toBe('');
    });
    run.iconNumberRefs.forEach((el) => expect(el.style.opacity).toBe(''));
    run.iconCheckRefs.forEach((el) => expect(el.style.opacity).toBe(''));
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
