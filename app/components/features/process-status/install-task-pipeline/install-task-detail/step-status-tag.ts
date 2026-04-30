import { tagStyles } from '@/lib/theme';
import type { GcpStepStatusValue } from '@/app/api/_lib/v1-types';

export const STEP_STATUS_TAG: Record<GcpStepStatusValue, string> = {
  COMPLETED: tagStyles.success,
  IN_PROGRESS: tagStyles.warning,
  FAIL: tagStyles.error,
  SKIP: tagStyles.neutral,
};
