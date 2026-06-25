/**
 * Typed shapes for `bff.confirm` methods (ADR-011).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use snake_case (raw wire, validated by schemas.X.parse at route).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

export type {
  ApprovalRequestCreateBody,
  BffApprovalProcessStatus,
  ApprovalHealthStatus,
  ApprovalActorDto,
  ResourceConfigDto,
  ExcludedResourceInfoDto,
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
