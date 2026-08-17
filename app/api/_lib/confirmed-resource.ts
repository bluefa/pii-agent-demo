import { createProblem, type ProblemDetails } from '@/app/api/_lib/problem';
import type { ConfirmedResourceProvider } from '@/lib/bff/types';

/**
 * `?provider=` — swagger declares four upstream paths (`…/{aws|gcp|azure|idc}-resources`)
 * that differ only in that segment. The routes mirroring them share this allowlist so the
 * set of valid providers is stated once: a value that reaches the BFF picks a path, and a
 * path that does not exist is a 404 the operator cannot act on.
 */
export const CONFIRMED_RESOURCE_PROVIDERS: readonly ConfirmedResourceProvider[] = [
  'AWS',
  'GCP',
  'AZURE',
  'IDC',
];

export const readConfirmedResourceProvider = (
  request: Request,
): ConfirmedResourceProvider | null => {
  const raw = new URL(request.url).searchParams.get('provider')?.toUpperCase() ?? '';
  return CONFIRMED_RESOURCE_PROVIDERS.find((provider) => provider === raw) ?? null;
};

export const confirmedResourceProviderProblem = (requestId: string): ProblemDetails =>
  createProblem(
    'INVALID_PARAMETER',
    `provider는 ${CONFIRMED_RESOURCE_PROVIDERS.join(' | ')} 중 하나여야 합니다.`,
    requestId,
  );

/**
 * 계약이 요청 본문에 요구하는 것은 "JSON object" 하나뿐이다(`type: object`, required,
 * 속성 없음). 그 최소 조건만 여기서 지킨다 — 못 읽는 JSON·배열·스칼라를 그대로 흘리면
 * 거절이 BFF 의 몫이 되고, 속성 검증까지 하면 계약에 없는 스키마를 발명하게 된다.
 */
export const confirmedResourceBodyProblem = (requestId: string): ProblemDetails =>
  createProblem('INVALID_PARAMETER', '요청 본문은 JSON object여야 합니다.', requestId);
