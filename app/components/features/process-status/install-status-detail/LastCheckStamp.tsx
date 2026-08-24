'use client';

import { cn, statusColors, textColors, textStyles } from '@/lib/theme';
import { useNowTick } from '@/app/hooks/useNowTick';
import { fmtRelativeTime } from '@/lib/pipeline/format';
import { formatDateTimeKst } from '@/lib/utils/date';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';

/**
 * Step-4 시각 표기 — "마지막 확인 12분 전", 정확한 시각은 hover.
 *
 * 이 줄은 프레임 위에 홀로 우측 정렬돼 있었다. 원래는 메타바의 오른쪽 절반이었고,
 * 왼쪽 절반("설치 진행 상황")이 카드 제목과 겹친다는 이유로 지워지면서 정렬의 기준을
 * 잃었다 — 위아래 어느 쪽 소속인지 말하지 못하는 한 줄. 카드에 대한 한 줄의 자리는
 * 카드 이름 옆이고, 5단계가 이미 그렇게 한다(TcHeaderTag: 판정 + 상대시각).
 *
 * 상대시각인 이유는 읽는 사람의 질문이 다르기 때문이다. 설치 중에 묻는 것은 "몇 시에
 * 읽은 값인가"가 아니라 "이 값이 아직 유효한가"이고, 그건 지금과의 관계다(DHIS2 design
 * system). 절대 시각을 지우지는 않는다 — 상대 표기만 남긴 제품들이 "며칠 전이 대체
 * 언제냐"는 요청을 받았고(GitLab #14560), 그래서 정확한 값은 hover 한 번 거리에 둔다.
 */

/**
 * 이 밖에서는 상대시각이 쓸모보다 모호함이 커진다 — "2일 전"은 24시간짜리 창이고,
 * 그쯤 된 스탬프는 신선도 신호가 아니라 기록으로 읽힌다. GitHub `<relative-time>` 의
 * threshold 와 같은 장치이고, 값이 30일이 아니라 하루인 것은 저쪽이 댓글에,
 * 이쪽이 진행 중인 폴에 찍히기 때문이다.
 */
const RELATIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface RelativeStamp {
  /** 화면에 쓰는 값 — 24시간 안이면 상대, 밖이면 절대. */
  text: string;
  /** 언제나 절대 시각. 상대를 쓸 때는 title 로, 아니면 text 와 같다. */
  absolute: string;
}

/**
 * ISO 시각 → 스스로 갱신되는 상대 표기. 시계는 React 밖의 값이라 구독으로 읽는다
 * (렌더에서 Date.now() 를 읽으면 렌더가 순수하지 않다 — useNowTick 참조).
 */
export const useRelativeStamp = (iso: string | null | undefined): RelativeStamp | null => {
  // 훅은 조건 없이 부른다. 켜고 끄는 판단은 훅 자신의 `active` 게이트가 한다.
  const now = useNowTick(Boolean(iso));
  if (!iso) return null;

  // wire 는 UTC 다. 라벨이 KST 를 주장하므로 포맷터가 Asia/Seoul 을 고정한다 —
  // 브라우저 타임존을 믿으면 라벨이 거짓이 될 수 있다.
  const absolute = `${formatDateTimeKst(iso)} (KST)`;
  // now === null: 서버 렌더와, 스토어를 구독하기 직전 한 프레임.
  // 음수 경과는 스탬프가 이 브라우저 시계보다 앞선 것이다 — "0분 전"으로 적으면
  // 뒷받침할 수 없는 신선도를 주장하게 되므로 절대 시각으로 물러선다.
  const elapsed = now === null ? null : now - Date.parse(iso);
  const fresh =
    elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0 && elapsed < RELATIVE_WINDOW_MS;

  return { text: fresh ? fmtRelativeTime(iso, now ?? undefined) : absolute, absolute };
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
    <span
      className={cn('whitespace-nowrap', textStyles.caption, textColors.tertiary)}
      title={stamp.text === stamp.absolute ? undefined : `마지막 확인 ${stamp.absolute}`}
    >
      마지막 확인 {stamp.text}
      {failed && (
        <span className={cn('font-semibold', statusColors.error.textDark)}> · 상태 확인 실패</span>
      )}
    </span>
  );
};
