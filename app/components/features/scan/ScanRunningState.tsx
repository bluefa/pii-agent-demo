'use client';

import { bgColors, cn, primaryColors, scanTransition, statusColors, textColors } from '@/lib/theme';

/**
 * 스캔 히어로 블록의 세 프레임.
 * - `scanning`: 리소스를 찾는 중. 진행률이 오른다.
 * - `finalizing`: 탐색은 끝났고 결과 저장·집계만 남았다(계약의 SAVING, 그리고
 *   SUCCESS인데 건수 맵이 아직 없는 구간).
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
    // 형제 프레임들이 해요체다(ScanErrorState "인프라 스캔에 실패하였어요",
    // 빈 상태 "발견된 리소스가 없어요") — 명사형 "스캔 완료"만 튀었다.
    title: '인프라 스캔이 끝났어요',
    /*
     * 건수를 말하지 않는다. 이 프레임이 댈 수 있는 숫자는 스캔 잡의 발견 총계
     * (리소스 타입 전체 합)인데, 바로 다음 화면의 깔때기는 연동 가능 DB 수를
     * 말한다 — 단위가 다른 두 숫자가 연달아 서면 비교를 부르고 그 비교에는 답이
     * 없다(ScanStrip 의 같은 규칙). 올바른 단위의 숫자는 목록이 도착해야 알 수
     * 있으므로, 확인 프레임은 "끝났다"까지만 말하고 수치는 깔때기에 넘긴다.
     */
    /*
     * "정리하고 있어요"는 제목이 닫은 프로세스를 본문이 다시 여는 말이었고, 직전
     * 프레임이 이미 "집계하고 있어요"라고 말한 뒤였다. "연동할 대상이 표시돼요"도
     * 0건으로 끝나는 스캔에는 지키지 못할 약속이라 결과로 바꾼다.
     */
    description: '잠시 후 결과를 보여드릴게요.',
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
      {/* 라이브 리전은 여기가 아니라 카드 본문에 상주한다(CandidateResourceSection).
          이 제목은 페이즈가 바뀌면 노드째 사라지므로, 정작 마지막 사건인 "목록 도착"을
          알릴 수가 없다 — 리전은 알릴 내용보다 오래 살아 있어야 한다. */}
      <h3 className={cn('text-base font-semibold mb-1.5', textColors.primary)}>
        {title}
      </h3>
      <p className={cn('text-[13px]', textColors.tertiary)}>
        {description}
      </p>
      <div
        className={cn('mx-auto mt-6 max-w-[520px] rounded-full h-[10px] overflow-hidden', bgColors.panel)}
        role="progressbar"
        aria-label="인프라 스캔 진행률"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* 250ms — settling(400ms)보다 짧아야 한다. 둘이 같으면 바가 100%에 닿는
            프레임이 곧 확인 프레임으로 넘어가는 프레임이라, 정착한 100%를 아무도
            보지 못한다(이 구간이 존재하는 이유가 그것이다). */}
        <div
          className={cn('h-full rounded-full transition-[width] duration-[250ms] ease-out', primaryColors.barGradient)}
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
