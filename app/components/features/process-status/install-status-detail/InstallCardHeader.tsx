import type { ReactNode } from 'react';

import { cardStyles, cn, primaryColors } from '@/lib/theme';

/**
 * Step-4 카드 헤더 — 스텝 카드 문법(1·2·3·6·7과 동일): 단계 태그 → 제목 → guidance.
 *
 * 파랑은 **사용자가 직접 해야 하는 행동**에만 붙인다. BDC 자동 설치처럼 시스템이
 * 하는 일은 평문으로 둔다 (Step 1 CandidateResourceSection 의 강조 규칙 그대로).
 *
 * Provider 표시는 두지 않는다 — 바로 위 identity bar 가 이미 같은 값을 말한다.
 */
export const InstallCardHeader = ({ action }: { action?: ReactNode }) => (
  <header className={cardStyles.header}>
    <span className={cardStyles.stepTag}>4번째 단계</span>
    {/* 단계 태그가 윗줄을 차지하므로, 제목과 보조 액션이 한 줄을 나눠 갖는다. */}
    <div className="flex items-center justify-between gap-4">
      <h2 className={cardStyles.cardTitle}>Agent 설치</h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {/* 2호흡: 무슨 일이 일어나는가 / 내가 할 일은 무엇인가.
        break-keep: 음절 고아 방지, 단어 단위로 감는다. */}
    <p className={cn('mt-2.5 break-keep', cardStyles.guidance)}>
      승인된 연동 대상에 PII Agent 를 설치하는 단계예요. 리소스 생성은 BDC 가 자동으로
      진행하고, 서비스 측 계정에서만 할 수 있는 작업은 따로 모아 안내해요.
    </p>
    <p className={cn('break-keep', cardStyles.guidance)}>
      아래 설치 현황 요약에서{' '}
      <span className={primaryColors.text}>확인이 필요한 항목을 처리</span>해 주시면, 나머지
      설치는 자동으로 이어지고 완료되면 다음 단계로 넘어가요.
    </p>
  </header>
);
