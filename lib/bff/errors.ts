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
