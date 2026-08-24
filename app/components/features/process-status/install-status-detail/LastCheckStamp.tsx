'use client';

import type { ReactNode } from 'react';
import { cn, statusColors, textColors, textStyles } from '@/lib/theme';
import { ClockIcon } from '@/app/components/ui/icons';
import { useNowTick } from '@/app/hooks/useNowTick';
import { fmtElapsedAgo } from '@/lib/pipeline/format';
import { formatDateTimeKstCompact } from '@/lib/utils/date';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';

/**
 * Step-4 시각 표기 — "3분 20초 전 확인", 그 뒤에 정확한 시각.
 *
 * 이 줄은 프레임 위에 홀로 우측 정렬돼 있었다. 원래는 메타바의 오른쪽 절반이었고,
 * 왼쪽 절반("설치 진행 상황")이 카드 제목과 겹친다는 이유로 지워지면서 정렬의 기준을
 * 잃었다 — 위아래 어느 쪽 소속인지 말하지 못하는 한 줄. 카드에 대한 한 줄의 자리는
 * 카드 이름 옆이고, 5단계가 이미 그렇게 한다(TcHeaderTag: 판정 + 상대시각).
 *
 * 두 값을 나눠 적고 무게를 다르게 준다(오너 지시). 설치 중에 묻는 것은 "몇 시에 읽은
 * 값인가"가 아니라 "이 값이 아직 유효한가"이므로 경과가 앞에 서고 굵기를 갖는다.
 * 절대 시각은 지우지 않고 뒤에 붙인다 — 상대 표기만 남긴 제품들이 "그래서 언제냐"는
 * 요청을 받았다(GitLab #14560).
 */

export interface RelativeStamp {
  /** 경과 — 큰 단위 두 개까지, 0인 단위는 빼고. 매 초 다시 계산된다. */
  elapsed: string | null;
  /** 정확한 시각 `YY. MM. DD. HH:mm` (KST 고정 — wire 는 UTC 라 브라우저 타임존을 믿지 않는다). */
  absolute: string;
}

/**
 * ISO 시각 → 스스로 흐르는 경과 표기. 시계는 React 밖의 값이라 구독으로 읽는다
 * (렌더에서 Date.now() 를 읽으면 렌더가 순수하지 않다 — useNowTick 참조).
 *
 * `elapsed` 가 null 인 경우는 둘이다: 아직 시계가 없거나(서버 렌더, 구독 직전 한 프레임),
 * 스탬프가 이 브라우저 시계보다 앞선 경우. 둘 다 절대 시각만으로 물러선다.
 */
export const useRelativeStamp = (iso: string | null | undefined): RelativeStamp | null => {
  // 훅은 조건 없이 부른다. 켜고 끄는 판단은 훅 자신의 `active` 게이트가 한다.
  const now = useNowTick(Boolean(iso));
  if (!iso) return null;
  return {
    elapsed: now === null ? null : fmtElapsedAgo(now - Date.parse(iso)),
    absolute: formatDateTimeKstCompact(iso),
  };
};

/**
 * 두 층 + 시계 — 5단계 시각 메타(`TcSummaryCard` 의 meta 줄)의 문법을 그대로 옮긴 것(오너 지시).
 * 빌려 온 것은 셋이다: 12px 시계 글리프가 시각 앞에 서고, 글자는 12px 한 계단 옅은 잉크,
 * 숫자는 tabular. 마지막 것이 이 화면에선 5단계보다 더 필요하다 — 이 수는 매 초 다시
 * 그려지므로, 비례폭 숫자면 초가 바뀔 때마다 줄 폭이 흔들린다.
 *
 * 시계는 위층(경과)에 맞춰 세운다. 두 줄의 가운데에 걸면 어느 값의 글리프인지 흐려지고,
 * 이 자리에서 답이 되는 값은 경과다. 12px 글리프를 16px 줄에 맞추는 2px 이 `mt-0.5`.
 */
const StampLines = ({
  stamp,
  verb,
  align,
  suffix,
  className,
}: {
  stamp: RelativeStamp;
  /** 경과 뒤에 붙는 동사 — 카드 헤더는 확인, 권한 패널은 검증. */
  verb: string;
  align: 'start' | 'end';
  suffix?: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex items-start gap-1.5 whitespace-nowrap [font-variant-numeric:tabular-nums]',
      textColors.tertiary,
      className,
    )}
  >
    <ClockIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
    <span className={cn('inline-flex flex-col', align === 'end' ? 'items-end' : 'items-start')}>
      {/* 위층 = 이 줄에서 답이 되는 값. 12/600, 한 단 진한 잉크. */}
      {stamp.elapsed && (
        <span className={cn(textStyles.captionStrong, textColors.secondary)}>
          {stamp.elapsed} {verb}
          {suffix}
        </span>
      )}
      {/* 아래층 = 근거. 같은 크기, 한 단 옅게. 경과가 없으면 이쪽이 유일한 값이 된다. */}
      <span className={textStyles.caption}>{stamp.absolute}</span>
    </span>
  </span>
);

export const LastCheckStamp = ({
  lastCheck,
  className,
}: {
  lastCheck: InstallLastCheck;
  /** 정렬 override — 기본은 헤더 우측(items-end). 왼쪽으로 흐르는 줄에서만 넘긴다. */
  className?: string;
}) => {
  const stamp = useRelativeStamp(lastCheck.checkedAt);
  const failed = lastCheck.status === 'FAILED';

  // 스탬프 없이 실패만 있는 경우에도 할 말은 있다 — 예전 줄도 둘 중 하나만 있으면 섰다.
  if (!stamp) {
    return failed ? (
      <span
        className={cn('whitespace-nowrap font-semibold', textStyles.caption, statusColors.error.textDark)}
      >
        상태 확인 실패
      </span>
    ) : null;
  }

  // 한 줄로 이으면 "25일 8시간 전 확인 2026. 07. 30. 오후 02:46 (KST)" 가 되어 제목
  // 옆 슬롯을 다 먹는다(오너). 두 층으로 쌓으면 각 줄이 짧아지고, 답(경과)과 근거
  // (정확한 시각)가 위아래로 갈려 크기·굵기 말고 위치로도 구분된다.
  return (
    <StampLines
      stamp={stamp}
      verb="확인"
      align="end"
      className={className}
      suffix={
        failed ? (
          <span className={cn('ml-1', statusColors.error.textDark)}>· 상태 확인 실패</span>
        ) : null
      }
    />
  );
};

/** 권한 패널의 마지막 검증 시각 — 같은 문법, 왼쪽으로 흐르는 줄이라 정렬만 뒤집는다. */
export const LastVerifyStamp = ({ stamp }: { stamp: RelativeStamp }) => (
  <StampLines stamp={stamp} verb="검증" align="start" />
);
