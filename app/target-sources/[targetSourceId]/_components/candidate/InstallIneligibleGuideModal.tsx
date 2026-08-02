'use client';

import { Modal } from '@/app/components/ui/Modal';
import { cn, textColors, textStyles } from '@/lib/theme';
import { AZURE_GUIDE_URLS, AZURE_NETWORKING_MODE_LABELS } from '@/lib/constants/azure';
import { GCP_GUIDE_URLS } from '@/lib/constants/gcp';
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

// One entry per `recommend_fail_reason`. Every 원인/조치 문장은 CSP 가 문서로 못 박은
// 제약이거나 그 제약의 직접적인 귀결이어야 한다 — 운영 인프라를 잘못 건드리게 만드는
// 조치 안내는 안내가 없는 것보다 나쁘다.
const GUIDES: Record<RecommendFailReason, Guide> = {
  AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED: {
    cause: 'Private Endpoint 연결에 실패해 Agent를 설치할 수 없어요.',
    detail: `Azure MySQL·PostgreSQL Flexible Server는 ${AZURE_NETWORKING_MODE_LABELS.VNET_INTEGRATION} 모드로 만들어진 경우 Private Endpoint를 연결할 수 없어요. 네트워킹 모드는 서버를 만들 때 정해지고 이후에는 바꿀 수 없어요.`,
    remedy: `${AZURE_NETWORKING_MODE_LABELS.PUBLIC_ACCESS} 모드로 새 서버를 만든 뒤 데이터를 옮기면 연동할 수 있어요.`,
    doc: { href: AZURE_GUIDE_URLS.VNET_NETWORKING, label: 'Azure VNet 네트워킹 문서' },
  },
  GCP_CLOUD_SQL_HAS_PUBLIC_IP: {
    cause: 'Cloud SQL 인스턴스에 공인 IP가 설정되어 있어 Agent를 설치할 수 없어요.',
    detail: 'PII Agent는 Private Service Connect(PSC)로 Cloud SQL에 연결해요. PSC는 공인 IP가 설정된 인스턴스에는 구성할 수 없어요.',
    remedy: '인스턴스의 공인 IP를 해제한 뒤 다시 스캔하면 연동 대상으로 잡혀요.',
    doc: { href: GCP_GUIDE_URLS.CLOUD_SQL_PSC, label: 'Cloud SQL Private Service Connect 문서' },
  },
  GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET: {
    cause: 'Cloud SQL 인스턴스가 내부 HTTP 로드밸런서용 서브넷을 쓰고 있어 Agent를 설치할 수 없어요.',
    detail: 'PII Agent는 Private Service Connect(PSC)로 Cloud SQL에 연결해요. 내부 HTTP(S) 로드밸런서 전용 서브넷은 PSC가 지원하지 않아요.',
    remedy: 'PSC를 지원하는 서브넷으로 인스턴스를 옮긴 뒤 다시 스캔하면 연동 대상으로 잡혀요.',
    doc: { href: GCP_GUIDE_URLS.CLOUD_SQL_PSC, label: 'Cloud SQL Private Service Connect 문서' },
  },
};

// AWS와 IDC는 설치 불가 판정에 사유 코드가 붙지 않아요 — 분류만 아는 상태를 그대로 말합니다.
const UNKNOWN_GUIDE: Guide = {
  cause: '네트워크 구성 제약으로 Agent를 설치할 수 없는 리소스예요.',
};

/**
 * 읽기 전용 안내 — 제목 + 보조 텍스트 한 덩어리가 전부다. 카드도, 푸터도, ✕도 없고
 * 배경 클릭 / ESC 로 닫는다. 계층은 여백이 아니라 타입 램프가 만든다(아래 주석 참고).
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
      closeButton={false}
      title="설치 불가 사유"
      subtitle={
        // 한 덩어리 안에서 계층은 크기·굵기·명도로 준다(간격만으로는 다섯 줄이 평평하다).
        //   26px 제목 → 16px 굵은 원인 → 14px 회색 배경 → 14px 진한 조치 → 문의.
        // 배경이 조치보다 옅은 건 순서가 아니라 무게 때문 — 읽을 것은 조치다.
        <>
          <span className={cn('block', textStyles.cardTitle, textColors.primary)}>{guide.cause}</span>
          {guide.detail && <span className="mt-3 block">{guide.detail}</span>}
          {guide.remedy && (
            <span className={cn('mt-2 block', textColors.secondary)}>{guide.remedy}</span>
          )}
          {guide.doc && (
            <a
              href={guide.doc.href}
              target="_blank"
              rel="noopener noreferrer"
              /* 밑줄만으로 링크임을 말한다 — 굵기까지 주면 강조가 하나 더 는다. */
              className={cn('mt-2 inline-block underline underline-offset-2', textColors.secondary)}
            >
              {guide.doc.label}
            </a>
          )}
          {/* 문의는 사유·조치와 다른 이야기라 형제 간격(8px)이 아니라 그룹 간격(16px). */}
          <span className="mt-4 block">
            추가적인 문의사항이 있으면{' '}
            <strong className={cn('font-semibold', textColors.primary)}>협업 채널</strong>
            에 문의해주세요.
          </span>
        </>
      }
    >
      {/* 푸터도 ✕도 없다. 빈 본문의 pt-7+pb-2 = 36px 가 아래 여백이 되어 헤더의 pt-9 와
          맞는다. 닫기는 배경 클릭 / ESC. */}
      <div />
    </Modal>
  );
};
