'use client';

import type { ReactNode } from 'react';
import { cn, statusColors, textColors, textStyles } from '@/lib/theme';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { ClockIcon } from '@/app/components/ui/icons';
import { useNowTick } from '@/app/hooks/useNowTick';
import { fmtElapsedAgo } from '@/lib/pipeline/format';
import { formatDateTimeKstCompact } from '@/lib/utils/date';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';

/**
 * Step-4 시각 표기 — 정확한 시각, 그 뒤에 "3분 20초 전 확인".
 *
 * 이 줄은 프레임 위에 홀로 우측 정렬돼 있었다. 원래는 메타바의 오른쪽 절반이었고,
 * 왼쪽 절반("설치 진행 상황")이 카드 제목과 겹친다는 이유로 지워지면서 정렬의 기준을
 * 잃었다 — 위아래 어느 쪽 소속인지 말하지 못하는 한 줄. 카드에 대한 한 줄의 자리는
 * 카드 이름 옆이고, 5단계가 이미 그렇게 한다(TcHeaderTag: 판정 + 상대시각).
 *
 * 두 값을 나눠 적고 무게를 다르게 준다(오너 지시). 절대 시각이 앞에 서고 굵기를 갖는다 —
 * 시계 글리프가 붙는 값이 그것이다. 경과는 지우지 않고 뒤에 붙인다: 상대 표기만 남긴
 * 제품들이 "그래서 언제냐"는 요청을 받았고(GitLab #14560), 절대 시각만 남기면 이 값이
 * 아직 유효한지를 독자가 직접 빼야 한다.
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
 * 한 줄 — 시계 글리프, 절대 시각, 가운뎃점, 경과.
 *
 * 시계는 절대 시각의 글리프라 그 값 바로 왼쪽에 선다. 경과는 같은 줄의 주석이므로
 * 가운뎃점 뒤에 한 단 옅게 따라온다. `tabular-nums` 는 남긴다 — 경과가 매 초 다시
 * 그려지므로, 비례폭 숫자면 초가 바뀔 때마다 줄 폭이 흔들린다.
 */
const Stamp = ({
  stamp,
  verb,
  suffix,
  className,
}: {
  stamp: RelativeStamp;
  /** 경과 뒤에 붙는 동사 — 카드 헤더는 확인, 권한 패널은 검증. */
  verb: string;
  suffix?: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap [font-variant-numeric:tabular-nums]',
      textColors.tertiary,
      className,
    )}
  >
    <ClockIcon className="h-3 w-3 flex-shrink-0" />
    {/* 글리프와 값 사이만 gap 이 벌린다. 그 뒤는 한 줄의 글이라, 가운뎃점 좌우 간격은
        이 저장소의 인라인 구분자와 같은 ' · ' 공백으로 준다. */}
    <span className={textStyles.caption}>
      <span className={cn(textStyles.captionStrong, textColors.secondary)}>{stamp.absolute}</span>
      {stamp.elapsed && ` · ${stamp.elapsed} ${verb}`}
      {suffix}
    </span>
  </span>
);

export const LastCheckStamp = ({
  lastCheck,
  className,
}: {
  lastCheck: InstallLastCheck;
  /** 줄 자체에 얹는 추가 클래스 — 기본 배치는 카드 헤더의 우측 슬롯이 정한다. */
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

  // 줄이 말할 수 있는 것은 "언제 읽은 값인가"까지다. 그 값이 지금과 다를 수 있다는
  // 사실은 줄을 늘리는 대신 툴팁으로 내린다. 이 줄은 카드 머리의 우상단이라 위로 열면
  // 카드를 벗어나므로 아래로 연다.
  return (
    <Tooltip
      position="bottom"
      content="설치 상태를 마지막으로 확인한 시각이에요. 화면에 보이는 값은 이때 확인한 결과라, 지금 상태와는 다를 수 있어요."
    >
      <Stamp
        stamp={stamp}
        verb="확인"
        className={className}
        suffix={
          failed ? (
            <span className={cn('ml-1', statusColors.error.textDark)}>· 상태 확인 실패</span>
          ) : null
        }
      />
    </Tooltip>
  );
};

/** 권한 패널의 마지막 검증 시각 — 같은 한 줄 문법, 동사만 다르다. */
export const LastVerifyStamp = ({ stamp }: { stamp: RelativeStamp }) => (
  <Stamp stamp={stamp} verb="검증" />
);
