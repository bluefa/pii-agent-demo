import { describe, expect, it } from 'vitest';
import { connectorClass, nodeStateClass } from '@/app/integration/admin/pipelines/_detail/flowClasses';
import type { TaskStatus } from '@/lib/pipeline/types';

describe('nodeStateClass', () => {
  it.each([
    ['DONE', 's-done'],
    ['IN_PROGRESS', 's-running'],
    ['READY', 's-ready'],
    ['BLOCKED', 's-queued'],
    ['FAILED', 's-failed'],
    ['CANCELLED', 's-cancelled'],
  ] as Array<[TaskStatus, string]>)('%s → %s', (status, cls) => {
    expect(nodeStateClass(status)).toBe(cls);
  });
});

describe('connectorClass — prev-DONE matrix', () => {
  const ALL: TaskStatus[] = ['BLOCKED', 'READY', 'IN_PROGRESS', 'DONE', 'FAILED', 'CANCELLED'];

  it('is plain (empty) whenever the previous task is not DONE', () => {
    for (const prev of ALL.filter((s) => s !== 'DONE')) {
      for (const cur of ALL) {
        expect(connectorClass(prev, cur)).toBe('');
      }
    }
  });

  it('lights the edge only once the previous task is DONE', () => {
    expect(connectorClass('DONE', 'DONE')).toBe('done');
    expect(connectorClass('DONE', 'FAILED')).toBe('toFail');
    // Everything else "in flight / queued" after a DONE upstream is the active edge.
    expect(connectorClass('DONE', 'IN_PROGRESS')).toBe('active');
    expect(connectorClass('DONE', 'READY')).toBe('active');
    expect(connectorClass('DONE', 'BLOCKED')).toBe('active');
    expect(connectorClass('DONE', 'CANCELLED')).toBe('active');
  });
});
