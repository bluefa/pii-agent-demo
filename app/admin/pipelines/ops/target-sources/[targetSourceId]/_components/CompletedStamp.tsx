/**
 * 최초 연동 도장 (design-benchmark `integration-completed-stamp.md`, 시안 G).
 *
 * 이 앱에는 "끝났다"를 말하는 형태가 없었다 — 7단계가 전부 같은 알약이고 색만 달랐다.
 * 도장은 그 자리를 메우되 두 가지를 지킨다:
 *
 *   1. **날짜를 품는다.** 영수증 도장의 규칙이다 — 날짜가 찍히는 순간 도장은 선언이
 *      아니라 기록이 된다. 완료 선언과 그 시각이 두 요소로 흩어지지 않는다.
 *   2. **최초 1회만 찍힌다.** 값은 `piiAgentFirstInstalledAt` 이고, 이 값은 초기화
 *      (`resetTargetSource` — "초기(IDLE) 상태로 강제 초기화")로 1단계까지 되돌아가도
 *      움직이지 않는다. 그래서 도장은 **현재 단계와 무관한 사실**을 말한다: 지금 몇
 *      단계인지는 옆의 단계 알약이 말하고, 도장은 "이 계정은 연동을 마친 적 있다"만
 *      말한다. 두 표식이 같은 것을 두 번 말하지 않는다.
 *
 *      ⚠️ 이 불변성의 출처는 **도메인 오너 확인**이다. 계약은 이 필드를 네 스키마에
 *      선언하면서 `type`/`format` 만 적고 description 을 한 줄도 달지 않는다 — 초기화가
 *      무엇을 지우는지도 `resetTargetSource` 설명에 없다. 이 저장소의 다른 주석들이
 *      같은 성질을 사실처럼 적고 있으니, 근거를 물을 일이 생기면 여기가 출처다.
 *
 * 면은 흰색, 획만 초록이다. 카드 hover 가 보라(`tableRowLift.card`)라 색 면을 쓰면
 * 그 한 상태에서 도장이 배경과 부딪힌다 — 흰 면 + 색 획은 두 표면을 다 견딘다.
 * 회전 −4°는 `transform` 이라 레이아웃 박스를 건드리지 않는다: 120px 카드(LIN-92)의
 * 높이 예산을 한 픽셀도 쓰지 않는다.
 */
import { type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { fmtDate, fmtDateTime } from '@/lib/pipeline/format';

/**
 * 목록 20px / 상세 24px. 상세의 24px 는 이 화면 h1(`pipelineStyles.text.pageTitle`)과
 * 같은 급이고, 목록의 20px 는 그 아래 한 단이다 — 카드 제목이 16px 이므로 도장이 그
 * 위에 서면서도 페이지 제목을 넘지 않는다.
 */
type StampSize = 'md' | 'lg';

const SIZE: Record<StampSize, { box: string; date: string }> = {
  md: { box: 'px-3 pt-[5px] pb-1.5', date: 'text-[20px]' },
  lg: { box: 'px-3.5 pt-1.5 pb-2', date: 'text-[24px]' },
};

/** 도장 문구. "1회" 가 하는 일: 이 값은 다시 찍히지 않는다는 것까지 말한다. */
const STAMP_LABEL = '최초 1회 연동 완료';

/**
 * 목록에서 도장이 앉을 자리의 폭. 대상마다 도장이 있고 없고가 갈리므로, 없는 행에서도
 * 옆 칸이 같은 자리에서 시작하도록 미리 잡아 둔다.
 *
 * 브라우저 실측(Pretendard, 20px/700 tabular): 'YYYY-MM-DD' 121.8px + 좌우 여백
 * 24px + 테두리 4px = 151.6px, 여기에 −4° 회전이 가로로 4.3px 을 더해 155.9px.
 * 어림한 값으로 잡았다가 4px 이 모자라 날짜가 두 줄로 접혔다 — 그래서 실측이다.
 * 문구(12px)는 날짜보다 좁아 폭을 정하지 않는다. 도장 양옆 간격은 카드의 `gap-3.5`.
 *
 * `md` 기준값이다. 자리를 예약하는 곳은 목록뿐이고 목록은 `md` 만 쓴다 — `lg` 로
 * 예약하려면 그 크기를 다시 재야 한다(24px 날짜는 이 폭에 안 들어간다).
 */
const SLOT_W = 'w-[160px]';

export interface CompletedStampProps {
  /** `piiAgentFirstInstalledAt`. 없으면 최초 연동 기록이 없다는 뜻이라 도장도 없다. */
  firstInstalledAt: string | null | undefined;
  size?: StampSize;
  className?: string;
}

/**
 * 도장 자체. 값이 없으면 아무것도 그리지 않는다 — 이 표식은 **긍정 표식**이라
 * "아직 안 됐다"를 주장하지 않는다(그 자리는 단계 알약이다).
 */
export function CompletedStamp({
  firstInstalledAt,
  size = 'md',
  className,
}: CompletedStampProps): ReactElement | null {
  if (!firstInstalledAt) return null;
  const s = SIZE[size];
  return (
    <span
      className={cn(
        'inline-flex flex-col items-center rounded-[6px] border-2',
        'border-[var(--pl-ok-text)] bg-[var(--pl-bg-card)] -rotate-[4deg]',
        // 안쪽 한 겹 — 흰 여백 1px 위에 옅은 초록 링. 획을 두껍게 하는 대신 겹을
        // 주면 같은 무게에서 "찍힌 것"으로 읽힌다.
        'shadow-[inset_0_0_0_1px_var(--pl-white),inset_0_0_0_3px_var(--pl-ok-border)]',
        s.box,
        className,
      )}
      // 도장은 날짜만 보인다 — 분까지가 필요한 사람에게는 전문을 남긴다. "부터"가
      // 아니라 "에": 이 값은 상태가 시작된 시점이 아니라 한 번 일어난 사건이다.
      title={`${STAMP_LABEL} — ${fmtDateTime(firstInstalledAt)}`}
    >
      <span className="text-[12px] font-bold tracking-[0.06em] text-[var(--pl-ok-text)]">
        {STAMP_LABEL}
      </span>
      <span
        className={cn(
          // 날짜는 절대 접히지 않는다 — 도장 안에서 두 줄이 되면 도장이 아니다.
          'whitespace-nowrap font-bold tabular-nums leading-[1.2] text-[var(--pl-ok-text)]',
          s.date,
        )}
      >
        {fmtDate(firstInstalledAt)}
      </span>
    </span>
  );
}

export interface CompletedStampSlotProps extends CompletedStampProps {
  /** 자리를 미리 잡을지 — 목록처럼 행마다 있고 없고가 갈리는 곳에서 true. */
  reserve?: boolean;
}

/**
 * 도장이 앉을 자리. 목록은 폭을 예약하고(`reserve`), 상세는 있는 만큼만 차지한다.
 */
export function CompletedStampSlot({
  firstInstalledAt,
  size = 'md',
  reserve = false,
  className,
}: CompletedStampSlotProps): ReactElement | null {
  if (!reserve && !firstInstalledAt) return null;
  return (
    <span className={cn('flex flex-none items-center justify-center', reserve && SLOT_W, className)}>
      <CompletedStamp firstInstalledAt={firstInstalledAt} size={size} />
    </span>
  );
}
