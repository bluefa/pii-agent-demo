'use client';

import { ProjectHistory } from '@/lib/types';
import { HistoryTable, HistoryColumn } from '@/app/components/ui/HistoryTable';
import { HistoryTypeBadge } from './HistoryTypeBadge';
import { formatDateTime } from '@/lib/utils/date';

interface ProjectHistoryTableProps {
  history: ProjectHistory[];
  loading?: boolean;
  onRowClick?: (item: ProjectHistory) => void;
}

export const ProjectHistoryTable = ({
  history,
  loading = false,
  onRowClick,
}: ProjectHistoryTableProps) => {
  const columns: HistoryColumn<ProjectHistory>[] = [
    {
      key: 'timestamp',
      label: '일시',
      width: 'w-44',
      render: (item) => (
        <span className="text-gray-900">{formatDateTime(item.timestamp)}</span>
      ),
    },
    {
      key: 'type',
      label: '유형',
      width: 'w-28',
      render: (item) => <HistoryTypeBadge type={item.type} />,
    },
    {
      key: 'actor',
      label: '처리자',
      width: 'w-24',
      render: (item) => (
        <span className="text-gray-700">{item.actor.name}</span>
      ),
    },
    {
      key: 'details',
      label: '상세',
      render: (item) => <HistoryDetails details={item.details} type={item.type} />,
    },
  ];

  return (
    <HistoryTable
      items={history}
      columns={columns}
      keyExtractor={(item) => item.id}
      onRowClick={onRowClick}
      loading={loading}
      emptyMessage="프로젝트 이력이 없습니다."
      emptyDescription="연동 확정, 승인, 반려 등의 이력이 표시됩니다."
    />
  );
};

// 상세 정보 표시 컴포넌트
const HistoryDetails = ({
  details,
  type,
}: {
  details: ProjectHistory['details'];
  type: ProjectHistory['type'];
}) => {
  const { reason, resourceCount, excludedResourceCount } = details;

  // 연동 확정
  if (type === 'TARGET_CONFIRMED') {
    return (
      <span className="text-gray-600">
        연동 대상 {resourceCount}개
        {excludedResourceCount && excludedResourceCount > 0 && (
          <span className="text-gray-400"> (제외 {excludedResourceCount}개)</span>
        )}
      </span>
    );
  }

  // 자동 승인
  if (type === 'AUTO_APPROVED') {
    return (
      <span className="text-gray-500">기존 제외 리소스 외 전체 연동</span>
    );
  }

  // 반려/폐기 관련 (사유 있음)
  if (reason) {
    return <span className="text-gray-600">{reason}</span>;
  }

  return <span className="text-gray-400">-</span>;
};
