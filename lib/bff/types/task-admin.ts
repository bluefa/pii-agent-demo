/**
 * Typed shapes for `bff.taskAdmin` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 */

import type {
  ApprovalRequestQueueResponse,
  ApprovalRequestQueueItem,
  PageInfoWithCounts,
} from '@/lib/types/queue-board';

export type {
  ApprovalRequestQueueResponse,
  ApprovalRequestQueueItem,
  PageInfoWithCounts,
};

/** GET /task-admin/approval-requests (camelCase). */
export type TaskAdminApprovalRequestsResponse = ApprovalRequestQueueResponse;
