import { describe, expect, it } from 'vitest';
import { taskMark } from '@/app/admin/pipelines/_components/taskMark';

describe('taskMark', () => {
  it('gives a definition name the mark of the operation it runs', () => {
    for (const op of ['DELETE_CONFIRMED_RESOURCES', 'CONFIRM_RESOURCES_FROM_RECOMMENDATION'] as const) {
      expect(taskMark(op, null)).toBeDefined();
      expect(taskMark(null, `${op}_V1`)).toBe(taskMark(op, null));
    }
  });

  // Wire sample 2026-10-02: the AWS China install tasks carry operation UNKNOWN,
  // so the definition name is the only thing that tells them apart.
  it('marks the AWS China install tasks by definition when operation is UNKNOWN', () => {
    expect(taskMark('UNKNOWN', 'AWS_SERVICE_ACCOUNT_CREATE_V1')?.icon).toBe('user-plus');
    expect(taskMark('UNKNOWN', 'AWS_CHINA_SECRET_ROTATION_TRIGGER_V1')?.icon).toBe('rotate-ccw-key');
  });

  it('leaves Terraform, condition and unknown tasks to the kind fallback', () => {
    expect(taskMark('AWS_SERVICE_TF_PLAN', 'AWS_SERVICE_PLAN_V1')).toBeUndefined();
    expect(taskMark('NETWORK_READY', 'NETWORK_READY_V1')).toBeUndefined();
    expect(taskMark('UNKNOWN', 'SOMETHING_NEW_V1')).toBeUndefined();
  });
});
