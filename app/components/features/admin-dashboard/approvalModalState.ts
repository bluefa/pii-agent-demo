import type { ApprovalDetail } from '@/app/components/features/admin-dashboard/types';

export type ApprovalModalState =
  | { status: 'closed' }
  | { status: 'create' }
  | { status: 'view'; detail: ApprovalDetail }
  | { status: 'submitting'; detail: ApprovalDetail };
