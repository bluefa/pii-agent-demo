'use client';

import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, textColors, textStyles } from '@/lib/theme';
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
  /** What the scan found — the modal's subtitle, so it stays one sentence. */
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

const DEFAULT_REMEDY = '설치 가능한 구성으로 변경하려면 우측 협업 채널로 문의해 주세요.';

/**
 * 읽기 전용 안내라 확인 모달과 같은 뼈대로 세운다 — 제목 + 부제 + 본문 + 닫기.
 * 본문 안에 카드를 두지 않는다: 강조는 보조 텍스트 안의 굵기로만 준다.
 */
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
      chrome="toss"
      size="lg"
      title="설치 불가 사유"
      subtitle={guide.cause}
      footer={<Button variant="secondary" onClick={onClose}>닫기</Button>}
    >
      <div className={cn('flex flex-col gap-3', textStyles.body)}>
        <p className={cn('font-mono break-all', textColors.tertiary)}>{resourceId}</p>

        {guide.detail && <p className={textColors.secondary}>{guide.detail}</p>}

        <p className={textColors.secondary}>
          <strong className={cn('font-semibold', textColors.primary)}>해결 방법</strong>
          {' · '}
          {guide.remedy ?? DEFAULT_REMEDY}
        </p>

        {/* 사유 코드 — 담당자와 같은 말로 검색할 수 있게 원문 그대로 남긴다. */}
        {recommendFailReason && (
          <p className={cn(textStyles.caption, 'font-mono break-all', textColors.tertiary)}>
            {recommendFailReason}
          </p>
        )}

        {guide.doc && (
          <a
            href={guide.doc.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('self-start font-semibold underline underline-offset-2', textColors.secondary)}
          >
            {guide.doc.label}
          </a>
        )}
      </div>
    </Modal>
  );
};
