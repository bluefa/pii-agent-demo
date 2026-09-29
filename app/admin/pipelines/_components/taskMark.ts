import type { IconName } from '@/app/admin/pipelines/_components/icons';
import type { TaskOperation } from '@/lib/pipeline/types';

export interface OperationMark {
  icon: IconName;
  /** CSS hook — each flow grammar (TaskFlow `.nd-mark`, R24 `.r24-ticon` / `.rtc-tile`) colours it. */
  cls: 'm-delete' | 'm-reconfirm' | 'm-install';
  title: string;
}

/**
 * Kind mark for the two ADR-023 HTTP_REQUEST tasks, keyed by `operation` — `kind`
 * alone lumps them with the polling gates (or, on the run card, with Terraform).
 * `trash` is the DELETE type tile's glyph and `clipboard-check` the 확정 lineage,
 * so task and pipeline type say the same word. Anything not listed falls through
 * to the caller's kind branch. The two AWS China install tasks wear the INSTALL hue.
 */
const OPERATION_MARK: Partial<Record<string, OperationMark>> = {
  DELETE_CONFIRMED_RESOURCES: { icon: 'trash', cls: 'm-delete', title: '확정 정보 삭제' },
  CONFIRM_RESOURCES_FROM_RECOMMENDATION: { icon: 'clipboard-check', cls: 'm-reconfirm', title: '확정 정보 등록' },
  SERVICE_ACCOUNT_CREATE: { icon: 'user-plus', cls: 'm-install', title: 'Service Account 생성' },
  CHINA_SECRET_ROTATION_TRIGGER: { icon: 'rotate-ccw-key', cls: 'm-install', title: 'Secret Key Rotation' },
} satisfies Partial<Record<TaskOperation, OperationMark>>;

export function operationMark(operation: TaskOperation | null | undefined): OperationMark | undefined {
  return operation ? OPERATION_MARK[operation] : undefined;
}

/**
 * Same mark for shapes that carry the definition name but no `operation`
 * (task catalog, restart preview).
 * ponytail: reads `<OPERATION>_V<n>`, the naming every HTTP_REQUEST definition follows —
 * put `operation` on those wire shapes if a name ever breaks it.
 */
export function definitionMark(definition: string | null | undefined): OperationMark | undefined {
  return definition ? OPERATION_MARK[definition.replace(/_V\d+$/, '')] : undefined;
}
