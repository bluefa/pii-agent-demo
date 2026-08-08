import type { ReactNode } from 'react';
import type { DatabaseType } from '@/lib/types';

/**
 * Provider-agnostic Step-4 install-status detail model. Every cloud provider's
 * installation-status wire is resource-centric (resources[] × per-step
 * CloudInstallationStepStatusDto); adapters map it onto this shape and the
 * shared InstallStatusDetail component renders the step nav + resource table.
 */

/**
 * Swagger CloudInstallationStepStatusDto.status. The loose codegen leaves the
 * wire value as a plain string, so adapters normalize anything outside this
 * union to 'UNKNOWN'.
 */
export type InstallStepValue =
  | 'COMPLETED'
  | 'FAIL'
  | 'IN_PROGRESS'
  | 'SKIP'
  | 'BDC_INSTALL_REQUIRED'
  | 'UNKNOWN';

const STEP_VALUES: readonly InstallStepValue[] = [
  'COMPLETED',
  'FAIL',
  'IN_PROGRESS',
  'SKIP',
  'BDC_INSTALL_REQUIRED',
  'UNKNOWN',
];

export const normalizeInstallStepValue = (
  status: string | null | undefined,
): InstallStepValue =>
  (STEP_VALUES as readonly string[]).includes(status ?? '')
    ? (status as InstallStepValue)
    : 'UNKNOWN';

export const INSTALL_STATUS_LABEL: Record<InstallStepValue, string> = {
  COMPLETED: '완료',
  IN_PROGRESS: '진행중',
  FAIL: '실패',
  SKIP: '해당 없음',
  BDC_INSTALL_REQUIRED: 'BDC 설치 대기',
  UNKNOWN: '확인 중',
};

/** COMPLETED/SKIP count as settled (done) in aggregates and completion checks. */
export const isSettledInstallStatus = (status: InstallStepValue): boolean =>
  status === 'COMPLETED' || status === 'SKIP';

/** One step's state for one resource. `label` overrides the default status label
 *  (e.g. Azure PE approval renders domain wording on the same status buckets). */
export interface InstallStepCell {
  status: InstallStepValue;
  label?: string;
  guide: string | null;
}

/** One wire resource: rollup (installation_status) + per-step cells keyed by step id. */
export interface InstallDetailResource {
  resourceId: string;
  resourceName: string | null;
  rollup: InstallStepCell;
  cells: Record<string, InstallStepCell>;
}

/** Region/DB-type/name enrichment joined by resource id (confirmed integration 등). */
export interface InstallResourceMeta {
  resourceName: string | null;
  region: string | null;
  databaseType: DatabaseType | null;
  /**
   * The confirmed row's top-level `resource_type`. Joined in only for TYPE PREDICATES (the
   * RDS-cluster tag) — the install table prints `databaseType`, never this.
   */
  resourceType: string | null;
}

/** A step rendered as a per-resource table. */
export interface InstallTableStep {
  id: string;
  title: string;
  /** 주체 태그 — '서비스측 …' / 'BDC측 …' (BDC 접두사가 태그 색상을 정한다). */
  side: string | null;
  desc: string;
  /**
   * 서비스 측 담당자가 **직접 수행**해야 하는 단계에만 넣는 조치 문구.
   * 주체가 서비스측이어도 BDC가 자동 배포하는 단계에는 넣지 않는다 —
   * 이 값의 유무가 요약 화면의 "확인 필요/조치 불필요"를 가른다.
   */
  serviceAction?: string;
  /** Optional control rendered in the step's panel head (e.g. IDC 방화벽 확인). */
  action?: ReactNode;
  /**
   * 레일 그룹 — 'todo'(담당자 직접 수행) / 'auto'(BDC 자동 진행).
   * 어댑터가 하나라도 지정하면 레일이 2그룹으로 렌더되고, 첫 미완료 todo 가
   * 기본 선택된다. 지정하지 않은 CSP 는 기존 단일 목록 그대로다.
   */
  group?: 'todo' | 'auto';
}

/** Shared LastCheckInfoDto UI shape (SUCCESS/IN_PROGRESS/FAILED). */
export interface InstallLastCheck {
  status: 'SUCCESS' | 'IN_PROGRESS' | 'FAILED';
  checkedAt?: string;
  failReason?: string;
}

/** Install is complete when every resource's every cell is COMPLETED/SKIP. */
export const areInstallResourcesSettled = (
  resources: readonly InstallDetailResource[],
): boolean =>
  resources.length > 0 &&
  resources.every((r) =>
    Object.values(r.cells).every((cell) => isSettledInstallStatus(cell.status)),
  );
