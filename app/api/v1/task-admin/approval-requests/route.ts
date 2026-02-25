import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import type { ApprovalRequestType, QueueBoardQueryParams } from '@/lib/types/queue-board';

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status') ?? 'PENDING';
  const requestType = searchParams.get('requestType') as ApprovalRequestType | null;
  const search = searchParams.get('search');
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? '20');
  const sort = searchParams.get('sort') ?? 'requestedAt,desc';

  const params: QueueBoardQueryParams = {
    status,
    page,
    size,
    sort,
    ...(requestType && { requestType }),
    ...(search && { search }),
  };

  return client.taskAdmin.getApprovalRequestQueue(params);
}, { expectedDuration: '500ms ~ 2s' });
