import { useId } from 'react';
import type { IconProps } from '@/app/components/ui/icons/types';
import { cn, tcHourglass } from '@/lib/theme';

/** 위 벌브의 벽 — 열린 path 는 윤곽선으로, `Z` 로 닫으면 모래를 가둘 clip 영역으로 쓴다. */
const TOP_BULB = 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2';
const BOTTOM_BULB = 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22';

/**
 * 모래시계 — 접수됐지만 아직 아무것도 돌지 않는 국면(Step 5 연결 테스트 시작 대기).
 *
 * 시계와 가르는 것이 이 글리프의 일이다. `idle`(실행 자체가 없음)이 시계를 쓰므로,
 * 대기가 같은 시계를 달면 "실행이 없다"와 "실행을 기다린다"가 한 그림이 된다.
 *
 * ⛔ 두 벌브 path 는 (12,12) 기준 180° 회전 대칭이고, 이 대칭이 모션의 전제다 —
 * 모래가 다 떨어진 프레임을 반 바퀴 돌리면 가득 찬 시작 프레임과 화소 단위로 같아서,
 * 무한 루프의 되감기가 뒤집기 안에 숨는다. 대칭을 깨는 기하 변경(한쪽 벌브만 손보기,
 * 모래 무덤을 원뿔로 그리기)은 globals.css 의 세 키프레임을 같이 깬다.
 *
 * 모션은 이 글리프에 내장이다(ActivityIcon 과 같은 결정). 셋을 호출부에 흩으면 유리만
 * 도는 조립이 가능해지는데, 그건 모래가 공중에서 멈춘 채 뒤집히는 그림이다.
 *
 * 18px 에서 벌브 안쪽은 7.5px 다 — 수위는 그 안에서 읽히지만 낙사 줄기(1유닛 = 0.75px)와
 * 알갱이는 서브픽셀이라 그리지 않는다. 흔한 모래시계 로더가 100px 이상을 전제로 그
 * 둘을 그리는 것과 갈리는 지점이고, 여기서 줄기를 넣으면 흐린 점 하나가 남는다.
 *
 * 윤곽 기하는 Lucide `hourglass` 그대로다(Figma H2kRxFxOqqeTrPceFU4zMM 의 queued
 * 프레임이 쓰는 바로 그 아이콘 — 18px 렌더의 잉크 맵으로 대조했다). 모래 채움 둘은
 * 그 위에 얹은 것이라 ⚠️ Figma 보다 코드가 앞서 있다. 같은 슬롯의 ClockIcon 도 같은
 * 출처라 두 글리프의 획과 여백이 어긋나지 않는다. 어깨(막대 아래 짧은 수직 구간)를
 * 지우지 말 것 — 그게 없으면 나비넥타이로 읽힌다.
 */
export const HourglassIcon = ({ className, ...rest }: IconProps) => {
  // clipPath 는 문서 전역 id 로 참조된다 — 이 글리프가 한 화면에 둘 서면 뒤엣것이
  // 앞엣것의 clip 을 물어 모래가 엉뚱한 벌브에 갇힌다.
  const uid = useId();
  const topClip = `hg-top-${uid}`;
  const bottomClip = `hg-bottom-${uid}`;

  return (
    <svg
      className={cn(className, tcHourglass.glass)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden={!rest['aria-label']}
      {...rest}
    >
      <defs>
        <clipPath id={topClip}>
          <path d={`${TOP_BULB}Z`} />
        </clipPath>
        <clipPath id={bottomClip}>
          <path d={`${BOTTOM_BULB}Z`} />
        </clipPath>
      </defs>
      {/*
        모래는 벌브를 통째로 덮는 사각형이고, 벌브 모양으로 clip 된 채 위아래로 움직인다.
        잘려 나간 만큼이 곧 수위라, 벌브의 사선 폭을 계산할 필요가 없다.
        ⚠️ 빈 상태는 CSS 가 아니라 SVG `transform` 속성이 든다 — 그래야 motion-reduce 로
        애니메이션이 죽어도 "위가 찬 모래시계"라는 정지 그림이 남는다(애니메이션이 상태의
        유일한 채널이 되면 안 된다). CSS 애니메이션은 속성보다 우선하므로 켜지면 덮는다.
        0.42 — 윤곽(currentColor 전량)과 같은 잉크를 쓰되 벽으로 읽히지 않는 농도.
      */}
      <g clipPath={`url(#${topClip})`}>
        <rect
          className={tcHourglass.drain}
          x="6"
          y="1"
          width="12"
          height="11"
          fill="currentColor"
          fillOpacity={0.42}
          stroke="none"
        />
      </g>
      <g clipPath={`url(#${bottomClip})`}>
        <rect
          className={tcHourglass.fill}
          x="6"
          y="11"
          width="12"
          height="11"
          fill="currentColor"
          fillOpacity={0.42}
          stroke="none"
          transform="translate(0 11)"
        />
      </g>
      {/* 윤곽은 모래 위에 — 채움이 획을 반쯤 덮으면 18px 에서 벽이 얇아 보인다. */}
      <path d="M5 2h14M5 22h14" />
      <path d={TOP_BULB} />
      <path d={BOTTOM_BULB} />
    </svg>
  );
};
