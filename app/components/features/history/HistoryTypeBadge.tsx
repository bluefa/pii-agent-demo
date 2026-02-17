'use client';

import { ProjectHistoryType } from '@/lib/types';
import { Badge } from '@/app/components/ui/Badge';
import { Tooltip } from '@/app/components/ui/Tooltip';

interface HistoryTypeConfig {
  label: string;
  variant: 'success' | 'error' | 'info' | 'pending' | 'warning';
  tooltip: string;
}

const historyTypeConfig: Record<ProjectHistoryType, HistoryTypeConfig> = {
  TARGET_CONFIRMED: {
    label: '연동 확정',
    variant: 'info',
    tooltip: '서비스 담당자가 스캔된 리소스 중 연동할 대상을 확정했습니다.',
  },
  AUTO_APPROVED: {
    label: '자동승인',
    variant: 'success',
    tooltip: '기존에 제외된 리소스를 제외한 모든 리소스가 연동 대상으로 선택되어 자동 승인되었습니다. 별도의 관리자 승인 없이 설치가 진행됩니다.',
  },
  APPROVAL: {
    label: '승인',
    variant: 'success',
    tooltip: '관리자가 연동 대상을 검토하고 승인했습니다. 설치 프로세스가 진행됩니다.',
  },
  REJECTION: {
    label: '반려',
    variant: 'error',
    tooltip: '관리자가 연동 대상을 반려했습니다. 반려 사유를 확인하고 연동 대상을 다시 확정해주세요.',
  },
  APPROVAL_CANCELLED: {
    label: '승인취소',
    variant: 'warning',
    tooltip: '서비스 담당자가 승인 요청을 취소했습니다. 다시 연동 대상을 선택하여 요청할 수 있습니다.',
  },
  DECOMMISSION_REQUEST: {
    label: '폐기 요청',
    variant: 'warning',
    tooltip: '서비스 담당자가 연동 해제(폐기)를 요청했습니다. 관리자 승인을 기다리고 있습니다.',
  },
  DECOMMISSION_APPROVED: {
    label: '폐기 승인',
    variant: 'pending',
    tooltip: '관리자가 폐기를 승인했습니다. 해당 프로젝트의 연동이 해제됩니다.',
  },
  DECOMMISSION_REJECTED: {
    label: '폐기 반려',
    variant: 'error',
    tooltip: '관리자가 폐기 요청을 반려했습니다. 연동은 유지됩니다.',
  },
};

interface HistoryTypeBadgeProps {
  type: ProjectHistoryType;
  showTooltip?: boolean;
}

export const HistoryTypeBadge = ({ type, showTooltip = true }: HistoryTypeBadgeProps) => {
  const config = historyTypeConfig[type];
  const badge = <Badge variant={config.variant}>{config.label}</Badge>;

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip content={config.tooltip} position="top" size="md">
      <span className="cursor-help">{badge}</span>
    </Tooltip>
  );
};

// Tooltip 내용만 가져오는 헬퍼 함수
export const getHistoryTypeTooltip = (type: ProjectHistoryType): string => {
  return historyTypeConfig[type].tooltip;
};
