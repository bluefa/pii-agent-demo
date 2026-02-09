/**
 * 자동 승인 정책 (Auto Approval Policy)
 *
 * 승인 프로세스 간소화를 위한 자동 승인 규칙을 정의합니다.
 * AWS, Azure, GCP 등 모든 Cloud Provider에서 공통으로 사용됩니다.
 *
 * @see docs/cloud-provider-states.md - "자동 승인 조건" 섹션
 */

import { Resource, isPeIneligible } from '@/lib/types';

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
  | 'NON_EXCLUDED_NOT_SELECTED'  // 제외되지 않은 리소스 중 선택 안 된 것이 있음
  | 'AUTO_APPROVED';             // 자동 승인 조건 충족

/**
 * 자동 승인 조건을 평가합니다.
 *
 * 자동 승인 조건:
 * - 선택하지 않은 리소스가 모두 "연동 대상 제외"(exclusion) 상태인 경우
 * - 즉, 제외 확정되지 않은 리소스는 모두 연동 대상으로 선택해야 함
 *
 * 자동 승인되지 않는 경우:
 * - 선택하지 않은 리소스 중 "연동 대상 제외"가 아닌 리소스가 있을 때
 */
export const evaluateAutoApproval = (context: AutoApprovalContext): AutoApprovalResult => {
  const { resources, selectedResourceIds } = context;
  const selectedSet = new Set(selectedResourceIds);

  // 선택하지 않은 리소스 중 제외 확정되지 않은 리소스 찾기
  // EC2 리소스는 자동 승인 판정에서 제외 (선택 안 해도 자동 승인 가능)
  const unselectedNonExcluded = resources.filter(
    (r) => !selectedSet.has(r.id) && !r.exclusion && r.awsType !== 'EC2' && !isPeIneligible(r)
  );

  // 미선택 리소스 중 제외 확정되지 않은 리소스가 있으면 수동 승인 필요
  if (unselectedNonExcluded.length > 0) {
    return {
      shouldAutoApprove: false,
      reason: 'NON_EXCLUDED_NOT_SELECTED',
    };
  }

  // 자동 승인 조건 충족
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
    case 'NON_EXCLUDED_NOT_SELECTED':
      return '제외 확정되지 않은 리소스 중 일부가 선택되지 않아 수동 승인이 필요합니다.';
    case 'AUTO_APPROVED':
      return '모든 비제외 리소스가 선택되어 자동 승인되었습니다.';
  }
};
