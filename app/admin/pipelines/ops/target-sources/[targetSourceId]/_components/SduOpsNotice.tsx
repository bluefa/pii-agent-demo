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
  serviceCode: string;
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
    // 카드 면 위에 놓는다. layout.content 계열은 배경을 갖지 않아, 면 없이 두면 셸의
    // 어두운 바닥이 그대로 비친다 — 이 화면의 다른 블록이 전부 카드인 것과 같은 이유다.
    <div
      className={cn(
        pipelineStyles.card.base,
        'flex min-h-[520px] items-center justify-center px-6 py-16',
      )}
    >
      <div className="flex max-w-[560px] flex-col items-center text-center">
        <ProviderLogo provider="AWS" isSdu variant="bare" className="flex-none" />

        <p className="mt-8 text-[16px] font-medium text-[var(--pl-text-weak)]">
          SDU · Self Data Upload
        </p>

        <h2 className="mt-3 text-[26px] font-bold tracking-[-0.02em] text-[var(--pl-text-strong)]">
          운영 화면을 준비하고 있습니다
        </h2>

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
            {serviceName === serviceCode ? serviceName : `${serviceName} · ${serviceCode}`}
          </span>
          {isChinaRegion && <span className={opsStyles.regionTag}>중국</span>}
        </div>

        {/* 이 화면에는 할 수 있는 일이 없다 — 그래서 나가는 길이 유일한 동작이고, 그것만
            파랑을 쓴다. 목록이 아니라 이 대상이 속한 서비스로 돌아간다: 왔던 자리가
            그 서비스의 Target Source 목록이고, 그 화면의 좌측 레일이 곧 서비스 목록이다.
            버튼 테두리를 두지 않는 이유는 이것이 이 화면의 유일한 컨트롤이라 경쟁할
            상대가 없기 때문이다. */}
        <Link
          href={passRoutes.pipelines.ops.service(serviceCode)}
          className="mt-8 text-[14px] font-semibold text-[var(--pl-primary)] underline-offset-[3px] hover:underline"
        >
          ← 서비스 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
