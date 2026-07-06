export class BffError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly timestamp?: string,
  ) {
    super(message);
    this.name = 'BffError';
  }
}

/**
 * The pipeline-orchestrator upstream could not be reached (connection refused,
 * DNS failure, timeout, socket reset). Distinct from an HTTP error response —
 * the orchestrator pipeline methods return `{status, body}` verbatim for any
 * HTTP status, and only throw this when there is no response at all.
 * `withOrchestratorProxy` maps it to 502 `ORCHESTRATOR_UNREACHABLE`.
 */
export class OrchestratorUnreachableError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OrchestratorUnreachableError';
  }
}
