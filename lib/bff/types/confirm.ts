/**
 * Typed shapes for `bff.confirm` methods (ADR-011).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

export type {
  ApprovalRequestCreateBody,
  ApprovalRequestResourceInput,
  ApprovalStatus,
  BffApprovalProcessStatus,
  ApprovalHealthStatus,
  ApprovalActorDto,
  ResourceConfigDto,
  ExcludedResourceInfoDto,
  ApprovalRequestSummaryDto,
  ApprovalActionResponseDto,
  ApprovalHistoryItemDto,
  ApprovalHistoryPageDto,
  ApprovedIntegrationResponseDto,
  ConfirmedIntegrationApprovalResponse,
  ProcessStatusResponseDto,
} from '@/lib/approval-bff';

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
