'use client';

import { Tooltip } from '@/app/components/ui/Tooltip';
import { InfoCircleIcon } from '@/app/components/ui/icons';
import { cn, idcStyles, textColors } from '@/lib/theme';

/**
 * 그룹 머리의 설명 — 두 수의 **관계**를 여기서 한 번만 말한다.
 *
 * `대상`과 `제외`가 나란히 서면 8 중 3 을 뺀 것처럼 읽힌다. 이 앱의 deny 모델에서 제외는
 * 정책이지 스캔 결과의 부분집합이 아니라, 두 수를 더해도 무엇의 전체도 되지 않는다.
 * 열 머리 두 개로는 말할 수 없고 행마다 되풀이할 수도 없는 사실이라, 그것을 덮는 그룹
 * 머리가 가진다.
 *
 * IDC(`IdcResourceTable`)와 클라우드(`WaitingApprovalTable` 의 confirmed variant)가 **같은**
 * 컴포넌트를 그린다. 손으로 베낀 두 번째 툴팁은 census 가 못 보는 사본이고, 문구가 바뀌는
 * 날 한쪽만 옛말로 남는다.
 */
export const LogicalDbGroupHeader = () => (
  <span className="inline-flex items-center gap-1">
    연동 논리 DB
    <Tooltip
      variant="value"
      size="lg"
      content={
        <span className={idcStyles.table.headerTipBody}>
          대상은 최근 연결 테스트가 찾아낸 논리 DB 수, 제외는 모니터링에서 빼 두도록 설정한
          수예요. 서로 다른 기준으로 세기 때문에 두 수를 더해도 전체가 되지 않아요.
        </span>
      }
    >
      <InfoCircleIcon className={cn('h-3.5 w-3.5', textColors.tertiary)} aria-label="연동 논리 DB 설명" />
    </Tooltip>
  </span>
);
