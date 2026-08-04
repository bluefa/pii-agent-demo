'use client';

import { cardStyles, cn, primaryColors } from '@/lib/theme';
import { StatTile } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';

/** Step 5 Credential 조회 필터. 판정 규칙은 화면(클라우드 / IDC)이 소유하고, 이 컴포넌트는 표시만 한다. */
export type CredFilter = 'all' | 'assigned' | 'missing';

export interface CredFilterCounts {
  all: number;
  assigned: number;
  missing: number;
}

const CARDS: ReadonlyArray<{
  value: CredFilter;
  label: string;
  swatch?: 'target' | 'exclude';
}> = [
  { value: 'all', label: '전체 리소스' },
  { value: 'assigned', label: 'Credential 지정한 리소스', swatch: 'target' },
  { value: 'missing', label: 'Credential 미등록 리소스', swatch: 'exclude' },
];

interface CredFilterCardsProps {
  filter: CredFilter;
  onChange: (next: CredFilter) => void;
  counts: CredFilterCounts;
}

/** Step 2 승인 통계와 같은 타일(StatTile)을 클릭 필터로 쓴다 — 같은 질문에 같은 카드. */
export const CredFilterCards = ({ filter, onChange, counts }: CredFilterCardsProps) => (
  <div className="grid grid-cols-3 gap-3" role="group" aria-label="Credential 필터">
    {CARDS.map((card) => {
      const active = filter === card.value;
      return (
        <button
          key={card.value}
          type="button"
          onClick={() => onChange(card.value)}
          aria-pressed={active}
          // 카드는 버튼처럼 보이지 않으므로 포인터 커서가 유일한 클릭 어포던스다.
          className={cn(
            'block w-full cursor-pointer rounded-xl text-left',
            active ? cardStyles.ringSelected : cardStyles.ringRest,
            primaryColors.focusRing,
          )}
        >
          <StatTile label={card.label} value={counts[card.value]} unit="건" swatch={card.swatch} />
        </button>
      );
    })}
  </div>
);
