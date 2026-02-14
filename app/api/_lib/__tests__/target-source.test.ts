import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/mock-data', () => ({
  getProjectByTargetSourceId: vi.fn(),
  getProjectIdByTargetSourceId: vi.fn(),
}));

import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { getProjectIdByTargetSourceId } from '@/lib/mock-data';

const mockedGetProjectIdByTargetSourceId = vi.mocked(getProjectIdByTargetSourceId);

describe('parseTargetSourceId', () => {
  it('유효한 숫자 문자열을 파싱한다', () => {
    const result = parseTargetSourceId('123', 'req');

    expect(result).toEqual({ ok: true, value: 123 });
  });

  it('숫자가 아닌 문자열은 실패한다', () => {
    const result = parseTargetSourceId('abc', 'req');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.code).toBe('INVALID_PARAMETER');
    }
  });

  it('음수는 실패한다', () => {
    const result = parseTargetSourceId('-1', 'req');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.code).toBe('INVALID_PARAMETER');
    }
  });

  it('0은 실패한다', () => {
    const result = parseTargetSourceId('0', 'req');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.code).toBe('INVALID_PARAMETER');
    }
  });
});

describe('resolveProjectId', () => {
  it('존재하지 않는 targetSourceId는 TARGET_SOURCE_NOT_FOUND를 반환한다', () => {
    mockedGetProjectIdByTargetSourceId.mockReturnValue(undefined);

    const result = resolveProjectId(9999, 'req');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.code).toBe('TARGET_SOURCE_NOT_FOUND');
    }
  });

  it('존재하는 targetSourceId는 projectId를 반환한다', () => {
    mockedGetProjectIdByTargetSourceId.mockReturnValue('proj-1');

    const result = resolveProjectId(1001, 'req');

    expect(result).toEqual({ ok: true, projectId: 'proj-1' });
  });
});
