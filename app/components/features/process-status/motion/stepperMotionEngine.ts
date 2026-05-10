import { motion } from '@/lib/theme';
import { mixHex } from '@/app/components/features/process-status/motion/colorMix';
import {
  clamp01,
  easeOutCubic,
  easeOutQuart,
  invEaseOutQuart,
} from '@/app/components/features/process-status/motion/easing';

export type StepState = 'completed' | 'current' | 'pending';

export interface MotionRun {
  fromIndex: number;
  toIndex: number;
  fromStates: readonly StepState[];
  toStates: readonly StepState[];
  fillRefs: ReadonlyArray<HTMLElement | null>;
  circleRefs: ReadonlyArray<HTMLElement | null>;
  iconNumberRefs: ReadonlyArray<HTMLElement | null>;
  iconCheckRefs: ReadonlyArray<HTMLElement | null>;
  onDone?: () => void;
}

const stateColor = (s: StepState): string =>
  s === 'completed'
    ? motion.colors.completedBg
    : s === 'current'
      ? motion.colors.currentBg
      : motion.colors.pendingBg;

const stateTextColor = (s: StepState): string =>
  s === 'pending' ? motion.colors.pendingText : motion.colors.activeText;

const finalize = (run: MotionRun): void => {
  run.circleRefs.forEach((el) => {
    if (!el) return;
    el.style.backgroundColor = '';
    el.style.color = '';
    el.style.transform = '';
  });
  run.fillRefs.forEach((el) => {
    if (!el) return;
    el.style.transform = '';
  });
  run.iconNumberRefs.forEach((el) => {
    if (el) el.style.opacity = '';
  });
  run.iconCheckRefs.forEach((el) => {
    if (el) el.style.opacity = '';
  });
};

export const runStepperMotion = (run: MotionRun): (() => void) => {
  const {
    fromIndex,
    toIndex,
    fromStates,
    toStates,
    fillRefs,
    circleRefs,
    iconNumberRefs,
    iconCheckRefs,
    onDone,
  } = run;

  const dir = Math.sign(toIndex - fromIndex);
  if (dir === 0) {
    onDone?.();
    return () => undefined;
  }

  const edgeCount = Math.abs(toIndex - fromIndex);
  const firstEdge = dir > 0 ? fromIndex : fromIndex - 1;
  const rawEdges = Array.from({ length: edgeCount }, (_, k) => firstEdge + k * dir);
  // Connector index ∈ [0, fillRefs.length - 1]. Strip virtual endpoints (-1, len-1).
  const edges = rawEdges.filter((e) => e >= 0 && e < fillRefs.length);

  const lengths = edges.map((e) => {
    const fill = fillRefs[e];
    const track = fill?.parentElement;
    return track?.getBoundingClientRect().width ?? 1;
  });
  const starts = lengths.map((_, i) =>
    lengths.slice(0, i).reduce((sum, n) => sum + n, 0),
  );
  const distance = lengths.reduce((sum, n) => sum + n, 0);

  const duration = Math.min(
    motion.fillMsMax,
    Math.max(
      motion.fillMsMin,
      distance / motion.baseSpeed + (edgeCount - 1) * motion.stepBonus,
    ),
  );

  let frame = 0;
  let cancelled = false;
  const startTime = performance.now();

  const draw = (now: number): void => {
    if (cancelled) return;
    const elapsed = now - startTime;
    const t = clamp01(elapsed / duration);
    const front = easeOutQuart(t) * distance;

    edges.forEach((edge, order) => {
      const local = clamp01((front - starts[order]) / lengths[order]);

      const fill = fillRefs[edge];
      if (fill) {
        fill.style.transformOrigin = 'left center';
        fill.style.transform = `scaleX(${dir > 0 ? local : 1 - local})`;
      }

      const handoffElapsed =
        invEaseOutQuart(
          (starts[order] + lengths[order] * motion.visualHandoff) / distance,
        ) * duration;
      const circleT = easeOutCubic(
        clamp01((elapsed - handoffElapsed) / motion.circleMs),
      );

      const targetIdx = dir > 0 ? edge + 1 : edge;
      const fromS = fromStates[targetIdx];
      const toS = toStates[targetIdx];
      const circle = circleRefs[targetIdx];

      if (circle && fromS !== toS) {
        circle.style.backgroundColor = mixHex(
          stateColor(fromS),
          stateColor(toS),
          circleT,
        );
        circle.style.color = mixHex(
          stateTextColor(fromS),
          stateTextColor(toS),
          circleT,
        );
        const pulse = 1 + motion.pulseAmplitude * Math.sin(Math.PI * circleT);
        circle.style.transform = `scale(${pulse})`;
      }

      const numEl = iconNumberRefs[targetIdx];
      const chkEl = iconCheckRefs[targetIdx];
      const wantsCheck = toS === 'completed';
      const hadCheck = fromS === 'completed';
      if (wantsCheck !== hadCheck && numEl && chkEl) {
        const fade = clamp01(
          (elapsed - handoffElapsed) / motion.iconCrossfadeMs,
        );
        if (wantsCheck) {
          numEl.style.opacity = String(1 - fade);
          chkEl.style.opacity = String(fade);
        } else {
          numEl.style.opacity = String(fade);
          chkEl.style.opacity = String(1 - fade);
        }
      }
    });

    // Source step (departing): immediate transition both directions
    const srcIdx = fromIndex;
    if (
      srcIdx >= 0 &&
      srcIdx < toStates.length &&
      fromStates[srcIdx] !== toStates[srcIdx]
    ) {
      const tail = easeOutCubic(clamp01(elapsed / motion.circleMs));
      const srcCircle = circleRefs[srcIdx];
      if (srcCircle) {
        srcCircle.style.backgroundColor = mixHex(
          stateColor(fromStates[srcIdx]),
          stateColor(toStates[srcIdx]),
          tail,
        );
        srcCircle.style.color = mixHex(
          stateTextColor(fromStates[srcIdx]),
          stateTextColor(toStates[srcIdx]),
          tail,
        );
      }
      const numEl = iconNumberRefs[srcIdx];
      const chkEl = iconCheckRefs[srcIdx];
      const wasCheck = fromStates[srcIdx] === 'completed';
      const willCheck = toStates[srcIdx] === 'completed';
      if (numEl && chkEl && wasCheck !== willCheck) {
        const fade = clamp01(elapsed / motion.iconCrossfadeMs);
        if (willCheck) {
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
      finalize(run);
      onDone?.();
    }
  };

  frame = requestAnimationFrame(draw);

  return () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(frame);
    finalize(run);
  };
};
