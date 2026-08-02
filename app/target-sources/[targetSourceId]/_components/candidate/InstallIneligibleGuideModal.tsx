'use client';

import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, statusColors, textColors } from '@/lib/theme';
import { AZURE_GUIDE_URLS, AZURE_NETWORKING_MODE_LABELS } from '@/lib/constants/azure';
import type { RecommendFailReason } from '@/lib/types';

interface InstallIneligibleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceId: string;
  /** The scan's verdict code; null for the ineligible cases the enum does not cover. */
  recommendFailReason: RecommendFailReason | null;
}

interface Guide {
  /** What the scan found, in the user's words. */
  cause: string;
  /** Background that makes the cause actionable. Omitted where we would be guessing. */
  detail?: string;
  /** Only where the CSP documents a concrete fix. */
  remedy?: string;
  doc?: { href: string; label: string };
}

// One entry per `recommend_fail_reason`. Nothing here may claim more than the code
// states: the two GCP values name a configuration fact, and neither the contract nor
// the spec says how to undo it, so they carry no remedy — a wrong remediation on
// production infrastructure is worse than sending the user to a human.
const GUIDES: Record<RecommendFailReason, Guide> = {
  AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED: {
    cause: 'Private Endpoint 연결에 실패해 Agent를 설치할 수 없어요.',
    detail: `Azure MySQL/PostgreSQL Flexible Server가 ${AZURE_NETWORKING_MODE_LABELS.VNET_INTEGRATION} 모드로 생성된 경우 Private Endpoint로 연결할 수 없어요. 네트워킹 모드는 서버 생성 시 정해지며 이후 변경할 수 없어요.`,
    remedy: `${AZURE_NETWORKING_MODE_LABELS.PUBLIC_ACCESS} 모드로 새 서버를 생성한 뒤 데이터를 마이그레이션하세요.`,
    doc: { href: AZURE_GUIDE_URLS.VNET_NETWORKING, label: 'Azure VNet 네트워킹 문서' },
  },
  GCP_CLOUD_SQL_HAS_PUBLIC_IP: {
    cause: 'Cloud SQL 인스턴스에 공인 IP가 설정되어 있어 Agent를 설치할 수 없어요.',
  },
  GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET: {
    cause: 'Cloud SQL 인스턴스가 내부 HTTP 로드밸런서용 서브넷을 사용하고 있어 Agent를 설치할 수 없어요.',
  },
};

// AWS와 IDC는 설치 불가 판정에 사유 코드가 붙지 않아요 — 분류만 아는 상태를 그대로 말합니다.
const UNKNOWN_GUIDE: Guide = {
  cause: '네트워크 구성 제약으로 Agent를 설치할 수 없는 리소스예요.',
};

const WarningIcon = () => (
  <svg className={cn('w-5 h-5', statusColors.warning.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export const InstallIneligibleGuideModal = ({
  isOpen,
  onClose,
  resourceId,
  recommendFailReason,
}: InstallIneligibleGuideModalProps) => {
  const guide = recommendFailReason ? GUIDES[recommendFailReason] : UNKNOWN_GUIDE;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="설치 불가 사유"
      size="md"
      footer={<Button variant="secondary" onClick={onClose}>닫기</Button>}
    >
      <div className="space-y-4">
        {/* 경고 아이콘 + 리소스 ID */}
        <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg', statusColors.warning.bg)}>
          <WarningIcon />
          <span className={cn('text-sm font-mono break-all', textColors.tertiary)}>{resourceId}</span>
        </div>

        {/* 원인 설명 */}
        <div className="space-y-2">
          <p className={cn('text-sm leading-relaxed', textColors.primary)}>{guide.cause}</p>
          {guide.detail && (
            <p className={cn('text-sm leading-relaxed', textColors.tertiary)}>{guide.detail}</p>
          )}
        </div>

        {/* 해결 방법 — 없으면 사람에게 넘긴다 */}
        <div className={cn('p-3 rounded-lg border', statusColors.info.bg, statusColors.info.border)}>
          <p className={cn('text-sm font-medium mb-1', statusColors.info.textDark)}>해결 방법</p>
          <p className={cn('text-sm', textColors.secondary)}>
            {guide.remedy ?? '설치 가능한 구성으로 변경하려면 우측 협업 채널로 문의해 주세요.'}
          </p>
        </div>

        {/* 사유 코드 — 담당자와 같은 말로 검색할 수 있게 원문 그대로 남긴다. */}
        {recommendFailReason && (
          <p className={cn('text-xs font-mono break-all', textColors.tertiary)}>{recommendFailReason}</p>
        )}

        {guide.doc && (
          <a
            href={guide.doc.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1.5 text-sm font-medium', statusColors.info.text, 'hover:underline')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {guide.doc.label}
          </a>
        )}
      </div>
    </Modal>
  );
};
