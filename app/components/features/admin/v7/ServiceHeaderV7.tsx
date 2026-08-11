'use client';

import { Button } from '@/app/components/ui/Button';
import {
  borderColors,
  cardStyles,
  cn,
  numericFeatures,
  pageHeaderTitleStyle,
  primaryColors,
  rowLabelColor,
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
        {/* The product's name in the product's colour — it is the one proper noun in
            the sentence, and bold-black made it a second heading under the h1.
            `textOnLight`, not `text`: this sentence sits on the canvas (#F4F4FB), not on
            white, where #0064FF measures 4.4951:1 — under AA by half a hundredth. */}
        <strong className={cn('font-semibold', primaryColors.textOnLight)}>PII Agent</strong>를 설치할
        계정을 등록하고, 계정별 설치 진행을 관리합니다.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* `서비스 이름`, not `서비스`: the code tag sits right beside it, so the label
            has to say which of the two it names. */}
        <span className={cn('text-[12px] font-medium', rowLabelColor)}>서비스 이름</span>
        {/* `medium`: this line identifies context, not the page's subject — the h1
            above already holds that, and at semibold the two competed. */}
        <span className={cn('text-[16px] font-medium tracking-[-0.01em]', textColors.primary)}>
          {serviceName || serviceCode}
        </span>
        {serviceName && (
          <span
            className={cn(
              // 테두리가 태그를 만든다. 면만 두면 이 칩은 사라진다 — 헤더가 앉는 캔버스는
              // #F4F4FB 라 gray-100(#F3F4F6) 과 사실상 같은 값이고, 채워도 채운 자리가
              // 보이지 않았다. gray-300 모서리는 그 바닥에서 1.4.11 의 3:1 을 넘긴다.
              'inline-flex items-center rounded-[6px] border px-2 py-0.5 font-mono text-[12px] font-semibold',
              tagStyles.gray,
              borderColors.strong,
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
    {/* 이 화면의 CTA. 페이지에 채워진 버튼은 이것 하나뿐이라 primary 를 써도 다투는
        상대가 없다 — ink 는 같은 무게를 검정으로 냈을 뿐, 이 행동이 브랜드 동선의
        시작이라는 말은 못 했다. */}
    <Button variant="primary" onClick={onAddInfra} className="flex flex-none items-center gap-1.5">
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
      인프라 등록
    </Button>
  </div>
);
