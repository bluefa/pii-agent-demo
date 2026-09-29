import { describe, expect, it } from 'vitest';
import { definitionMark, operationMark } from '@/app/admin/pipelines/_components/taskMark';

describe('taskMark', () => {
  it('gives a definition name the mark of the operation it runs', () => {
    for (const op of [
      'DELETE_CONFIRMED_RESOURCES',
      'CONFIRM_RESOURCES_FROM_RECOMMENDATION',
      'SERVICE_ACCOUNT_CREATE',
      'CHINA_SECRET_ROTATION_TRIGGER',
    ] as const) {
      expect(operationMark(op)).toBeDefined();
      expect(definitionMark(`${op}_V1`)).toBe(operationMark(op));
    }
  });

  it('leaves Terraform and condition tasks to the kind fallback', () => {
    expect(definitionMark('AWS_SERVICE_PLAN_V1')).toBeUndefined();
    expect(definitionMark('NETWORK_READY_V1')).toBeUndefined();
    expect(operationMark('NETWORK_READY')).toBeUndefined();
  });
});
