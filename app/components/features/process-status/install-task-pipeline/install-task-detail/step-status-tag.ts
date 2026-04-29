import { tagStyles } from '@/lib/theme';
import type { GcpStepStatusValue } from '@/app/api/_lib/v1-types';

export const STEP_STATUS_TAG: Record<GcpStepStatusValue, string> = {
  COMPLETED: tagStyles.green,
  IN_PROGRESS: tagStyles.orange,
  FAIL: tagStyles.red,
  SKIP: tagStyles.gray,
};
