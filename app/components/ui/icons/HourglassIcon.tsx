import type { IconProps } from '@/app/components/ui/icons/types';

/**
 * 모래시계 — 접수됐지만 아직 아무것도 돌지 않는 국면(Step 5 연결 테스트 시작 대기).
 *
 * 시계와 가르는 것이 이 글리프의 일이다. `idle`(실행 자체가 없음)이 시계를 쓰므로,
 * 대기가 같은 시계를 달면 "실행이 없다"와 "실행을 기다린다"가 한 그림이 된다.
 * 세 path 는 (12,12) 기준 180° 회전 대칭이다. 이 대칭이 이 글리프의 모션을 정한다 —
 * 반 바퀴 뒤집으면 제자리로 돌아오므로 `tcHourglassFlip`(theme.ts)이 되감기 없이 돈다.
 * ⛔ 이 대칭을 깨는 기하 변경(모래 알갱이, 한쪽만 채우기)은 그 토큰을 같이 깬다.
 *
 * 기하는 Lucide `hourglass` 그대로다(Figma H2kRxFxOqqeTrPceFU4zMM 의 queued 프레임이
 * 쓰는 바로 그 아이콘 — 18px 렌더의 잉크 맵으로 대조했다). 같은 슬롯의 ClockIcon 도
 * 같은 출처라 두 글리프의 획과 여백이 어긋나지 않는다. 어깨(막대 아래 짧은 수직
 * 구간)를 지우지 말 것 — 그게 없으면 나비넥타이로 읽힌다.
 */
export const HourglassIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path d="M5 2h14M5 22h14" />
    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
  </svg>
);
