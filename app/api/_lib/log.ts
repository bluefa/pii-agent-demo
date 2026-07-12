/**
 * Structured stdout logging (observability v3 — "errors are logs").
 *
 * Emits exactly one `JSON.stringify`'d line per event so the platform logging
 * agent (Cloud Logging / Stackdriver) can ingest it. `severity>=ERROR` entries
 * put the full stack in `message` — GCP Error Reporting groups on that field.
 * No dependency: `console.log` is the only sink.
 */

type AccessFields = {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId: string;
  clientPage?: string;
  clientAction?: string;
};

function emit(severity: 'ERROR' | 'INFO', message: string, fields: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    severity,
    message,
    time: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) entry[key] = value;
  }
  console.log(JSON.stringify(entry));
}

/**
 * `message` must contain the full stack trace for Error Reporting grouping.
 * Fields may carry structured values (e.g. client breadcrumbs) — they are
 * serialized as-is into the JSON line.
 */
export function logError(message: string, fields: Record<string, unknown> = {}): void {
  emit('ERROR', message, fields);
}

export function logAccess(fields: AccessFields): void {
  const { method, path, status, durationMs } = fields;
  emit('INFO', `${method} ${path} ${status} ${durationMs}ms`, fields);
}

/** Full stack when the thrown value is an `Error`, else a stable string. */
export function errorStack(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return `Non-Error thrown: ${String(error)}`;
}
