/**
 * Typed shapes for `bff.confirm` methods (ADR-011 setup spec adr011-01).
 *
 * The `Issue222*` prefix is preserved per adr011-README cross-cutting
 * decision #4 (project-wide rename deferred to adr011-05 optional appendix).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

export type {
  ApprovalRequestCreateBody,
  ApprovalRequestResourceInput,
  Issue222ApprovalStatus,
  Issue222ProcessStatus,
  Issue222HealthStatus,
  Issue222ActorDto,
  Issue222ResourceConfigDto,
  Issue222ExcludedResourceInfo,
  Issue222ApprovalRequestSummaryDto,
  Issue222ApprovalActionResponseDto,
  Issue222ApprovalHistoryItemDto,
  Issue222ApprovalHistoryPageDto,
  Issue222ApprovedIntegrationResponseDto,
  Issue222ConfirmedIntegrationResponse,
  Issue222ProcessStatusResponseDto,
} from '@/lib/issue-222-approval';

export type {
  ConfirmedIntegrationEnvelopeResponse,
  ConfirmedIntegrationResponsePayload,
} from '@/lib/confirmed-integration-response';
export type { BffConfirmedIntegration } from '@/lib/types';

export type {
  ResourceCatalogItemResponse,
  ResourceCatalogResponse,
  ResourceCatalogResponsePayload,
} from '@/lib/resource-catalog-response';
