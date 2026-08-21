import type { IconProps } from '@/app/components/ui/icons/types';
import { tcActivityMarch } from '@/lib/theme';

const WAVE = 'M3 12h4l2.5-6 4 12 2.5-6h5';

/**
 * 활동 파형 — 라이브로 값이 갱신되는 국면(Step 5 연결 테스트 진행 중)의 글리프.
 *
 * 도는 시계를 대신한다. 시계는 바깥 원이 회전 대칭이라 돌아도 화면이 변하지 않고,
 * 같은 글리프를 queued 도 쓰기 때문에 motion-reduce 에서 두 상태가 구분되지 않았다.
 *
 * 두 겹이다. 아래는 25% 불투명도의 트랙, 위는 밝은 마디 하나가 dashoffset 을 타고
 * 왼→오로 지나간다 — 파형을 회전시키면 안 되므로 도는 대신 흐른다. 모션이 꺼지면
 * 마디가 제자리에 멈추고 트랙이 형태를 유지하므로, 애니메이션이 상태의 유일한
 * 채널이 되지 않는다(Primer: 정보를 애니메이션만으로 전달하지 말 것).
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
    <path d={WAVE} strokeOpacity={0.25} />
    {/* 9 on / 26 off ≈ path 길이 35 — 마디 하나만 살아 움직인다. */}
    <path d={WAVE} strokeDasharray="9 26" className={tcActivityMarch} />
  </svg>
);
