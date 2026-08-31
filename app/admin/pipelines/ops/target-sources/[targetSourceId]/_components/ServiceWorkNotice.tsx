'use client';

/**
 * 서비스 측 작업 경고 — `현재 작업` 카드 안, `작업 시작` 바로 위 한 상자.
 *
 * 이 경고가 필요한 순간은 하나다: **설치 작업을 시작하려는 순간** (오너 2026-08-31). 그래서
 * 자리도 하나다 — 그 동작을 가진 카드 안, 그 동작 바로 위. 탭 어딘가에 상시로 서 있는 카드도,
 * 다른 탭의 안내줄도 아니다. 문장이 동작에서 멀어질수록 그 문장이 무엇을 막으려는지가 흐려진다.
 *
 * ⛔ 게이트가 아니라 주의다. `작업 시작` 을 비활성으로 만들지 않는다 — 서비스가 아직 안 끝낸
 * 리소스가 그 회차에서 실패할 뿐, 나머지를 세우려는 실행은 정당하다. 잠그는 것은 확정 정보가
 * 없을 때의 `startGate` 뿐이고, 둘이 함께 설 때도 그 문장은 제자리를 지킨다(위에 쌓인다).
 *
 * ⛔ `needed` 일 때만 그린다. `done` 은 아무 말도 하지 않아야 하고(끝난 일은 소식이 아니다),
 * `unknown` 과 로딩은 우리가 읽지 못한 것을 근거로 경고할 수 없다 — 못 읽었다는 문장을 실행
 * 버튼 위에 상시로 두면 그 자리가 진짜 경고에 쓰일 때 이미 소모돼 있다.
 *
 * 상자의 모양은 `CredentialMissingNotice` 의 그것이다(warn 워시 · 12px 라운드 · 글리프 + 14/600
 * 제목 · 글리프 열에 맞춘 본문). 두 상자가 같은 카드 계열에서 같은 무게의 말을 하므로 모양이
 * 갈릴 이유가 없다.
 */
import { type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { useModal } from '@/app/hooks/useModal';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { ServiceWorkModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ServiceWorkModal';
import type { ServiceWorkResult } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';

/**
 * 조회 결과 한 묶음 — `startGate` 가 그러듯 `PipelineTab` 이 만들어 카드까지 내려보낸다.
 * 카드는 이 값을 읽지 않는다: 자리만 주고, 그릴지 말지는 이 컴포넌트가 정한다.
 */
export interface ServiceWorkNoticeData {
  result: ServiceWorkResult;
  lastCheck: InstallLastCheck | null;
}

export interface ServiceWorkNoticeProps {
  /** null = 이 대상에는 서비스 측 단계가 없다(AWS 자동 설치·Azure·IDC·SDU). */
  data: ServiceWorkNoticeData | null;
  /** 부르는 쪽 스택과의 간격 — 상자는 제 바깥 여백을 갖지 않는다. */
  className?: string;
}

export function ServiceWorkNotice({ data, className }: ServiceWorkNoticeProps): ReactElement | null {
  const detailModal = useModal();

  if (data === null || data.result.kind !== 'needed') return null;
  const { result, lastCheck } = data;
  const open = result.total - result.done;

  return (
    <>
      <div
        className={cn(
          'rounded-[12px] border border-[var(--pl-warn-border)] bg-[var(--pl-warn-bg)] px-3.5 py-3 text-left',
          className,
        )}
      >
        {/* 경고를 색만으로 말하지 않는다(WCAG 1.4.1) — 마크가 색 없이도 같은 뜻을 진다. */}
        <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--pl-warn-text)]">
          <StatusWarningIcon className="h-4 w-4 shrink-0" />
          설치 작업 전에 서비스 측 대응이 먼저 필요합니다
        </div>
        {/* 제목의 글리프 열(16px + gap-2)에 본문을 맞춘다 — 상자 안에서 두 줄이 한 글 열에 선다. */}
        <p className="mt-1.5 break-keep pl-6 text-[14px] leading-[1.5] text-[var(--pl-warn-text)]">
          {`<${result.step.title}>`}이 끝나지 않은 리소스{' '}
          <b className="font-bold tabular-nums">{open}건</b>이 있습니다. 서비스 측에서 완료한 뒤
          설치 작업을 시작하세요.
        </p>
        <button
          type="button"
          onClick={() => detailModal.open()}
          className={cn(opsStyles.detailLink, 'mt-2 ml-6')}
        >
          상세 정보 보기
          <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
        </button>
      </div>

      {detailModal.isOpen && (
        <ServiceWorkModal result={result} lastCheck={lastCheck} onClose={detailModal.close} />
      )}
    </>
  );
}
