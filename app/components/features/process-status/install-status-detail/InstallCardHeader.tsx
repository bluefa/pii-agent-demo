import type { ReactNode } from 'react';

import { cardStyles, cn, primaryColors } from '@/lib/theme';

/**
 * Step-4 카드 헤더 — 스텝 카드 문법(1·2·3·6·7과 동일): 단계 태그 · 제목 한 줄 → guidance.
 *
 * 파랑은 **사용자가 찾아갈 자리와 거기서 처리할 항목**에 붙인다 — 레일의 '내가 할 일'
 * 그룹과 그 안의 작업 항목. 뒤따르는 행동(확인·진행)은 그 항목을 잡으면 따라오므로
 * 평문이고, BDC 자동 설치처럼 시스템이 하는 일도 평문으로 둔다.
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
      연동 대상 DB에 PII Agent를 설치하는 단계예요. BDC에서도 관련된 리소스 생성 작업을 진행할
      예정이에요.
    </p>
    {/* 가리키는 대상은 레일의 '내가 할 일' 그룹이다 — 그룹 레일에는 '설치 현황 요약'
        단계가 없으므로, 예전 문구는 화면에 없는 것을 찾으라고 시키고 있었다. */}
    <p className={cn('break-keep', cardStyles.guidance)}>
      <span className={primaryColors.text}>내가 할 일에서 작업할 항목</span>을 확인한 후
      진행해주시고, 모든 절차가 완료되면 다음 단계로 넘어가요.
    </p>
  </header>
);
