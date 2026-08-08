'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

import { passRoutes } from '@/lib/routes';
import { cn, pipelineStyles } from '@/lib/theme';
import { ProviderLogo } from '@/app/components/features/admin/v7';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/**
 * SDU 대상의 운영 상세 자리에 놓이는 화면.
 *
 * 사용자쪽 SduUnsupportedNotice 와 일부러 다른 말을 한다. 서비스 담당자에게 SDU 는
 * "아직 지원하지 않는 타입"이지만, 운영자에게 이 대상은 이미 존재하고 운영되는
 * 대상이다 — 없는 것은 대상이 아니라 이 화면이다. 같은 문구를 돌려쓰면 운영자에게
 * 대상이 없다고 말하게 된다.
 *
 * 탭(스캔·연동 요청·설치 상태…)은 함께 걷는다. 전부 설치 진행을 전제로 만든 화면이라
 * SDU 에는 할 말이 없고, 눌리는 탭을 남겨 두면 빈 화면을 여는 것이 동작처럼 보인다.
 * 대신 대상 식별(번호·서비스)은 남긴다 — 운영자가 링크를 타고 왔을 때 "어느 대상의
 * 화면인지"는 알아야 뒤로 갈지 판단할 수 있다.
 */
export interface SduOpsNoticeProps {
  targetSourceId: number;
  serviceName: string;
  /**
   * 계약에서 optional 이라 없을 수 있다. 없으면 이 화면의 유일한 컨트롤이
   * `/services/-` 라는 없는 서비스를 가리키게 되므로, 그때는 서비스 목록으로 보낸다.
   */
  serviceCode: string | null;
  /** metadata.is_china_region — 중국 대상이면 화면이 없어도 그 사실은 말한다. */
  isChinaRegion: boolean;
}

export function SduOpsNotice({
  targetSourceId,
  serviceName,
  serviceCode,
  isChinaRegion,
}: SduOpsNoticeProps): ReactElement {
  return (
    // 카드 면 위에 놓는다 — 이 화면의 다른 블록이 전부 카드이기 때문이다. (레이아웃
    // 바닥은 --pl-bg-page = #F9FAFB 로 이미 밝다. 면이 없으면 어두워진다고 적었던 것은
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
        {/* `provider` 값은 여기서 쓰이지 않는다 — `isSdu` 가 참이면 색·글리프·aria 라벨이
            모두 SDU 로 결정된다(ProviderLogo 의 providerColors/ProviderGlyph/aria-label).
            'AWS' 인 것은 prop 타입 CloudProvider 가 'SDU' 를 포함하지 않기 때문이지,
            이 대상이 AWS 라는 뜻이 아니다. */}
        <ProviderLogo provider="AWS" isSdu variant="bare" className="flex-none" />

        <p className="mt-8 text-[16px] font-medium text-[var(--pl-text-weak)]">
          SDU · Self Data Upload
        </p>

        <h1 className="mt-3 text-[26px] font-bold tracking-[-0.02em] text-[var(--pl-text-strong)]">
          운영 화면을 준비하고 있습니다
        </h1>

        <p className="mt-4 text-[16px] leading-[1.6] text-[var(--pl-text-medium)]">
          SDU 는 서비스 담당자가 데이터를 직접 업로드하는 대상이라, 설치 진행을 전제로 만든
          스캔·연동 요청·설치 상태 탭이 적용되지 않습니다. 전용 운영 화면이 준비되는 대로
          이 자리에 표시됩니다.
        </p>

        {/* 화면이 없다는 말만 남기면 운영자가 "내가 어느 대상을 열었는지"를 잃는다.
            이름과 코드가 같은 서비스(SDU 등)가 있어, 같으면 하나만 — 같은 글자를 두 번
            찍으면 칩이 둘인 이유를 읽는 사람이 찾게 된다. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className={opsStyles.tag}>Target #{targetSourceId}</span>
          <span className={opsStyles.tag}>
            {!serviceCode || serviceName === serviceCode
              ? serviceName
              : `${serviceName} · ${serviceCode}`}
          </span>
          {isChinaRegion && <span className={opsStyles.regionTag}>중국</span>}
        </div>

        {/* 이 화면에는 할 수 있는 일이 없다 — 그래서 나가는 길이 유일한 동작이고, 그것만
            파랑을 쓴다. 목록이 아니라 이 대상이 속한 서비스로 돌아간다: 왔던 자리가
            그 서비스의 Target Source 목록이고, 그 화면의 좌측 레일이 곧 서비스 목록이다.
            버튼 테두리를 두지 않는 이유는 이것이 이 화면의 유일한 컨트롤이라 경쟁할
            상대가 없기 때문이다. */}
        <Link
          href={
            serviceCode
              ? passRoutes.pipelines.ops.service(serviceCode)
              : passRoutes.pipelines.ops.services
          }
          className={cn('mt-8 text-[14px] underline-offset-[3px]', pipelineStyles.text.link)}
        >
          ← 서비스 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
