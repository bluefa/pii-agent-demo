import { describe, it, expect, vi } from 'vitest';
import type { Project } from '@/lib/types';

vi.mock('@/lib/mock-data', () => ({
  getProjectByTargetSourceId: vi.fn(),
}));

import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { getProjectByTargetSourceId } from '@/lib/mock-data';

const mockedGetProjectByTargetSourceId = vi.mocked(getProjectByTargetSourceId);

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

describe('resolveProject', () => {
  it('존재하지 않는 targetSourceId는 TARGET_SOURCE_NOT_FOUND를 반환한다', () => {
    mockedGetProjectByTargetSourceId.mockReturnValue(undefined);

    const result = resolveProject(9999, 'req');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.code).toBe('TARGET_SOURCE_NOT_FOUND');
    }
  });

  it('존재하는 targetSourceId는 project를 반환한다', () => {
    const fakeProject = { id: 'proj-1', targetSourceId: 1001 } as Project;
    mockedGetProjectByTargetSourceId.mockReturnValue(fakeProject);

    const result = resolveProject(1001, 'req');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project).toBe(fakeProject);
    }
  });
});
