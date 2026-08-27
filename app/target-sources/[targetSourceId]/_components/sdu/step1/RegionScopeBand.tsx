'use client';

import { LockIcon } from '@/app/components/ui/icons';
import { cn, segmentedControlStyles } from '@/lib/theme';
import { SDU_REGION_SCOPES, type SduRegionScope } from '@/lib/types/sdu';
import { SDU_SCOPE_LOCKED_HINT } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/model';
import { bandStyles } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/styles';

const SCOPE_LABEL: Record<SduRegionScope, string> = {
  GLOBAL: 'Global',
  CHINA: 'China',
};

export interface RegionScopeBandProps {
  scope: SduRegionScope;
  /** 대상이 하나라도 있으면 잠긴다 — 바꾸는 순간 저장된 Region 이 없는 값이 된다. */
  locked: boolean;
  onChange: (scope: SduRegionScope) => void;
}

/**
 * 연동 권역 — 대상 목록 **위**에 서는 값이다. 행마다 고르는 Region 과 달리 대상소스에
 * 하나뿐이고, 두 권역은 계정·버킷·엔드포인트가 통째로 다른 세계라 한 대상소스가 양쪽에
 * 걸칠 수 없다. 그래서 목록 안이 아니라 목록 앞에 놓인다.
 */
export const RegionScopeBand = ({ scope, locked, onChange }: RegionScopeBandProps) => (
  <div className={bandStyles.frame}>
    <div>
      <p className={bandStyles.label}>연동 권역</p>
      <p className={bandStyles.sub}>Global은 Asia · US · EU · CX, China는 China만</p>
    </div>

    <div
      role="radiogroup"
      aria-label="연동 권역"
      className={cn(segmentedControlStyles.container, 'ml-auto')}
    >
      {SDU_REGION_SCOPES.map((option) => {
        const selected = option === scope;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={locked}
            onClick={() => onChange(option)}
            className={cn(
              segmentedControlStyles.item,
              selected && segmentedControlStyles.itemActive,
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {SCOPE_LABEL[option]}
          </button>
        );
      })}
    </div>

    {/* 못 누른다는 사실과 왜 못 누르는지는 다른 정보다. 잠긴 컨트롤은 자기 이유를
        옆에 두지 않으면 고장으로 읽힌다. */}
    {locked && (
      <p className={bandStyles.lockHint}>
        <LockIcon className="h-3.5 w-3.5" />
        {SDU_SCOPE_LOCKED_HINT}
      </p>
    )}
  </div>
);
