'use client';

import { cn, statusColors, textColors } from '@/lib/theme';
import { StatTile } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';

/** Step 5 Credential 조회 필터. 판정 규칙은 화면(클라우드 / IDC)이 소유하고, 이 컴포넌트는 표시만 한다. */
export type CredFilter = 'all' | 'assigned' | 'missing';

export interface CredFilterCounts {
  all: number;
  assigned: number;
  missing: number;
}

interface CredFilterCardsProps {
  filter: CredFilter;
  onChange: (next: CredFilter) => void;
  counts: CredFilterCounts;
}

/**
 * Step 2 승인 통계와 같은 타일(StatTile)을 그대로 쓴다 — 같은 질문에 같은 카드, 선택 상태도
 * 그 타일이 이미 아는 문법(브랜드 경계)으로 말한다.
 *
 * 미등록 카드만 스스로 경고를 진다: Credential 이 비어 있으면 연결 테스트를 실행할 수 없으므로,
 * 세 장 중 조치가 필요한 한 장이 경고 테두리와 보조 문구를 갖는다.
 */
export const CredFilterCards = ({ filter, onChange, counts }: CredFilterCardsProps) => {
  const missingWarn = counts.missing > 0;
  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="Credential 필터">
      <StatTile
        label="전체 리소스"
        value={counts.all}
        unit="건"
        active={filter === 'all'}
        onClick={() => onChange('all')}
      />
      <StatTile
        label="Credential 지정한 리소스"
        value={counts.assigned}
        unit="건"
        active={filter === 'assigned'}
        onClick={() => onChange('assigned')}
      />
      <StatTile
        label="Credential 미등록 리소스"
        value={counts.missing}
        unit="건"
        active={filter === 'missing'}
        onClick={() => onChange('missing')}
        {...(missingWarn ? { tone: 'warning' as const } : {})}
        note={
          missingWarn ? (
            // break-keep: 한국어는 기본 규칙에서 아무 데서나 끊겨 "실행할 수 있 / 어요" 가 된다.
            // 어절 단위로 접고 마크는 첫 줄에 붙인다.
            <span
              className={cn(
                statusColors.warning.textDark,
                'inline-flex items-start gap-1 break-keep text-left',
              )}
            >
              <WarningIcon />
              {/* 버튼 이름("Run Test")을 그대로 쓰지 않는다 — 이 카드도 버튼이라 접근성
                  이름이 겹치고, 이름으로 컨트롤을 찾는 쪽에서 둘이 구분되지 않는다. */}
              설정해야 연결 테스트를 실행할 수 있어요
            </span>
          ) : (
            // 0건일 때도 한 줄을 유지한다 — 마지막 하나를 지정하는 순간 카드 높이가 튀지 않고,
            // 경고가 사라졌다는 사실 자체가 읽힌다.
            <span className={textColors.tertiary}>모두 지정되어 있어요</span>
          )
        }
      />
    </div>
  );
};

/** 경고는 색만으로 말하지 않는다(WCAG 1.4.1) — 문구 앞의 마크가 색 없이도 같은 뜻을 진다. */
const WarningIcon = () => (
  <svg
    className="h-3.5 w-3.5 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 3 1.5 21h21L12 3Z" strokeLinejoin="round" />
    <path d="M12 10v4" />
    <path d="M12 17.5v.01" />
  </svg>
);
