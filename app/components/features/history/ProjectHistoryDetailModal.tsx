'use client';

import { ProjectHistory } from '@/lib/types';
import { Modal } from '@/app/components/ui/Modal';
import { HistoryTypeBadge } from './HistoryTypeBadge';
import { formatDateTime } from '@/lib/utils/date';

interface ProjectHistoryDetailModalProps {
  history: ProjectHistory;
  onClose: () => void;
}

export const ProjectHistoryDetailModal = ({
  history,
  onClose,
}: ProjectHistoryDetailModalProps) => {
  return (
    <Modal isOpen={true} title="이력 상세" onClose={onClose} size="md">
      <div className="space-y-6">
        {/* 기본 정보 */}
        <Section title="기본 정보">
          <InfoRow label="유형" value={<HistoryTypeBadge type={history.type} />} />
          <InfoRow label="처리 일시" value={formatDateTime(history.timestamp)} />
          <InfoRow label="처리자" value={history.actor.name} />
          <InfoRow label="처리자 ID" value={history.actor.id} secondary />
        </Section>

        {/* 타입별 상세 정보 */}
        <HistoryTypeDetail history={history} />
      </div>
    </Modal>
  );
};

// 타입별 상세 정보 컴포넌트
const HistoryTypeDetail = ({ history }: { history: ProjectHistory }) => {
  const { type, details } = history;

  switch (type) {
    case 'TARGET_CONFIRMED':
      return (
        <Section title="연동 확정 정보">
          <InfoRow label="연동 대상 리소스" value={`${details.resourceCount ?? 0}개`} />
          <InfoRow
            label="연동 제외 리소스"
            value={`${details.excludedResourceCount ?? 0}개`}
          />
          <InfoDescription>
            서비스 담당자가 스캔된 리소스 중 연동할 대상을 확정했습니다.
          </InfoDescription>
        </Section>
      );

    case 'AUTO_APPROVED':
      return (
        <Section title="자동 승인 정보">
          <InfoDescription>
            다음 조건을 만족하여 자동 승인 처리되었습니다:
          </InfoDescription>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>이전에 연동 제외한 리소스가 존재</li>
            <li>해당 제외 리소스를 제외한 모든 리소스가 연동 대상으로 선택됨</li>
          </ul>
        </Section>
      );

    case 'APPROVAL':
      return (
        <Section title="승인 정보">
          <InfoDescription>
            관리자가 연동 대상을 검토하고 승인했습니다.
            설치 프로세스가 진행됩니다.
          </InfoDescription>
        </Section>
      );

    case 'REJECTION':
      return (
        <Section title="반려 정보">
          <InfoRow label="반려 사유" />
          <ReasonBox reason={details.reason} />
          <InfoDescription>
            서비스 담당자는 반려 사유를 확인하고 연동 대상을 다시 확정해주세요.
          </InfoDescription>
        </Section>
      );

    case 'DECOMMISSION_REQUEST':
      return (
        <Section title="폐기 요청 정보">
          <InfoRow label="폐기 사유" />
          <ReasonBox reason={details.reason} />
          <InfoDescription>
            관리자의 폐기 승인을 기다리고 있습니다.
          </InfoDescription>
        </Section>
      );

    case 'DECOMMISSION_APPROVED':
      return (
        <Section title="폐기 승인 정보">
          <InfoDescription>
            관리자가 폐기를 승인했습니다.
            해당 프로젝트의 연동이 해제됩니다.
          </InfoDescription>
        </Section>
      );

    case 'DECOMMISSION_REJECTED':
      return (
        <Section title="폐기 반려 정보">
          <InfoRow label="반려 사유" />
          <ReasonBox reason={details.reason} />
          <InfoDescription>
            폐기 요청이 반려되었습니다. 연동은 유지됩니다.
          </InfoDescription>
        </Section>
      );

    default:
      return null;
  }
};

// 섹션 컴포넌트
const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div>
    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
      {title}
    </h4>
    <div className="space-y-2">{children}</div>
  </div>
);

// 정보 행 컴포넌트
const InfoRow = ({
  label,
  value,
  secondary = false,
}: {
  label: string;
  value?: React.ReactNode;
  secondary?: boolean;
}) => (
  <div className="flex items-center justify-between py-1">
    <span className={secondary ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>
      {label}
    </span>
    {value && (
      <span className={secondary ? 'text-sm text-gray-400' : 'text-sm text-gray-900 font-medium'}>
        {value}
      </span>
    )}
  </div>
);

// 설명 컴포넌트
const InfoDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-500 mt-3 p-3 bg-gray-50 rounded-lg">{children}</p>
);

// 사유 박스 컴포넌트
const ReasonBox = ({ reason }: { reason?: string }) => (
  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
    <p className="text-sm text-gray-700 whitespace-pre-wrap">
      {reason || '(사유 없음)'}
    </p>
  </div>
);
