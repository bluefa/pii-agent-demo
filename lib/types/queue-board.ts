import type { CloudProvider } from '@/lib/types';

// ===== Enums =====

export type ApprovalRequestType = 'TARGET_CONFIRMATION' | 'END_OF_SERVICE';

export type ApprovalRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';

// ===== Admin Tasks Item =====

export interface ApprovalRequestQueueItem {
  approvalRequestId: string;
  targetSourceId: number;
  requestType: ApprovalRequestType;
  requestTypeName: string;
  status: ApprovalRequestStatus;
  statusLabel?: string | null;
  serviceCode: string;
  serviceName: string;
  provider: CloudProvider;
  cloudInfo: string;
  requestedAt: string;
  requestedBy: string;
  processedAt?: string | null;
  processedBy?: string | null;
  rejectionReason?: string | null;
}

// ===== Pagination =====

export interface PageInfoWithCounts {
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  pendingCount: number;
  processingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

// ===== Response =====

export interface ApprovalRequestQueueResponse {
  content: ApprovalRequestQueueItem[];
  page: PageInfoWithCounts;
}

// ===== Query Params =====

export interface QueueBoardQueryParams {
  status: string;
  requestType?: ApprovalRequestType;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}
