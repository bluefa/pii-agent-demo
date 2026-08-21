import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * 활동 파형 — 라이브로 값이 갱신되는 국면(Step 5 연결 테스트 진행 중)의 글리프.
 *
 * 도는 시계를 대신한다. 시계는 바깥 원이 회전 대칭이라 돌아도 화면이 변하지 않고,
 * 같은 글리프를 queued 도 쓰기 때문에 motion-reduce 에서 두 상태가 구분되지 않았다.
 * 파형은 정지 상태에서도 "움직이는 값"으로 읽혀 모션이 유일한 채널이 되지 않는다
 * (Cloudscape 는 in-progress 를 아예 정적 아이콘으로 규정한다).
 *
 * 획은 2.4 — 15px 로 줄면 얇아지므로, 작은 크기에서 획을 두껍게 가져가는
 * Carbon Loading small 변형과 같은 방향이다.
 */
export const ActivityIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
  </svg>
);
