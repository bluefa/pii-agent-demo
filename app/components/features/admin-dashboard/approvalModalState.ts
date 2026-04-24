import type { ApprovalDetail } from './types';

export type ApprovalModalState =
  | { status: 'closed' }
  | { status: 'create' }
  | { status: 'view'; detail: ApprovalDetail }
  | { status: 'submitting'; detail: ApprovalDetail };
