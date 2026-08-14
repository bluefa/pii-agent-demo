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

/** 같은 화면 안의 다른 레일 항목으로 보내는 점프 링크 — 라벨을 파란 밑줄로 그린다. */
export interface InstallJumpLink {
  label: string;
  stepId: string;
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
  /** Optional control rendered in the step's panel head (e.g. IDC 접근 허용 확인). */
  action?: ReactNode;
  /**
   * 설명 아래 보조 한 줄 — 참고 항목으로 보내는 역참조.
   * `link.label` 을 파란 밑줄로 그리고 누르면 그 항목을 연다.
   * `text` 는 라벨 뒤에 **공백 없이** 이어 붙는다 (조사가 라벨에 붙으므로).
   */
  note?: { link: InstallJumpLink; text: string };
  /**
   * Rail group — 'todo' (the service owner acts) / 'auto' (BDC proceeds
   * automatically). When EVERY step of an adapter declares one, the rail
   * renders in two groups and the first open todo is the default selection.
   * Any step left undeclared keeps the whole CSP on the legacy single list.
   */
  group?: 'todo' | 'auto';
}

/**
 * 참고 항목 — 설치 단계가 **아닌** 것을 레일에 세운다 (Terraform Script 등).
 *
 * 단계가 아니므로 상태도 집계도 없다: 진행률에 끼지 않고, 기본 선택 대상도 되지 않으며,
 * 레일에서 상태 글자를 갖지 않는다. CloudFormation 이 Template 을 Events·Resources 와
 * 나란한 탭으로 두는 문법과 같다 — 상태 위에 얹는 배너가 아니라 별도의 뷰다.
 */
export interface InstallReferenceStep {
  id: string;
  title: string;
  /** 설명 문장 — `descLink` 가 있으면 링크 라벨 뒤에 이어 붙는 나머지 문장. */
  desc: string;
  /**
   * 설명 앞머리의 단계 점프 링크 — label 을 파란 밑줄로 그리고, 누르면 해당
   * 단계를 연다 (요약 패널 "N단계로 이동" 링크와 같은 문법).
   * 반대 방향(단계 → 참고 항목)은 `InstallTableStep.note`.
   */
  descLink?: InstallJumpLink;
  panel: ReactNode;
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
