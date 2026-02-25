import { NextResponse } from 'next/server';
import type {
  ApprovalRequestQueueItem,
  ApprovalRequestStatus,
  ApprovalRequestType,
  QueueBoardQueryParams,
} from '@/lib/types/queue-board';
import type { CloudProvider } from '@/lib/types';

// ===== In-Memory Store =====

let idCounter = 100;

const queueItems: ApprovalRequestQueueItem[] = [];

// ===== Seed Data (데모/개발 편의용) =====
// WAITING_TARGET_CONFIRMATION 프로젝트 중 "이미 승인 요청이 생성된 것"으로 시드

const SEED_ITEMS: ApprovalRequestQueueItem[] = [
  // PENDING — targetSourceId 1007 (AWS, proj-2) — 담당자가 승인 요청을 제출한 상태
  {
    approvalRequestId: 'ar_seed_001',
    targetSourceId: 1007,
    requestType: 'TARGET_CONFIRMATION',
    requestTypeName: '연동 대상 확정',
    status: 'PENDING',
    serviceCode: 'SERVICE-A',
    serviceName: '서비스 A',
    provider: 'AWS',
    cloudInfo: '123456789012',
    requestedAt: '2026-02-25T09:15:00Z',
    requestedBy: '김철수',
  },
  // PENDING (EoS) — targetSourceId 1009 (IDC, proj-4)
  {
    approvalRequestId: 'ar_seed_002',
    targetSourceId: 1009,
    requestType: 'END_OF_SERVICE',
    requestTypeName: 'EoS 처리',
    status: 'PENDING',
    serviceCode: 'SERVICE-B',
    serviceName: '서비스 B',
    provider: 'IDC',
    cloudInfo: 'IDC',
    requestedAt: '2026-02-24T16:00:00Z',
    requestedBy: '홍길동',
  },
  // IN_PROGRESS — targetSourceId 1011 (SDU, sdu-proj-1)
  {
    approvalRequestId: 'ar_seed_003',
    targetSourceId: 1011,
    requestType: 'TARGET_CONFIRMATION',
    requestTypeName: '연동 대상 확정',
    status: 'IN_PROGRESS',
    statusLabel: '연동내용 반영중',
    serviceCode: 'SERVICE-C',
    serviceName: '서비스 C',
    provider: 'SDU',
    cloudInfo: 'SDU',
    requestedAt: '2026-02-21T11:00:00Z',
    requestedBy: '김철수',
    processedAt: '2026-02-21T15:00:00Z',
    processedBy: '관리자',
  },
  // APPROVED — targetSourceId 1003 (Azure, azure-proj-1)
  {
    approvalRequestId: 'ar_seed_004',
    targetSourceId: 1003,
    requestType: 'TARGET_CONFIRMATION',
    requestTypeName: '연동 대상 확정',
    status: 'APPROVED',
    serviceCode: 'SERVICE-A',
    serviceName: '서비스 A',
    provider: 'Azure',
    cloudInfo: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890 / 12345678-abcd-ef01-2345-6789abcdef01',
    requestedAt: '2026-02-22T08:00:00Z',
    requestedBy: '김철수',
    processedAt: '2026-02-22T10:00:00Z',
    processedBy: '관리자',
  },
  // APPROVED (EoS) — targetSourceId 1005 (Azure, azure-proj-3)
  {
    approvalRequestId: 'ar_seed_005',
    targetSourceId: 1005,
    requestType: 'END_OF_SERVICE',
    requestTypeName: 'EoS 처리',
    status: 'APPROVED',
    serviceCode: 'SERVICE-A',
    serviceName: '서비스 A',
    provider: 'Azure',
    cloudInfo: 'c3d4e5f6-a7b8-9012-cdef-123456789012 / 34567890-cdef-0123-4567-89abcdef0123',
    requestedAt: '2026-02-19T10:00:00Z',
    requestedBy: '홍길동',
    processedAt: '2026-02-19T14:00:00Z',
    processedBy: '관리자',
  },
  // REJECTED — targetSourceId 1004 (Azure, azure-proj-2)
  {
    approvalRequestId: 'ar_seed_006',
    targetSourceId: 1004,
    requestType: 'TARGET_CONFIRMATION',
    requestTypeName: '연동 대상 확정',
    status: 'REJECTED',
    serviceCode: 'SERVICE-B',
    serviceName: '서비스 B',
    provider: 'Azure',
    cloudInfo: 'b2c3d4e5-f6a7-8901-bcde-f12345678901 / 23456789-bcde-f012-3456-789abcdef012',
    requestedAt: '2026-02-20T13:00:00Z',
    requestedBy: '홍길동',
    processedAt: '2026-02-20T17:00:00Z',
    processedBy: '관리자',
    rejectionReason: 'VM 리소스의 NIC 정보가 불완전합니다. 확인 후 다시 요청해주세요.',
  },
];

// Initialize store with seed data
queueItems.push(...SEED_ITEMS);

// ===== Store Mutation Functions (confirm.ts에서 호출) =====

interface AddQueueItemParams {
  targetSourceId: number;
  requestType: ApprovalRequestType;
  serviceCode: string;
  serviceName: string;
  provider: CloudProvider;
  cloudInfo: string;
  requestedBy: string;
}

export const addQueueItem = (params: AddQueueItemParams): void => {
  const id = `ar_${Date.now()}_${++idCounter}`;
  queueItems.push({
    approvalRequestId: id,
    targetSourceId: params.targetSourceId,
    requestType: params.requestType,
    requestTypeName: params.requestType === 'END_OF_SERVICE' ? 'EoS 처리' : '연동 대상 확정',
    status: 'PENDING',
    serviceCode: params.serviceCode,
    serviceName: params.serviceName,
    provider: params.provider,
    cloudInfo: params.cloudInfo,
    requestedAt: new Date().toISOString(),
    requestedBy: params.requestedBy,
  });
};

export const updateQueueItemStatus = (
  targetSourceId: number,
  status: ApprovalRequestStatus,
  processedBy: string,
  rejectionReason?: string,
): void => {
  // Find the most recent PENDING item for this targetSourceId
  const item = [...queueItems]
    .reverse()
    .find((i) => i.targetSourceId === targetSourceId && i.status === 'PENDING');
  if (!item) return;

  const now = new Date().toISOString();
  item.status = status;
  item.processedAt = now;
  item.processedBy = processedBy;
  if (status === 'IN_PROGRESS') {
    item.statusLabel = '연동내용 반영중';
  }
  if (status === 'REJECTED' && rejectionReason) {
    item.rejectionReason = rejectionReason;
  }
};

// ===== Helpers =====

const parseStatuses = (statusParam: string): string[] =>
  statusParam.split(',').map((s) => s.trim());

const matchesSearch = (item: ApprovalRequestQueueItem, search: string): boolean => {
  const lower = search.toLowerCase();
  return (
    item.serviceCode.toLowerCase().includes(lower) ||
    item.serviceName.toLowerCase().includes(lower)
  );
};

// ===== Mock Method =====

export const mockQueueBoard = {
  getApprovalRequestQueue: async (
    params: QueueBoardQueryParams,
  ): Promise<NextResponse> => {
    const statuses = parseStatuses(params.status);
    const page = params.page ?? 0;
    const size = params.size ?? 20;
    const sortField = params.sort ?? 'requestedAt,desc';

    // Filter by status
    let filtered = queueItems.filter((item) => statuses.includes(item.status));

    // Filter by requestType
    if (params.requestType) {
      filtered = filtered.filter((item) => item.requestType === params.requestType);
    }

    // Filter by search
    if (params.search) {
      filtered = filtered.filter((item) => matchesSearch(item, params.search!));
    }

    // Sort
    const [field, direction] = sortField.split(',');
    filtered.sort((a, b) => {
      const aVal = a[field as keyof ApprovalRequestQueueItem] ?? '';
      const bVal = b[field as keyof ApprovalRequestQueueItem] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return direction === 'asc' ? cmp : -cmp;
    });

    // Global counts (independent of current filter)
    const pendingCount = queueItems.filter((item) => item.status === 'PENDING').length;
    const processingCount = queueItems.filter((item) => item.status === 'IN_PROGRESS').length;
    const approvedCount = queueItems.filter((item) => item.status === 'APPROVED').length;
    const rejectedCount = queueItems.filter((item) => item.status === 'REJECTED').length;

    // Paginate
    const totalElements = filtered.length;
    const totalPages = Math.ceil(totalElements / size) || 1;
    const content = filtered.slice(page * size, (page + 1) * size);

    const response = {
      content,
      page: {
        totalElements,
        totalPages,
        number: page,
        size,
        pendingCount,
        processingCount,
        approvedCount,
        rejectedCount,
      },
    };

    return NextResponse.json(response);
  },
};
