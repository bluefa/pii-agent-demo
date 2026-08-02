'use client';

import { Modal } from '@/app/components/ui/Modal';
import { cn, stackGap, textColors, textStyles } from '@/lib/theme';
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

/** 묶음 이름 — 본문보다 한 단계 큰 소제목. 구조를 눈으로 먼저 잡게 한다. */
const GroupLabel = ({ children }: { children: string }) => (
  <h3 className={cn(textStyles.cardTitle, textColors.primary)}>{children}</h3>
);

/**
 * 읽기 전용 안내 — 제목 아래로 원인 / 조치 방법 / 공식 문서 / 문의 네 묶음.
 * 카드도, 푸터도, ✕도 없다.
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
    >
      {/* 사용자가 던지는 질문 순서대로 네 묶음 — 왜 안 되는지 / 뭘 해야 하는지 /
          어디서 확인하는지 / 누구에게 묻는지. 소제목↔본문 8px, 묶음 사이
          16px. 계층을 글자 크기로만 주면 14px 문장들이 평평해져 보이지 않는다.
          푸터도 ✕도 없다 — 배경 클릭 / ESC 로 닫는다. */}
      <div className={cn('flex flex-col pb-7', stackGap.group, textStyles.body, textColors.secondary)}>
        <section className={cn('flex flex-col', stackGap.related)}>
          <GroupLabel>원인</GroupLabel>
          <p className={textColors.primary}>{guide.cause}</p>
          {guide.detail && <p>{guide.detail}</p>}
        </section>

        {guide.remedy && (
          <section className={cn('flex flex-col', stackGap.related)}>
            <GroupLabel>조치 방법</GroupLabel>
            <p>{guide.remedy}</p>
          </section>
        )}

        {guide.doc && (
          <section className={cn('flex flex-col', stackGap.related)}>
            <GroupLabel>공식 문서</GroupLabel>
            <a
              href={guide.doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start underline underline-offset-2"
            >
              {guide.doc.label}
            </a>
          </section>
        )}

        <section className={cn('flex flex-col', stackGap.related)}>
          <GroupLabel>문의</GroupLabel>
          <p>
            추가적인 문의사항이 있으면{' '}
            <strong className={cn('font-semibold', textColors.primary)}>협업 채널</strong>
            에 문의해주세요.
          </p>
        </section>
      </div>
    </Modal>
  );
};
