/**
 * 자동 승인 정책 (Auto Approval Policy)
 *
 * 승인 프로세스 간소화를 위한 자동 승인 규칙을 정의합니다.
 * AWS, Azure, GCP 등 모든 Cloud Provider에서 공통으로 사용됩니다.
 *
 * @see docs/cloud-provider-states.md - "자동 승인 조건" 섹션
 */

import { Resource } from '@/lib/types';

export interface AutoApprovalContext {
  /** 프로젝트의 전체 리소스 목록 */
  resources: Resource[];
  /** 이번에 연동 대상으로 선택된 리소스 ID 목록 */
  selectedResourceIds: string[];
}

export interface AutoApprovalResult {
  /** 자동 승인 여부 */
  shouldAutoApprove: boolean;
  /** 판정 사유 */
  reason: AutoApprovalReason;
}

export type AutoApprovalReason =
  | 'NO_EXCLUDED_RESOURCES'      // 이전에 제외된 리소스가 없음
  | 'EXCLUDED_RESOURCE_SELECTED' // 제외된 리소스가 연동 대상에 포함됨
  | 'NON_EXCLUDED_NOT_SELECTED'  // 제외되지 않은 리소스 중 선택 안 된 것이 있음
  | 'AUTO_APPROVED';             // 자동 승인 조건 충족

/**
 * 자동 승인 조건을 평가합니다.
 *
 * 자동 승인 조건 (모두 만족해야 함):
 * 1. 이전에 연동 제외한 리소스가 존재함
 * 2. 해당 제외 리소스를 제외한 모든 리소스가 연동 대상으로 선택됨
 * 3. 즉, 신규 리소스만 추가되고 기존 제외 리소스는 그대로 제외 유지
 *
 * 자동 승인되지 않는 경우:
 * - 이전에 제외된 리소스를 다시 연동 대상에 포함시킬 때
 * - 기존 연동 리소스를 제외할 때
 * - 최초 연동 시 (제외 이력 없음)
 */
export const evaluateAutoApproval = (context: AutoApprovalContext): AutoApprovalResult => {
  const { resources, selectedResourceIds } = context;
  const selectedSet = new Set(selectedResourceIds);

  // 1. 이전에 제외된 리소스 찾기
  const excludedResources = resources.filter((r) => r.exclusion);

  // 조건 1: 제외된 리소스가 없으면 자동 승인 불가 (최초 연동)
  if (excludedResources.length === 0) {
    return {
      shouldAutoApprove: false,
      reason: 'NO_EXCLUDED_RESOURCES',
    };
  }

  // 2. 제외된 리소스가 선택되었는지 확인
  const excludedResourceSelected = excludedResources.some((r) => selectedSet.has(r.id));

  // 조건 2: 제외된 리소스가 선택되면 자동 승인 불가
  if (excludedResourceSelected) {
    return {
      shouldAutoApprove: false,
      reason: 'EXCLUDED_RESOURCE_SELECTED',
    };
  }

  // 3. 제외되지 않은 리소스가 모두 선택되었는지 확인
  const nonExcludedResources = resources.filter((r) => !r.exclusion);
  const allNonExcludedSelected = nonExcludedResources.every((r) => selectedSet.has(r.id));

  // 조건 3: 제외되지 않은 리소스 중 선택 안 된 것이 있으면 자동 승인 불가
  if (!allNonExcludedSelected) {
    return {
      shouldAutoApprove: false,
      reason: 'NON_EXCLUDED_NOT_SELECTED',
    };
  }

  // 모든 조건 충족 → 자동 승인
  return {
    shouldAutoApprove: true,
    reason: 'AUTO_APPROVED',
  };
};

/**
 * 자동 승인 사유에 대한 한글 설명을 반환합니다.
 */
export const getAutoApprovalReasonMessage = (reason: AutoApprovalReason): string => {
  switch (reason) {
    case 'NO_EXCLUDED_RESOURCES':
      return '이전에 제외된 리소스가 없어 자동 승인 조건을 충족하지 않습니다.';
    case 'EXCLUDED_RESOURCE_SELECTED':
      return '이전에 제외된 리소스가 연동 대상에 포함되어 수동 승인이 필요합니다.';
    case 'NON_EXCLUDED_NOT_SELECTED':
      return '제외되지 않은 리소스 중 일부가 선택되지 않아 수동 승인이 필요합니다.';
    case 'AUTO_APPROVED':
      return '기존 제외 리소스 외 모든 리소스가 선택되어 자동 승인되었습니다.';
  }
};
