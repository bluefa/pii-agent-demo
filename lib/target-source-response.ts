import type { Project } from '@/lib/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const extractTargetSource = (payload: unknown): Project => {
  if (!isRecord(payload)) return payload as Project;

  const nested = payload.targetSource ?? payload.target_source ?? payload.project;
  return (nested ?? payload) as Project;
};
