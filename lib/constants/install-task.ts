/**
 * Shared install-task card status — the four states an `InstallTaskCard` renders
 * (done/running/failed/pending). Consumed by the GCP/AWS/Azure pipeline mappers
 * so none of them depend on a provider-specific module.
 */
export type InstallTaskStatus = 'done' | 'running' | 'failed' | 'pending';
