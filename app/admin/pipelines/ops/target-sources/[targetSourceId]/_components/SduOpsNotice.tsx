'use client';

import type { ReactElement } from 'react';

import { cn, pipelineStyles } from '@/lib/theme';

/**
 * SDU 대상의 **탭 자리**에 놓이는 안내.
 *
 * 전제가 바뀌었다: 예전에는 이것이 화면 전체였고, 그래서 대상 식별(번호·서비스·중국)과
 * 나가는 길까지 혼자 졌다. 이제 그 위에 진짜 마스트헤드(OpsHeader)가 선다 — 경로 두
 * 마디, `Target Source #{id}`, SDU 마크, 단계 알약, 「중국」 태그, 관련 페이지가 전부
 * 거기 있다. 같은 사실을 여기서 한 번 더 적으면 읽는 사람이 둘인 이유를 찾게 되므로,
 * 남는 것은 마스트헤드가 말하지 않는 것 하나뿐이다: 왜 탭이 없는가.
 *
 * 사용자쪽 SDU 화면(SduProjectPage)과는 일부러 다른 말을 한다. 서비스 담당자는 자기
 * 흐름(1·4·6·7단계)을 걷고 있지만, 운영자에게 이 대상은 이미 존재하고 운영되는
 * 대상이다 — 없는 것은 대상이 아니라 이 화면이다. 같은 문구를 돌려쓰면 운영자에게
 * 대상이 없다고 말하게 된다.
 *
 * 탭(스캔·연동 요청·설치 상태…)은 여전히 서지 않는다. 전부 설치 진행을 전제로 만든
 * 화면이라 SDU 에는 할 말이 없고, 눌리는 탭을 남겨 두면 빈 화면을 여는 것이 동작처럼
 * 보인다.
 */
export function SduOpsNotice(): ReactElement {
  return (
    // 카드 면 위에 놓는다 — 이 화면의 다른 블록이 전부 카드이기 때문이다. (레이아웃
    // 바닥은 --pl-bg-page 로 이미 밝다. 면이 없으면 어두워진다고 적었던 것은
    // 틀렸다: 그때 본 어두운 화면은 .next 가 깨져 CSS 가 안 붙은 상태였다.)
    //
    // 세로 여백은 min-h 가 갖는다. `py-*` 를 얹으면 card.base 의 pt-5/pb-6 과 겹치는데
    // cn 은 단순 join 이라(tailwind-merge 없음) 뒤에 오는 longhand 가 이겨 무효가 된다.
    <div
      className={cn(
        pipelineStyles.card.base,
        'flex min-h-[520px] items-center justify-center px-6',
      )}
    >
      <div className="flex max-w-[560px] flex-col items-center text-center">
        <p className="text-[16px] font-medium text-[var(--pl-text-weak)]">SDU · Self Data Upload</p>

        {/* h1 이 아니라 h2 다 — 이 화면의 h1 은 마스트헤드의 경로 줄(`opsStyles.path`)이고,
            안내는 그 아래 본문 한 덩어리다. 화면 전체였을 때는 여기가 유일한 머리였다. */}
        <h2 className="mt-3 text-[26px] font-bold tracking-[-0.02em] text-[var(--pl-text-strong)]">
          운영 화면을 준비하고 있습니다
        </h2>

        <p className="mt-4 text-[16px] leading-[1.6] text-[var(--pl-text-medium)]">
          SDU 는 서비스 담당자가 데이터를 직접 업로드하는 대상이라, 설치 진행을 전제로 만든
          스캔·연동 요청·설치 상태 탭이 적용되지 않습니다. 전용 운영 화면이 준비되는 대로
          이 자리에 표시됩니다.
        </p>
      </div>
    </div>
  );
}
