'use client';

/**
 * 연동 완료 도장 (design-benchmark `integration-completed-stamp.md`, 시안 G).
 *
 * 이 앱에는 "끝났다"를 말하는 형태가 없었다 — 7단계가 전부 같은 알약이고 색만 달랐다.
 * 도장은 그 자리를 메우되 두 가지를 지킨다:
 *
 *   1. **날짜를 품는다.** 영수증 도장의 규칙이다 — 날짜가 찍히는 순간 도장은 선언이
 *      아니라 기록이 된다. 완료 선언과 완료 시각이 두 요소로 흩어지지 않는다.
 *   2. **`COMPLETED` 일 때만 찍힌다.** 모든 대상에 찍히는 도장은 벽지다. 여기서
 *      판정하지 않고 호출자가 `getIntegrationCompletion` 의 결과를 그대로 넘긴다.
 *
 * 면은 흰색, 획만 초록이다. 카드 hover 가 보라(`tableRowLift.card`)라 색 면을 쓰면
 * 그 한 상태에서 도장이 배경과 부딪힌다 — 흰 면 + 색 획은 두 표면을 다 견딘다.
 * 회전 −4°는 `transform` 이라 레이아웃 박스를 건드리지 않는다: 120px 카드(LIN-92)의
 * 높이 예산을 한 픽셀도 쓰지 않는다.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { fmtDate, fmtDateTime } from '@/lib/pipeline/format';
import {
  getIntegrationCompletion,
  NOT_COMPLETED,
  type IntegrationCompletion,
} from '@/app/lib/api/ops';

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

/**
 * 목록에서 도장이 앉을 자리의 폭. 도장이 늦게 도착해도 옆 칸이 움직이지 않도록
 * 미리 잡아 둔다.
 *
 * 브라우저 실측(Pretendard, 20px/700 tabular): 'YYYY-MM-DD' 121.8px + 좌우 여백
 * 24px + 테두리 4px = 151.6px, 여기에 −4° 회전이 가로로 4.3px 을 더해 155.9px.
 * 어림한 값으로 잡았다가 4px 이 모자라 날짜가 두 줄로 접혔다 — 그래서 실측이다.
 * 남은 4px 은 여유고, 도장 양옆의 간격은 카드의 `gap-3.5` 가 따로 준다.
 */
const SLOT_W = 'w-[160px]';

export interface CompletedStampProps {
  /** `status_changed_at` — 단계가 `COMPLETED` 로 바뀐 시각. 없으면 문구만 찍는다. */
  completedAt: string | null;
  size?: StampSize;
  className?: string;
}

export function CompletedStamp({
  completedAt,
  size = 'md',
  className,
}: CompletedStampProps): ReactElement {
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
      // 도장은 날짜만 보인다 — 분까지가 필요한 사람에게는 전문을 남긴다.
      title={completedAt ? `연동 완료 ${fmtDateTime(completedAt)}` : '연동 완료'}
    >
      <span className="text-[12px] font-bold tracking-[0.06em] text-[var(--pl-ok-text)]">
        연동 완료
      </span>
      {/* 시각을 모르면 그 줄은 아예 없다 — '-' 를 20px 로 키우면 모르는 것이 화면에서
          가장 큰 글자가 된다. 도장 자체는 계약이 COMPLETED 라고 말한 사실이라 남는다. */}
      {completedAt && (
        <span
          className={cn(
            // 날짜는 절대 접히지 않는다 — 도장 안에서 두 줄이 되면 도장이 아니다.
            'whitespace-nowrap font-bold tabular-nums leading-[1.2] text-[var(--pl-ok-text)]',
            s.date,
          )}
        >
          {fmtDate(completedAt)}
        </span>
      )}
    </span>
  );
}

export interface CompletedStampSlotProps {
  targetSourceId: number;
  size?: StampSize;
  /** 자리를 미리 잡을지 — 목록처럼 도장이 늦게 와도 옆 칸이 밀리면 안 되는 곳에서 true. */
  reserve?: boolean;
  className?: string;
}

/**
 * 자기 사실을 스스로 물어 오는 도장.
 *
 * 목록에서 한 화면에 뜨는 카드는 3장(`PAGE_SIZE`)이라 조회도 3건이고, 페이지를 넘기면
 * 언마운트되면서 취소된다. 목록 라우트로 이 값을 끌어오지 않은 이유는 계약이다 —
 * `/process-statuses` 에는 serviceCode 필터가 없어서, 서비스 하나를 그리자고 전체 표를
 * 페이징해야 한다(그래서 오너가 예전에 그 집계를 뺐다).
 *
 * ⚠️ 도장이 없는 것은 "연동이 안 끝났다"가 아니다. 조회 전·조회 실패도 같은 그림이다.
 * 도장은 **긍정 표식**으로만 쓴다 — 미완료를 말해야 하는 자리는 단계 알약이다.
 */
export function CompletedStampSlot({
  targetSourceId,
  size = 'md',
  reserve = false,
  className,
}: CompletedStampSlotProps): ReactElement | null {
  // 답에 대상 번호를 같이 들고 있는다 — 대상이 바뀌면 새 답이 오기 전까지 옛 답이
  // 걸려 있게 되고, 그러면 완료가 아닌 대상에 남의 도장이 잠깐 찍힌다.
  const [state, setState] = useState<{ id: number; value: IntegrationCompletion } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getIntegrationCompletion(targetSourceId, { signal: ac.signal })
      .then((value) => setState({ id: targetSourceId, value }))
      // 실패도 "도장 없음"으로 그린다 — 이 표식은 완료를 말할 뿐 미완료를 주장하지 않는다.
      .catch(() => setState({ id: targetSourceId, value: NOT_COMPLETED }));
    return () => ac.abort();
  }, [targetSourceId]);

  const done = state?.id === targetSourceId ? state.value : null;

  if (!reserve && !done?.completed) return null;
  return (
    <span
      className={cn(
        'flex flex-none items-center justify-center',
        reserve && SLOT_W,
        className,
      )}
    >
      {done?.completed && <CompletedStamp completedAt={done.completedAt} size={size} />}
    </span>
  );
}
