// @vitest-environment jsdom

import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  ProcessProgressBar,
  type ProgressBarStep,
} from '@/app/components/features/process-status/ProcessProgressBar';

const runStepperMotionMock = vi.fn();
const resetStepperToStatesMock = vi.fn();

vi.mock(
  '@/app/components/features/process-status/motion/stepperMotionEngine',
  () => ({
    runStepperMotion: (...args: unknown[]) => runStepperMotionMock(...args),
    resetStepperToStates: (...args: unknown[]) =>
      resetStepperToStatesMock(...args),
  }),
);

let matches = false;
const mqListeners = new Set<() => void>();

beforeEach(() => {
  matches = false;
  mqListeners.clear();
  runStepperMotionMock.mockReset();
  runStepperMotionMock.mockReturnValue(() => undefined);
  resetStepperToStatesMock.mockReset();
  vi.stubGlobal('matchMedia', (_q: string) => ({
    matches,
    media: _q,
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => mqListeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) =>
      mqListeners.delete(cb),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  // jsdom has window but not matchMedia by default
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: window.matchMedia,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const buildSteps = (n: number, currentIdx: number): ProgressBarStep[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    label: `Step ${i + 1}`,
    state:
      i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'pending',
  }));

describe('ProcessProgressBar', () => {
  it('animates entry from step 1 on first mount when active index >= 1', () => {
    render(
      <ProcessProgressBar steps={buildSteps(7, 2)} ariaLabel="install" />,
    );
    expect(runStepperMotionMock).toHaveBeenCalledOnce();
    const callArg = runStepperMotionMock.mock.calls[0][0];
    expect(callArg.fromIndex).toBe(0);
    expect(callArg.toIndex).toBe(2);
    expect(callArg.fromStates).toEqual(Array(7).fill('pending'));
  });

  it('re-triggers entry animation under StrictMode (effect double-invoke)', () => {
    // React 18 StrictMode dev runs setup -> cleanup -> setup on mount. The
    // first setup's animation gets cancelled by cleanup; the second setup
    // must restart entry from the synthesized "all pending" snapshot
    // (entryDoneRef stays false until the animation completes naturally).
    // Without the entryDoneRef gate, setup2 would treat entry as already
    // done and snap to the final state — exactly the "fully loaded"
    // symptom seen on Next.js App Router client navigation.
    render(
      <StrictMode>
        <ProcessProgressBar steps={buildSteps(7, 2)} ariaLabel="install" />
      </StrictMode>,
    );
    expect(runStepperMotionMock).toHaveBeenCalledTimes(2);
    const secondArg = runStepperMotionMock.mock.calls[1][0];
    expect(secondArg.fromIndex).toBe(0);
    expect(secondArg.toIndex).toBe(2);
    expect(secondArg.fromStates).toEqual(Array(7).fill('pending'));
  });

  it('does not animate on first mount when active index is 0', () => {
    render(
      <ProcessProgressBar steps={buildSteps(7, 0)} ariaLabel="install" />,
    );
    expect(runStepperMotionMock).not.toHaveBeenCalled();
  });

  it('does not animate entry when prefers-reduced-motion is reduce', () => {
    matches = true;
    render(
      <ProcessProgressBar steps={buildSteps(7, 2)} ariaLabel="install" />,
    );
    expect(runStepperMotionMock).not.toHaveBeenCalled();
  });

  it('snaps refs to the final states under reduced motion (no stuck inline color)', () => {
    // Regression: a motion run that started under a transient reduced=false
    // (SSR hydration reports false before matchMedia resolves) leaves
    // transitioning circles stuck at their t=0 inline color. The reduced-motion
    // path must reset every ref to the final rest state instead.
    matches = true;
    render(
      <ProcessProgressBar steps={buildSteps(7, 2)} ariaLabel="install" />,
    );
    expect(resetStepperToStatesMock).toHaveBeenCalled();
    const arg = resetStepperToStatesMock.mock.calls[0][0];
    expect(arg.states).toEqual([
      'completed',
      'completed',
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('calls runStepperMotion when active index changes', () => {
    const { rerender } = render(
      <ProcessProgressBar steps={buildSteps(7, 0)} ariaLabel="install" />,
    );
    expect(runStepperMotionMock).not.toHaveBeenCalled();
    rerender(
      <ProcessProgressBar steps={buildSteps(7, 2)} ariaLabel="install" />,
    );
    expect(runStepperMotionMock).toHaveBeenCalledOnce();
    const callArg = runStepperMotionMock.mock.calls[0][0];
    expect(callArg.fromIndex).toBe(0);
    expect(callArg.toIndex).toBe(2);
  });

  it('does not re-run when only labels change', () => {
    const initial = buildSteps(7, 2);
    const { rerender } = render(
      <ProcessProgressBar steps={initial} ariaLabel="install" />,
    );
    runStepperMotionMock.mockClear();
    const labelOnly = initial.map((s) => ({ ...s, label: `${s.label}!` }));
    rerender(<ProcessProgressBar steps={labelOnly} ariaLabel="install" />);
    expect(runStepperMotionMock).not.toHaveBeenCalled();
  });

  it('skips animation when prefers-reduced-motion is reduce', () => {
    matches = true;
    const { rerender } = render(
      <ProcessProgressBar steps={buildSteps(7, 0)} ariaLabel="install" />,
    );
    rerender(
      <ProcessProgressBar steps={buildSteps(7, 2)} ariaLabel="install" />,
    );
    expect(runStepperMotionMock).not.toHaveBeenCalled();
  });

  it('triggers when step list length changes (variable N)', () => {
    const { rerender } = render(
      <ProcessProgressBar steps={buildSteps(3, 0)} ariaLabel="onboarding" />,
    );
    rerender(
      <ProcessProgressBar steps={buildSteps(5, 0)} ariaLabel="onboarding" />,
    );
    expect(runStepperMotionMock).toHaveBeenCalledOnce();
  });

  it('renders aria-current="step" on the current item', () => {
    const { container } = render(
      <ProcessProgressBar steps={buildSteps(7, 2)} ariaLabel="install" />,
    );
    const currentLi = container.querySelector('li[aria-current="step"]');
    expect(currentLi).not.toBeNull();
  });

  it('renders nav with the supplied aria-label', () => {
    const { container } = render(
      <ProcessProgressBar steps={buildSteps(3, 1)} ariaLabel="My flow" />,
    );
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('My flow');
  });

  it('cleanup cancels in-flight animation on unmount', () => {
    const cleanup = vi.fn();
    runStepperMotionMock.mockReturnValueOnce(cleanup);
    const { rerender, unmount } = render(
      <ProcessProgressBar steps={buildSteps(7, 0)} ariaLabel="install" />,
    );
    rerender(
      <ProcessProgressBar steps={buildSteps(7, 2)} ariaLabel="install" />,
    );
    unmount();
    expect(cleanup).toHaveBeenCalled();
  });
});
