import type { IconName } from '@/app/admin/pipelines/_components/icons';
import type { TaskOperation } from '@/lib/pipeline/types';

export interface OperationMark {
  icon: IconName;
  /** CSS hook — each flow grammar (TaskFlow `.nd-mark`, R24 `.r24-ticon` / `.rtc-tile`) colours it. */
  cls: 'm-delete' | 'm-reconfirm' | 'm-install';
  title: string;
}

/**
 * Kind mark for the HTTP_REQUEST tasks — `kind` alone lumps them with the polling
 * gates (or, on the run card, with Terraform). Keyed by `operation`, or by the
 * definition name minus its `_V<n>` for tasks the wire sends with operation
 * `UNKNOWN` (the two AWS China install tasks). `trash` is the DELETE type tile's
 * glyph and `clipboard-check` the 확정 lineage, so task and pipeline type say the
 * same word. The two AWS China install tasks wear the INSTALL hue.
 */
const MARK: Partial<Record<string, OperationMark>> = {
  DELETE_CONFIRMED_RESOURCES: { icon: 'trash', cls: 'm-delete', title: '확정 정보 삭제' },
  CONFIRM_RESOURCES_FROM_RECOMMENDATION: { icon: 'clipboard-check', cls: 'm-reconfirm', title: '확정 정보 등록' },
  AWS_SERVICE_ACCOUNT_CREATE: { icon: 'user-plus', cls: 'm-install', title: 'Service Account 생성' },
  AWS_CHINA_SECRET_ROTATION_TRIGGER: { icon: 'rotate-ccw-key', cls: 'm-install', title: 'Secret Key Rotation' },
};

/**
 * The one mark lookup every task surface uses, so a task wears the same mark on
 * the run card, the flow, the drawer and the modals. Pass whatever the shape
 * carries; `undefined` leaves the caller to its kind fallback.
 * ponytail: reads `<OPERATION>_V<n>`, the naming every HTTP_REQUEST definition follows —
 * put `operation` on the wire if a name ever breaks it.
 */
export function taskMark(
  operation: TaskOperation | null | undefined,
  definition: string | null | undefined,
): OperationMark | undefined {
  return (operation && MARK[operation]) || (definition ? MARK[definition.replace(/_V\d+$/, '')] : undefined);
}
