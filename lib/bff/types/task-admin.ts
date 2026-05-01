/**
 * Typed shapes for `bff.taskAdmin` methods (ADR-011 setup spec adr011-01).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
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

/** GET /task-admin/approval-requests. */
export type TaskAdminApprovalRequestsResponse = ApprovalRequestQueueResponse;
