/**
 * Typed shapes for `bff.confirm` methods (ADR-011).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
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
