import type { Project } from '@/lib/types';

export interface TargetSourceEnvelopeResponse {
  targetSource: Project;
}

export interface TargetSourceSnakeEnvelopeResponse {
  target_source: Project;
}

export interface LegacyProjectEnvelopeResponse {
  project: Project;
}

export type TargetSourceDetailResponse =
  | Project
  | TargetSourceEnvelopeResponse
  | TargetSourceSnakeEnvelopeResponse
  | LegacyProjectEnvelopeResponse;

export const extractTargetSource = (payload: TargetSourceDetailResponse): Project => {
  if ('targetSource' in payload) return payload.targetSource;
  if ('target_source' in payload) return payload.target_source;
  if ('project' in payload) return payload.project;
  return payload;
};
