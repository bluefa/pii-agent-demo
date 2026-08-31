'use client';

/**
 * 실행 전 설치 확인 — 연결 테스트 카드의 첫 줄, Credential 알림과 같은 자리.
 *
 * 이 탭에 온 사람이 묻는 것은 「지금 돌려도 되는가」다. 설치가 아직 끝나지 않았으면 그
 * 리소스는 이번 회차에서 반드시 실패하고, 그 사실은 실행 결과가 아니라 실행의 **전제**라
 * 밴드 안이 아니라 밴드 위에 선다 (Credential 알림이 그 자리에 선 것과 같은 이유).
 *
 * ⛔ 실행을 막지는 않는다. Credential 미설정과 달리 설치 미완료는 「전부 실패한다」가
 * 아니라 「그 리소스가 실패한다」이고, 운영자가 나머지를 확인하려 돌리는 것은 정당한
 * 작업이다. 그래서 잠금은 여전히 Credential 하나뿐이고, 여기서는 누른 뒤 한 번 되묻는다
 * (TcTab 의 확인 창).
 *
 * 세 국면 모두 이 파일이 든다:
 *   완료           조용한 한 줄 — 확인했다는 사실과 언제 확인했는지.
 *   미완료         경고 상자 — 어느 단계가 남았는지와, 거기로 가는 길.
 *   확인할 수 없음  조용한 한 줄 — 경고하지 않는다. 못 읽은 것은 나쁜 소식이 아니다.
 */
import { type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { fmtDateTimeShort } from '@/lib/pipeline/format';
import {
  INSTALL_SIDE_GROUP_LABEL,
  installStatusLabel,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installCheckStyles';
import {
  openRequiredSteps,
  requiredProgress,
  type InstallGateResult,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';

/** 조용한 한 줄의 잉크·크기 — 카드 설명 바로 아래 붙는 메타 줄이다. */
const QUIET_LINE = 'mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px]';
const QUIET_TERM = 'font-medium text-[var(--pl-text-weak)]';
const QUIET_LINK =
  'cursor-pointer whitespace-nowrap font-medium text-[var(--pl-text-weak)] underline underline-offset-2 hover:text-[var(--pl-text-strong)]';

export interface InstallCheckNoticeProps {
  gate: InstallGateResult;
  lastCheck: InstallLastCheck | null;
  /** 첫 조회가 아직 안 끝났다 — 아는 척하지 않고 「확인 중」 이라 적는다. */
  loading: boolean;
  /** 인프라 작업 탭으로 — 설치의 전모는 그 탭의 카드가 든다. */
  onOpenInfraTab: () => void;
  onReload: () => void;
  className?: string;
}

export function InstallCheckNotice({
  gate,
  lastCheck,
  loading,
  onOpenInfraTab,
  onReload,
  className,
}: InstallCheckNoticeProps): ReactElement {
  if (loading) {
    return (
      <div className={cn(QUIET_LINE, className)}>
        <span className={QUIET_TERM}>설치 상태</span>
        <span className="text-[var(--pl-text-weak)]">· 확인 중</span>
      </div>
    );
  }

  if (gate.kind === 'unknown') {
    return (
      <div className={cn(QUIET_LINE, className)}>
        <span className={QUIET_TERM}>설치 상태</span>
        {/* 못 읽었다는 사실과, 상대가 말해 준 이유가 있으면 그것까지. 지어내지 않는다. */}
        <span className="text-[var(--pl-text-weak)]">
          · 확인할 수 없음 · {lastCheck?.failReason ?? '상태 확인 실패'}
        </span>
        <button type="button" onClick={onReload} className={QUIET_LINK}>
          다시 확인
        </button>
      </div>
    );
  }

  if (gate.kind === 'complete' || gate.kind === 'unconstrained') {
    const progress = requiredProgress(gate);
    return (
      <dl className={cn(QUIET_LINE, className)}>
        <dt className={QUIET_TERM}>설치 상태</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[var(--pl-text-weak)]">
          <span className="font-semibold text-[var(--pl-text-strong)]">
            {gate.kind === 'complete' ? '완료' : '제약 없음'}
          </span>
          {/* 셀 것이 없으면 세지 않는다 — `제약 없음` 옆의 0/0 은 진척이 아니라 잡음이다. */}
          {gate.kind === 'complete' && (
            <span className="tabular-nums">
              · {progress.done}/{progress.total}
            </span>
          )}
          {lastCheck?.checkedAt && <span>· {fmtDateTimeShort(lastCheck.checkedAt)} 확인</span>}
          <button type="button" onClick={onOpenInfraTab} className={QUIET_LINK}>
            인프라 작업 탭 ↗
          </button>
        </dd>
      </dl>
    );
  }

  const open = openRequiredSteps(gate);
  return (
    // Credential 미설정 알림과 같은 상자다 — 같은 자리에 서는 같은 무게의 사실(실행의
    // 전제)이라, 하나는 상자고 하나는 맨 줄이면 둘의 크기가 뜻이 되어 버린다.
    <div
      className={cn(
        'rounded-[12px] border border-[var(--pl-warn-border)] bg-[var(--pl-warn-bg)] px-3.5 py-3',
        className,
      )}
    >
      {/* 경고를 색만으로 말하지 않는다(WCAG 1.4.1). */}
      <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--pl-warn-text)]">
        <StatusWarningIcon className="h-4 w-4 shrink-0" />
        설치가 아직 끝나지 않았습니다
      </div>
      <p className="mt-1.5 break-keep pl-6 text-[14px] leading-[1.5] text-[var(--pl-warn-text)]">
        아래 단계가 완료되기 전에는 해당 리소스가 연결에 실패합니다. 실행은 막지 않습니다.
      </p>
      <ul className="mt-2 flex flex-col gap-1 pl-6 text-[14px] leading-[1.5] text-[var(--pl-warn-text)]">
        {open.map((step) => (
          <li key={step.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{step.title}</span>
            <span>· {INSTALL_SIDE_GROUP_LABEL[step.side]}</span>
            <span className="tabular-nums">
              · {step.done}/{step.total}
            </span>
            <span>· {installStatusLabel(step)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 ml-6 flex flex-wrap items-baseline gap-4">
        <button
          type="button"
          onClick={onOpenInfraTab}
          className="cursor-pointer whitespace-nowrap text-[14px] font-semibold text-[var(--pl-warn-text)] underline underline-offset-2"
        >
          인프라 작업 탭에서 확인
        </button>
        <button
          type="button"
          onClick={onReload}
          className="cursor-pointer whitespace-nowrap text-[14px] font-semibold text-[var(--pl-warn-text)] underline underline-offset-2"
        >
          다시 확인
        </button>
      </div>
    </div>
  );
}
