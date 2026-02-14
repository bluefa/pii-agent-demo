import {
  getProjectByTargetSourceId,
  getProjectIdByTargetSourceId,
} from '@/lib/mock-data';
import type { Project } from '@/lib/types';
import type { ProblemDetails } from '@/app/api/_lib/problem';
import { createProblem } from '@/app/api/_lib/problem';

const IS_MOCK = process.env.USE_MOCK_DATA !== 'false';

type ParseResult =
  | { ok: true; value: number }
  | { ok: false; problem: ProblemDetails };

export function parseTargetSourceId(param: string, requestId: string): ParseResult {
  const id = Number(param);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    return {
      ok: false,
      problem: createProblem(
        'INVALID_PARAMETER',
        `targetSourceId는 양의 정수여야 합니다: "${param}"`,
        requestId,
      ),
    };
  }
  return { ok: true, value: id };
}

/**
 * targetSourceId → projectId 해석.
 * - Mock 모드: mock-data store에서 매핑 조회
 * - BFF 모드: targetSourceId를 string으로 변환하여 그대로 사용 (BFF가 내부 매핑 수행)
 */
export function resolveProjectId(
  targetSourceId: number,
  requestId: string,
): { ok: true; projectId: string } | { ok: false; problem: ProblemDetails } {
  if (!IS_MOCK) {
    return { ok: true, projectId: String(targetSourceId) };
  }

  const projectId = getProjectIdByTargetSourceId(targetSourceId);
  if (!projectId) {
    return {
      ok: false,
      problem: createProblem(
        'TARGET_SOURCE_NOT_FOUND',
        `targetSourceId ${targetSourceId}에 해당하는 리소스를 찾을 수 없습니다.`,
        requestId,
      ),
    };
  }
  return { ok: true, projectId };
}

/**
 * targetSourceId → Project 전체 객체 해석 (Mock 전용).
 * BFF 모드에서 serviceCode가 필요한 라우트는 BFF가 targetSourceId로 직접 처리.
 */
export function resolveProject(
  targetSourceId: number,
  requestId: string,
): { ok: true; project: Project } | { ok: false; problem: ProblemDetails } {
  if (!IS_MOCK) {
    return {
      ok: false,
      problem: createProblem(
        'INTERNAL_ERROR',
        'BFF 모드에서는 targetSourceId → project 해석이 지원되지 않습니다.',
        requestId,
      ),
    };
  }

  const project = getProjectByTargetSourceId(targetSourceId);
  if (!project) {
    return {
      ok: false,
      problem: createProblem(
        'TARGET_SOURCE_NOT_FOUND',
        `targetSourceId ${targetSourceId}에 해당하는 리소스를 찾을 수 없습니다.`,
        requestId,
      ),
    };
  }
  return { ok: true, project };
}
