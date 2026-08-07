'use client';

import { bgColors, cn, primaryColors, scanTransition, statusColors, textColors } from '@/lib/theme';

/**
 * 스캔 히어로 블록의 세 프레임.
 * - `scanning`: 리소스를 찾는 중. 진행률이 오른다.
 * - `finalizing`: 탐색은 끝났고 집계만 남았다(SUCCESS인데 건수 맵이 없는 구간).
 *   바는 이미 가득 차 있으므로 "진행중" 문구를 그대로 두면 멈춘 화면으로 읽힌다.
 * - `complete`: 집계까지 끝난 뒤 결과를 넘겨주기 전의 확인 프레임.
 */
export type ScanHeroStage = 'scanning' | 'finalizing' | 'complete';

interface ScanRunningStateProps {
  progress: number;
  stage: ScanHeroStage;
}

const COPY: Record<ScanHeroStage, { title: string; description: React.ReactNode }> = {
  scanning: {
    title: '인프라 스캔 진행중입니다',
    description: (
      <>인프라 스캔은 약 <strong>5분</strong> 이내 소요되는 편이며, 리소스가 많을 경우 길어질 수 있어요.</>
    ),
  },
  finalizing: {
    title: '스캔 마무리 중이에요',
    description: '리소스 탐색은 끝났고 결과를 집계하고 있어요. 잠시만 기다려 주세요.',
  },
  complete: {
    title: '스캔 완료',
    /*
     * 건수를 말하지 않는다. 이 프레임이 댈 수 있는 숫자는 스캔 잡의 발견 총계
     * (리소스 타입 전체 합)인데, 바로 다음 화면의 깔때기는 연동 가능 DB 수를
     * 말한다 — 단위가 다른 두 숫자가 연달아 서면 비교를 부르고 그 비교에는 답이
     * 없다(ScanStrip 의 같은 규칙). 올바른 단위의 숫자는 목록이 도착해야 알 수
     * 있으므로, 확인 프레임은 "끝났다"까지만 말하고 수치는 깔때기에 넘긴다.
     */
    description: '결과를 정리하고 있어요. 잠시 후 연동할 대상이 표시돼요.',
  },
};

/**
 * 스캔이 도는 동안과 끝난 직후를 같은 블록이 그린다. 완료 프레임을 별도
 * 컴포넌트로 두지 않는 이유가 그것 — 패딩·아이콘 타일·제목·부제·바가 정확히
 * 같은 자리에 있어야 완료 순간에 화면이 튀지 않는다. 프레임이 갈리는 게 아니라
 * 안의 내용만 바뀐다.
 */
export const ScanRunningState = ({ progress, stage }: ScanRunningStateProps) => {
  const done = stage === 'complete';
  // 완료 프레임의 바는 항상 가득 — 이 시점의 scan_progress 는 정보가 아니다.
  const clamped = done ? 100 : Math.min(100, Math.max(0, progress));
  const { title, description } = COPY[stage];

  return (
    <div className="py-[60px] px-5 text-center">
      <div
        className={cn(
          'w-16 h-16 mx-auto mb-5 rounded-2xl grid place-items-center',
          // 세 프레임이 색으로 이어진다: 진행·마무리는 브랜드 파랑, 완료는 초록.
          // 회색 타일은 이 순간 화면에서 유일하게 움직이는 요소를 가장 무채색으로
          // 만들었다 — 아래 진행바가 이미 브랜드 그라디언트로 같은 일을 말하고 있다.
          done
            ? cn(statusColors.success.bg, statusColors.success.text)
            : cn(primaryColors.bgLight, primaryColors.textOnLight),
        )}
      >
        {done ? (
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* dasharray 만 선언하고 offset 은 기본값(0) — motion-reduce 에서
                애니메이션이 꺼져도 체크는 그려진 상태로 남는다. */}
            <path d="M4.5 12.5l5 5 10-11" strokeDasharray={30} className={scanTransition.checkDraw} />
          </svg>
        ) : (
          <div className="animate-spin motion-reduce:animate-none">
            <svg
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              {/* 트랙 + 아크 — 아래 진행바와 같은 문법이다. 거의 한 바퀴짜리
                  아크는 제 꼬리와 구분되지 않아 도는 게 잘 안 읽혔다. 트랙은
                  같은 색의 투명도라 토큰을 하나 더 만들지 않는다. */}
              <circle cx="12" cy="12" r="9" className="opacity-20" />
              <path d="M12 3a9 9 0 0 1 9 9" />
            </svg>
          </div>
        )}
      </div>
      {/* 완료는 모션이 아니라 문구로도 전달돼야 한다 — 세 프레임을 통틀어 제목만
          바뀌므로 여기에만 라이브 리전을 건다(진행률은 읽어주지 않는다). */}
      <h3 className={cn('text-base font-semibold mb-1.5', textColors.primary)} aria-live="polite">
        {title}
      </h3>
      <p className={cn('text-[13px]', textColors.tertiary)}>
        {description}
      </p>
      <div className={cn('mx-auto mt-6 max-w-[520px] rounded-full h-[10px] overflow-hidden', bgColors.panel)}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-[400ms] ease-out', primaryColors.barGradient)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className={cn('mt-2 text-xs font-mono tabular-nums', textColors.secondary)}>
        {clamped}%
      </div>
    </div>
  );
};

export default ScanRunningState;
