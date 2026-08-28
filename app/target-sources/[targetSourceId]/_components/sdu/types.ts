import type { CloudTargetSource } from '@/lib/types';

/**
 * Props every SDU step component receives. Mirrors `IdcStepProps` minus the chrome the
 * SDU steps do not own yet — this is a stub contract for the UI slices that follow, and
 * it grows only when a step actually reads the field.
 */
export interface SduStepProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}
