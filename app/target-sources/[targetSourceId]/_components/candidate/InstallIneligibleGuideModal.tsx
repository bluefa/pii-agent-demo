'use client';

import { Modal } from '@/app/components/ui/Modal';
import { cn, primaryColors, stackGap, textColors, textStyles } from '@/lib/theme';
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
  /** 왜 실패했는지 — 본문 첫 문장이자 이 모달의 유일한 색 강조. */
  cause: string;
  /** 원인을 이해하게 만드는 배경. 같은 문단으로 이어 붙인다. 추측이 될 자리에서는 비워 둔다. */
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
    // 조치 방법 없음 — 서브넷을 바꾸려면 인스턴스를 옮겨야 하고, 그 마이그레이션 비용은
    // 이 모달이 한 줄로 권할 수 있는 크기가 아니다. 제약만 말하고 판단은 협업 채널로 넘긴다.
    doc: { href: GCP_GUIDE_URLS.CLOUD_SQL_PSC, label: 'Cloud SQL Private Service Connect 문서' },
  },
};

// AWS와 IDC는 설치 불가 판정에 사유 코드가 붙지 않아요 — 분류만 아는 상태를 그대로 말합니다.
const UNKNOWN_GUIDE: Guide = {
  cause: '네트워크 구성 제약으로 Agent를 설치할 수 없는 리소스예요.',
};

/**
 * 보조 묶음 이름 — 본문(13px)보다 작고 옅은 12px. 리드 문단이 계층의 꼭대기라
 * 라벨은 위치만 알려주고 물러선다.
 */
const SupportLabel = ({ children }: { children: string }) => (
  <h3 className={cn(textStyles.captionStrong, textColors.tertiary)}>{children}</h3>
);

/**
 * 보조 묶음 본문 — 13/18. 램프(14/12) 밖 값이지만 Figma 가 의도한 중간 단계다:
 * 14 로 올리면 리드 문단과 같아져 강등이 사라지고, 12 로 내리면 라벨과 같아진다.
 */
const supportText = 'text-[13px] font-normal leading-[18px] tracking-[-0.01em]';

/**
 * 읽기 전용 안내 — 리드 문단(원인+배경) 하나, 그 아래 조치 방법 / 공식 문서 / 문의.
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
      chrome="toss-compact"
      size="lg"
      closeButton={false}
      title="설치 불가 사유"
    >
      {/* 계층은 두 겹이다. 리드 문단이 "왜 안 되는지"를 혼자 들고 있고 — 첫 문장만
          파란색이라 라벨 없이도 판정문으로 읽힌다 — 나머지는 12px 라벨을 단 보조
          묶음으로 내려간다. 리드↔보조 20px, 보조 내부는 라벨·본문 구분 없이 8px.
          푸터도 ✕도 없다 — 배경 클릭 / ESC 로 닫는다. */}
      <div className="flex flex-col gap-5">
        <p className={cn(textStyles.body, textColors.primary)}>
          <span className={primaryColors.text}>{guide.cause}</span>
          {guide.detail && ` ${guide.detail}`}
        </p>

        <div className={cn('flex flex-col', stackGap.related, supportText, textColors.secondary)}>
          {guide.remedy && (
            <>
              <SupportLabel>조치 방법</SupportLabel>
              <p>{guide.remedy}</p>
            </>
          )}

          {guide.doc && (
            <>
              <SupportLabel>공식 문서</SupportLabel>
              <a
                href={guide.doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start underline underline-offset-2"
              >
                {guide.doc.label}
              </a>
            </>
          )}

          <SupportLabel>문의</SupportLabel>
          <p>
            추가적인 문의사항이 있으면{' '}
            <strong className={cn('font-semibold', textColors.primary)}>협업 채널</strong>
            에 문의해주세요.
          </p>
        </div>
      </div>
    </Modal>
  );
};
