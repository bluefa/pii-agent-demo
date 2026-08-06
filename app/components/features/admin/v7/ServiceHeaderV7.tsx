'use client';

import { Button } from '@/app/components/ui/Button';
import {
  borderColors,
  cardStyles,
  cn,
  numericFeatures,
  pageHeaderTitleStyle,
  statusColors,
  tagStyles,
  textColors,
} from '@/lib/theme';

interface ServiceHeaderV7Props {
  serviceCode: string;
  serviceName: string;
  onAddInfra: () => void;
}

/**
 * The page's own subject, not the service's. What this screen lists is the set of
 * accounts PII Agent will be installed into — the H1 says that, and the service
 * identity drops to a labelled line underneath, where a 30-char service name and a
 * fixed 3-char code can sit side by side without either becoming the page title.
 */
export const ServiceHeaderV7 = ({
  serviceCode,
  serviceName,
  onAddInfra,
}: ServiceHeaderV7Props) => (
  <div className={cn('flex items-start justify-between gap-6 mb-5 pb-5 border-b', borderColors.default)}>
    <div className="flex-1 min-w-0">
      <h1 className={pageHeaderTitleStyle}>PII Agent 연동 대상 계정</h1>
      <p className={cn('mt-1.5', cardStyles.subtitle)}>
        <strong className={cn('font-bold', textColors.primary)}>PII Agent</strong>를 설치할 계정을
        등록하고, 계정별 설치 진행을 관리합니다.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={cn('text-[12px]', textColors.tertiary)}>서비스</span>
        <span className={cn('text-[16px] font-semibold tracking-[-0.01em]', textColors.primary)}>
          {serviceName || serviceCode}
        </span>
        {serviceName && (
          <span
            className={cn(
              'rounded-[6px] px-2 py-0.5 font-mono text-[12px]',
              tagStyles.gray,
              numericFeatures.tabular,
            )}
          >
            {serviceCode}
          </span>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
            statusColors.success.bg,
            statusColors.success.textDark,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.success.dot)} />
          운영 중
        </span>
      </div>
    </div>
    <Button variant="ink" onClick={onAddInfra} className="flex flex-none items-center gap-1.5">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      계정 등록
    </Button>
  </div>
);
