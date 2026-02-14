import {
  getProjectByTargetSourceId,
  getProjectIdByTargetSourceId,
} from '@/lib/mock-data';
import type { Project } from '@/lib/types';
import type { ProblemDetails } from '@/app/api/_lib/problem';
import { createProblem } from '@/app/api/_lib/problem';

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

export function resolveProjectId(
  targetSourceId: number,
  requestId: string,
): { ok: true; projectId: string } | { ok: false; problem: ProblemDetails } {
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

export function resolveProject(
  targetSourceId: number,
  requestId: string,
): { ok: true; project: Project } | { ok: false; problem: ProblemDetails } {
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
