/**
 * TaskFlow state-class + connector-class derivation (pure, testable).
 *
 * The prototype (design/pipeline/admin-pipeline.html) maps each TaskStatus to a
 * node state class and derives each connector's class from the PREVIOUS task:
 * a connector only "lights up" once its upstream task is DONE. The class tokens
 * returned here are keyed by the scoped CSS in TaskFlow.tsx.
 */
import type { TaskStatus } from '@/lib/pipeline/types';

/** Node state class per TaskStatus (BLOCKED → dashed s-queued; unknown → s-queued). */
const NODE_STATE_CLASS: Record<TaskStatus, string> = {
  DONE: 's-done',
  IN_PROGRESS: 's-running',
  READY: 's-ready',
  BLOCKED: 's-queued',
  FAILED: 's-failed',
  CANCELLED: 's-cancelled',
};

export function nodeStateClass(status: TaskStatus): string {
  return NODE_STATE_CLASS[status] ?? 's-queued';
}

/**
 * Connector class from the pair (prev, cur). Plain gray unless the previous task
 * is DONE; then the edge reflects where flow is going:
 *  - cur DONE   → 'done'   (green solid)
 *  - cur FAILED → 'toFail' (red dashed)
 *  - else       → 'active' (blue dashed, animated)
 * Returns '' for the plain/idle edge.
 */
export function connectorClass(prev: TaskStatus, cur: TaskStatus): string {
  if (prev !== 'DONE') return '';
  if (cur === 'DONE') return 'done';
  if (cur === 'FAILED') return 'toFail';
  return 'active';
}
