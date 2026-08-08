'use client';

import { Tooltip } from '@/app/components/ui/Tooltip';
import {
  RECOMMEND_FAIL_REASON_LABEL,
  normalizeRecommendFailReason,
} from '@/lib/types';
import { cn, textColors } from '@/lib/theme';

interface ExclusionReasonProps {
  /** `excluded_resource_infos[].exclusion_reason` — 사람이 쓴 사유. */
  reason?: string;
  /** `recommend_fail_reason` — 스캔이 내린 판정 코드. AWS·IDC 에는 없다. */
  recommendFailReason?: string;
  /** 사유 칸의 최대 폭. 표마다 열 폭이 달라 호출자가 정한다. */
  maxWidthClass?: string;
}

/**
 * 제외 사유 — hover 뒤가 아니라 표 안에 상시 2줄로 선다.
 *
 * 이전에는 15자로 자른 칩 하나였고 전문은 hover 팁 안에만 있었다. hover 전용 정보는
 * **비교할 수 없다**: 제외가 12건이면 사유 12개를 견주려고 12번 포인터를 오갔다 내려야 하고,
 * 승인 근거로 캡처해 남길 수도 없다. 15자는 특히 스캔 판정 코드에서 정보량이 0이었다 —
 * 세 값이 앞부분을 공유해 `AZURE_RESOURCE…` 로 잘리면 서로 구별되지 않는다.
 *
 * 2줄인 이유는 행 높이다. 사유는 대부분 한 줄에 들어가고, 두 줄을 넘기는 긴 사유 때문에
 * 표 전체가 들쭉날쭉해지면 다시 훑을 수 없게 된다. 넘치는 분량만 팁이 받는다.
 *
 * 등록자·일자는 싣지 않는다(오너 결정). 표는 "무엇이 왜 빠졌나"에만 답하고,
 * 누가 언제는 요청 상세가 답한다.
 */
export const ExclusionReason = ({
  reason,
  recommendFailReason,
  maxWidthClass = 'max-w-[260px]',
}: ExclusionReasonProps) => {
  // 어댑터가 판정 코드를 `exclusion_reason` 에 그대로 써 넣기도 하므로 두 필드 모두에서
  // enum 을 찾는다 — 어느 쪽으로 들어와도 코드가 아니라 한국어 한 줄이 보여야 한다.
  const code =
    normalizeRecommendFailReason(recommendFailReason) ?? normalizeRecommendFailReason(reason);
  const text = code ? RECOMMEND_FAIL_REASON_LABEL[code] : reason;
  if (!text) return null;

  return (
    <div className={cn('flex flex-col gap-1', maxWidthClass)}>
      <Tooltip content={text} variant="value" size="md" truncatedOnly>
        <span
          className={cn(
            'block overflow-hidden text-[12px] leading-[1.45] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]',
            textColors.secondary,
          )}
        >
          {text}
        </span>
      </Tooltip>
      {/* 원문 코드는 남긴다 — 엔지니어는 이 문자열로 검색하고 문의한다. */}
      {code && (
        <span
          className={cn('block truncate font-mono text-[10px] leading-[1.4]', textColors.tertiary)}
        >
          {code}
        </span>
      )}
    </div>
  );
};
