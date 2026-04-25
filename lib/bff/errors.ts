export class BffError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BffError';
  }
}

/** Legacy error body shapes accepted by `transformLegacyError`. */
export interface LegacyErrorBody {
  error?: string | { code?: string; message?: string };
  code?: string;
  message?: string;
}

/**
 * Extracts `{ code, message }` from any of the three legacy upstream error
 * shapes:
 *   1. nested `{ error: { code, message } }`
 *   2. flat   `{ error: 'CODE', message }`
 *   3. flat   `{ code: 'CODE', message }`
 *
 * Used by `httpBff` / `mockBff` to construct `BffError` instances that map
 * back to ProblemDetails byte-identically (ADR-011 I-4).
 */
export function extractLegacyError(body: LegacyErrorBody): { code: string; message: string } {
  if (body.error && typeof body.error === 'object') {
    return {
      code: body.error.code ?? '',
      message: body.error.message ?? '',
    };
  }
  if (typeof body.error === 'string') {
    return { code: body.error, message: body.message ?? '' };
  }
  return { code: body.code ?? '', message: body.message ?? '' };
}
