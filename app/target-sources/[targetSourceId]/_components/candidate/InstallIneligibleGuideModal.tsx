'use client';

import { Modal } from '@/app/components/ui/Modal';
import { cn, textColors, textStyles } from '@/lib/theme';
import { AZURE_GUIDE_URLS, AZURE_NETWORKING_MODE_LABELS } from '@/lib/constants/azure';
import type { RecommendFailReason } from '@/lib/types';

interface InstallIneligibleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The scan's verdict code; null for the ineligible cases the enum does not cover. */
  recommendFailReason: RecommendFailReason | null;
}

interface Guide {
  /** 왜 실패했는지 — 부제 자리에 놓이는 한 문장. 이 모달의 첫 번째 강조. */
  cause: string;
  /** 원인을 이해하게 만드는 배경. 추측이 될 자리에서는 비워 둔다. */
  detail?: string;
  /** CSP 문서에 근거가 있을 때만. */
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
    detail: `Azure MySQL·PostgreSQL Flexible Server는 ${AZURE_NETWORKING_MODE_LABELS.VNET_INTEGRATION} 모드로 만들어진 경우 Private Endpoint를 연결할 수 없어요. 네트워킹 모드는 서버를 만들 때 정해지고 이후에는 바꿀 수 없어서, 지금 서버 그대로는 연동할 방법이 없어요.`,
    remedy: `${AZURE_NETWORKING_MODE_LABELS.PUBLIC_ACCESS} 모드로 새 서버를 만든 뒤 데이터를 옮기면 연동할 수 있어요. 자세한 절차는 아래 문서를 참고해 주세요.`,
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

/**
 * 읽기 전용 안내라 확인 모달과 같은 뼈대로 세운다 — 제목 + 부제 + 본문, 닫기는 헤더의 ✕.
 * 강조는 두 곳뿐이다: 부제의 실패 원인과 본문 끝의 협업 채널. 그 사이의 배경·조치는
 * 보조 텍스트 그대로 두어 아는 것을 줄이지 않는다. 카드는 두지 않는다.
 */
export const InstallIneligibleGuideModal = ({
  isOpen,
  onClose,
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
    >
      {/* 푸터가 없으니 아래 여백은 본문이 갖는다 — 헤더의 ✕ 하나로 닫는다. */}
      <div className={cn('flex flex-col gap-3 pb-8', textStyles.body, textColors.secondary)}>
        {guide.detail && <p>{guide.detail}</p>}
        {guide.remedy && <p>{guide.remedy}</p>}

        {guide.doc && (
          <a
            href={guide.doc.href}
            target="_blank"
            rel="noopener noreferrer"
            /* 밑줄만으로 링크임을 말한다 — 굵기까지 주면 강조가 셋이 된다. */
            className="self-start underline underline-offset-2"
          >
            {guide.doc.label}
          </a>
        )}

        <p>
          추가적인 문의사항이 있으면{' '}
          <strong className={cn('font-semibold', textColors.primary)}>협업 채널</strong>
          에 문의해주세요.
        </p>
      </div>
    </Modal>
  );
};
