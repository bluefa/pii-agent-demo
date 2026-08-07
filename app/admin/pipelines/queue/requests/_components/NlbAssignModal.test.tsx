// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { NlbAssignModal } from '@/app/admin/pipelines/queue/requests/_components/NlbAssignModal';
import type { NlbTableRow, RequestResourceRow } from '@/app/lib/api/task-queue-requests';

const nlbRows: NlbTableRow[] = [
  { nlbIndex: 1, nlbIpList: ['10.0.0.1'], occupiedListenerCount: 12 },
  { nlbIndex: 2, nlbIpList: ['10.0.0.2'], occupiedListenerCount: 50 },
  { nlbIndex: 3, nlbIpList: ['10.0.0.3'], occupiedListenerCount: 42 },
];

const resource: RequestResourceRow = {
  resourceId: 'idc-r-1',
  resourceName: null,
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'Oracle',
  region: null,
  idcKind: 'IP',
  connectTargets: ['10.20.1.11'],
  port: 1521,
  oracleSid: 'ORCLPDB1',
  sourceIps: [],
  nlbIndex: 3,
  resourceType: null,
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
};

const open = (over: Partial<Parameters<typeof NlbAssignModal>[0]> = {}) => {
  const onSave = vi.fn();
  render(
    <NlbAssignModal
      open
      onClose={() => {}}
      resource={resource}
      rows={nlbRows}
      saving={false}
      onSave={onSave}
      {...over}
    />,
  );
  return onSave;
};

describe('NlbAssignModal', () => {
  /** Picking and saving are one act — 저장 commits, so it must not fire on no change. */
  it('gates 저장 on an actual change', () => {
    const onSave = open();

    const save = screen.getByRole('button', { name: '저장' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'NLB #1 배정' }));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(1);
  });

  /** A full NLB is unpickable — except the one this resource already sits on. */
  it('blocks a Hard-Limit index but keeps the current one selectable', () => {
    open();

    const full = screen.getByRole('radio', { name: 'NLB #2 배정' }) as HTMLInputElement;
    const current = screen.getByRole('radio', { name: 'NLB #3 배정' }) as HTMLInputElement;
    expect(full.disabled).toBe(true);
    expect(current.disabled).toBe(false);
    expect(current.checked).toBe(true);
  });
});
