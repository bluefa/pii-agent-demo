'use client';

import { cn, statusColors, textColors, textStyles } from '@/lib/theme';
import { useNowTick } from '@/app/hooks/useNowTick';
import { fmtElapsedAgo } from '@/lib/pipeline/format';
import { formatDateTimeKst } from '@/lib/utils/date';
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
  /** 정확한 시각(KST 고정 — wire 는 UTC 라 브라우저 타임존을 믿지 않는다). */
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
    absolute: `${formatDateTimeKst(iso)} (KST)`,
  };
};

export const LastCheckStamp = ({ lastCheck }: { lastCheck: InstallLastCheck }) => {
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

  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      {/* 이 줄에서 답이 되는 값 — 12/600, 한 단 진한 잉크. */}
      {stamp.elapsed && (
        <span className={cn(textStyles.captionStrong, textColors.secondary)}>
          {stamp.elapsed} 확인
        </span>
      )}
      {/* 근거 — 같은 크기, 한 단 옅게. 경과가 없으면 이쪽이 유일한 값이 된다. */}
      <span className={cn(textStyles.caption, textColors.tertiary)}>{stamp.absolute}</span>
      {failed && (
        <span className={cn('font-semibold', textStyles.caption, statusColors.error.textDark)}>
          · 상태 확인 실패
        </span>
      )}
    </span>
  );
};
