'use client';

import { Modal } from '@/app/components/ui/Modal';
import { useLocale } from '@/app/components/LocaleProvider';
import { cn, primaryColors, stackGap, textColors, textStyles } from '@/lib/theme';
import { AZURE_GUIDE_URLS, AZURE_NETWORKING_MODE_LABELS } from '@/lib/constants/azure';
import { GCP_GUIDE_URLS } from '@/lib/constants/gcp';
import type { RecommendFailReason } from '@/lib/types';
import { CANDIDATE_COPY } from '@/app/target-sources/[targetSourceId]/_components/candidate/copy';

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

type IneligibleCopy = (typeof CANDIDATE_COPY)['ko']['ineligible'];

// One entry per `recommend_fail_reason`. Every 원인/조치 문장은 CSP 가 문서로 못 박은
// 제약이거나 그 제약의 직접적인 귀결이어야 한다 — 운영 인프라를 잘못 건드리게 만드는
// 조치 안내는 안내가 없는 것보다 나쁘다.
const guidesFor = (t: IneligibleCopy): Record<RecommendFailReason, Guide> => ({
  // 주어가 바뀌었다: "연결에 실패했다"는 한 번 더 해보면 될 것처럼 읽혔지만, 실제 사실은
  // 서버가 배포된 방식이라 몇 번을 시도해도 결과가 같다. 원인 문장이 그 사실을 직접 말한다.
  AZURE_RESOURCE_VNET_INTEGRATED_MODE: {
    cause: t.azureVnetCause(AZURE_NETWORKING_MODE_LABELS.VNET_INTEGRATION),
    detail: t.azureVnetDetail,
    remedy: t.azureVnetRemedy(AZURE_NETWORKING_MODE_LABELS.PUBLIC_ACCESS),
    doc: { href: AZURE_GUIDE_URLS.VNET_NETWORKING, label: t.azureVnetDoc },
  },
  GCP_CLOUD_SQL_HAS_PUBLIC_IP: {
    cause: t.gcpPublicIpCause,
    detail: t.gcpPublicIpDetail,
    remedy: t.gcpPublicIpRemedy,
    doc: { href: GCP_GUIDE_URLS.CLOUD_SQL_PSC, label: t.cloudSqlPscDoc },
  },
  GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET: {
    cause: t.gcpLbSubnetCause,
    detail: t.gcpLbSubnetDetail,
    // 조치 방법 없음 — 서브넷을 바꾸려면 인스턴스를 옮겨야 하고, 그 마이그레이션 비용은
    // 이 모달이 한 줄로 권할 수 있는 크기가 아니다. 제약만 말하고 판단은 협업 채널로 넘긴다.
    doc: { href: GCP_GUIDE_URLS.CLOUD_SQL_PSC, label: t.cloudSqlPscDoc },
  },
});

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
  const { locale } = useLocale();
  const t = CANDIDATE_COPY[locale].ineligible;
  // AWS와 IDC는 설치 불가 판정에 사유 코드가 붙지 않아요 — 분류만 아는 상태를 그대로 말합니다.
  const guide = recommendFailReason
    ? guidesFor(t)[recommendFailReason]
    : { cause: t.unknownCause };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      chrome="toss-compact"
      size="lg"
      closeButton={false}
      title={t.title}
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
              <SupportLabel>{t.remedyLabel}</SupportLabel>
              <p>{guide.remedy}</p>
            </>
          )}

          {guide.doc && (
            <>
              <SupportLabel>{t.docLabel}</SupportLabel>
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

          <SupportLabel>{t.contactLabel}</SupportLabel>
          <p>
            {t.contactLead}
            <strong className={cn('font-semibold', textColors.primary)}>{t.contactChannel}</strong>
            {t.contactTail}
          </p>
        </div>
      </div>
    </Modal>
  );
};
