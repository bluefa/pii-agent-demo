import type { ReactNode } from 'react';

import { cardStyles, cn, primaryColors } from '@/lib/theme';

/**
 * Step-4 카드 헤더 — 스텝 카드 문법(1·2·3·6·7과 동일): 단계 태그 · 제목 한 줄 → guidance.
 *
 * 파랑은 **사용자가 직접 해야 하는 행동**에만 붙인다. BDC 자동 설치처럼 시스템이
 * 하는 일은 평문으로 둔다 (Step 1 CandidateResourceSection 의 강조 규칙 그대로).
 *
 * Provider 표시는 두지 않는다 — 바로 위 identity bar 가 이미 같은 값을 말한다.
 */
export const InstallCardHeader = ({ action }: { action?: ReactNode }) => (
  <header className={cardStyles.header}>
    {/* 태그·제목이 왼쪽 한 덩어리, 보조 액션이 오른쪽. gap-4 는 그 둘 사이의 거리이고,
        태그와 제목 사이는 gap-2 — 둘은 한 줄에 있어도 다른 간격의 두 관계다. */}
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className={cardStyles.stepTag}>4단계</span>
        <h2 className={cardStyles.cardTitle}>Agent 설치</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {/* 2호흡: 무슨 일이 일어나는가 / 내가 할 일은 무엇인가.
        break-keep: 음절 고아 방지, 단어 단위로 감는다.

        제목과의 거리는 16px(group). 10px 이던 자리다 — 세트에 없는 값인 데다, 아래
        guidance 가 두 문단이라 그 둘 사이 간격(줄간격뿐)과 거의 같아져서 제목이 두 줄짜리
        덩어리에 붙어 버렸다. 거리도 계층의 레버라, 크기·굵기만으로는 답이 안 났다(오너). */}
    <p className={cn('mt-4 break-keep', cardStyles.guidance)}>
      승인된 연동 대상에 PII Agent 를 설치하는 단계예요. 리소스 생성은 BDC 가 자동으로
      진행하고, 서비스 측 계정에서만 할 수 있는 작업은 따로 모아 안내해요.
    </p>
    {/* 가리키는 대상은 레일의 '내가 할 일' 그룹이다 — 그룹 레일에는 '설치 현황 요약'
        단계가 없으므로, 예전 문구는 화면에 없는 것을 찾으라고 시키고 있었다. */}
    <p className={cn('break-keep', cardStyles.guidance)}>
      아래 내가 할 일에서{' '}
      <span className={primaryColors.text}>확인이 필요한 항목을 처리</span>해 주시면, 나머지
      설치는 자동으로 이어지고 완료되면 다음 단계로 넘어가요.
    </p>
  </header>
);
