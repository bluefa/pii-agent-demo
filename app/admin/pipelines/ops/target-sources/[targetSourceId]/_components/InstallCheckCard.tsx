'use client';

/**
 * 설치 확인 카드 — 인프라 작업 탭의 두 번째 상태 카드.
 *
 * 바로 위 `Terraform 적용 상태` 카드와 **합치지 않는다**. 그것은 InfraManager 가 가진 우리
 * 쪽 작업 기록이고, 이것은 CSP 에 실제로 무엇이 서 있는지를 묻는 installation-status 다.
 * 출처가 다르고 조회 시각이 다르므로, 한 카드 안에 섞으면 어느 시각의 무슨 사실인지가
 * 사라진다. 같은 껍데기(`pipelineStyles.card.flush`)를 쓰되 카드는 둘이다.
 *
 * 카드가 답하는 질문은 하나다 — **지금 연결 테스트를 돌려도 되는가**. 그래서 판정은 낱말
 * 하나(완료 / 미완료 / 확인할 수 없음)로 서고, 그 아래 단계 행들이 그 낱말의 근거다.
 * 경고 색은 값이 진다. 카드도, 셀도 아니다 — 위 카드의 `연동 정보 · 미확정` 과 같은 규칙:
 * 미완료는 정상 작업의 한 국면이지 실패가 아니다.
 *
 * 행은 주체로 묶인다(서비스 측 / BDC 측). 그 묶음이 곧 「누가 움직여야 끝나는가」라, 운영자가
 * 서비스에 연락할지 BDC 를 기다릴지가 목록의 모양에서 읽힌다.
 *
 * ⛔ 계약에는 재확인을 **시키는** 오퍼레이션이 없다 — `다시 확인` 은 같은 GET 을 다시 부를
 * 뿐이고, 새 점검을 돌리지 않는다.
 *
 * 「리소스별 보기」는 이번에 넣지 않았다: 사용자 화면의 `InstallStatusDetail` 은 열 단계를
 * 고르는 prop 이 없고(선택은 내부 상태다), 단계 카탈로그가 각 CSP 컴포넌트 안에 사유로
 * 잠겨 있으며, 표의 Region·DB Type 열은 확정 연동 조회를 한 번 더 요구한다.
 */
import { type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { fmtDateTime } from '@/lib/pipeline/format';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TONE } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import {
  INSTALL_SIDE_LABEL,
  INSTALL_STATUS_META,
  installStatusLabel,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installCheckStyles';
// 같은 탭의 위 카드가 쓰는 그 태그다 — 두 카드의 행이 같은 x 에 서야 한 목록으로 읽힌다.
import { SIDE_TAG } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InfraStatusHead';
import type {
  InstallGateResult,
  InstallGateStep,
  InstallSide,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';

/** 판정 한 낱말 — 값만 색을 갖는다. */
const VERDICT: Record<InstallGateResult['kind'], { word: string; ink: string }> = {
  complete: { word: '완료', ink: 'text-[var(--pl-text-strong)]' },
  incomplete: { word: '미완료', ink: 'text-[var(--pl-warn-text)]' },
  unknown: { word: '확인할 수 없음', ink: 'text-[var(--pl-text-weak)]' },
};

const SIDE_ORDER: readonly InstallSide[] = ['service', 'bdc'];

/** 한 단계 — 이름 · 주체 · 최악 상태 · n/N. 위 카드의 TaskRow 와 같은 자와 같은 열이다. */
function StepRow({ step, first }: { step: InstallGateStep; first: boolean }): ReactElement {
  const meta = INSTALL_STATUS_META[step.worst];
  return (
    <div
      className={cn(
        'flex min-h-[30px] items-center gap-2',
        !first && 'border-t border-[var(--pl-border)]',
      )}
    >
      {/* 240px 고정 — 위 카드의 작업 이름 열과 같은 자리다. 다만 단계 이름은 레시피와
          대조하는 식별자가 아니라 읽는 이름이라 mono 가 아니다. */}
      <span
        className={cn(
          'w-[240px] min-w-0 flex-none truncate text-[12px] font-semibold',
          // 해당하는 리소스가 하나도 없는 단계는 목록에서 지워진 채로 남는다 — 자리는
          // 지키되(어떤 단계가 있는지는 사실이다) 진척으로 읽히지 않는다.
          step.na
            ? 'text-[var(--pl-text-weak)] line-through'
            : 'text-[var(--pl-text-strong)]',
        )}
      >
        {step.title}
      </span>
      <span className={SIDE_TAG}>{INSTALL_SIDE_LABEL[step.side]}</span>
      <span
        className={cn(
          pipelineStyles.pill.base,
          pipelineStyles.pill.md,
          TONE[meta.tone].pill,
          'flex-none',
        )}
      >
        <StatusGlyph name={meta.icon} />
        {installStatusLabel(step)}
      </span>
      {/* 해당 없음인 단계는 세지 않는다 — "0/12" 도 "12/12" 도 진척으로 읽히고,
          이 단계에는 셀 대상이 아예 없었다. */}
      {!step.na && (
        <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
          {step.done}/{step.total}
        </span>
      )}
    </div>
  );
}

function StatusGlyph({ name }: { name: IconName }): ReactElement {
  return <Icon name={name} size="sm" className={name === 'loader' ? 'animate-spin' : undefined} />;
}

export interface InstallCheckCardProps {
  gate: InstallGateResult;
  lastCheck: InstallLastCheck | null;
  loading: boolean;
  /** 조회 자체가 실패했다 — 카드는 한 줄로 줄어든다. */
  failed: boolean;
  onReload: () => void;
}

export function InstallCheckCard({
  gate,
  lastCheck,
  loading,
  failed,
  onReload,
}: InstallCheckCardProps): ReactElement {
  const verdict = VERDICT[gate.kind];

  if (loading) {
    // 위 카드와 같은 규칙으로 자리를 잡아 둔다 — 머리(제목+판정 줄) 약 96px 에
    // 그룹 머리글 둘과 최대 네 행(AWS 3 · Azure 4). 도착하면 위로만 줄어든다.
    return <div className="mt-4 h-[226px]" aria-busy />;
  }

  if (failed) {
    return (
      <div className="mt-4 flex items-center gap-3">
        <p className={cn(pipelineStyles.empty.base, 'py-3 text-left')}>
          설치 상태를 불러오지 못했습니다.
        </p>
        <button type="button" onClick={onReload} className={cn(opsStyles.detailLink, 'text-[12px]')}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <section aria-label="설치 확인" className={cn(pipelineStyles.card.flush, 'mt-4')}>
      <div className={detailStyles.sectionCard.head}>
        <div className={detailStyles.sectionCard.titleRow}>
          <h3 className="text-[16px] font-bold leading-[1.3] text-[var(--pl-text-strong)]">
            설치 확인
          </h3>
          <span className="flex flex-none items-baseline gap-3">
            {lastCheck?.checkedAt && (
              <span className={detailStyles.sectionCard.meta}>
                마지막 확인 {fmtDateTime(lastCheck.checkedAt)}
              </span>
            )}
            {/* 같은 GET 을 다시 부르는 것뿐이다 — 계약에 재점검을 시키는 오퍼레이션이 없다. */}
            <button
              type="button"
              onClick={onReload}
              className={cn(opsStyles.detailLink, 'text-[12px] font-normal')}
            >
              다시 확인
            </button>
          </span>
        </div>

        <dl className="mt-2 flex items-baseline gap-2 pb-4 text-[12px]">
          <dt className="flex-none font-medium text-[var(--pl-text-weak)]">설치 상태</dt>
          <dd className="flex min-w-0 items-baseline gap-2">
            <span className={cn('font-semibold', verdict.ink)}>{verdict.word}</span>
            {gate.kind === 'unknown' && lastCheck?.failReason && (
              <span className="truncate text-[var(--pl-text-weak)]">· {lastCheck.failReason}</span>
            )}
          </dd>
        </dl>
      </div>

      <div className="border-t border-[var(--pl-border)] px-6 py-2">
        {gate.steps.length === 0 ? (
          <p className="flex min-h-[30px] items-center text-[12px] text-[var(--pl-text-weak)]">
            설치 단계 정보가 없습니다.
          </p>
        ) : (
          SIDE_ORDER.map((side) => {
            const steps = gate.steps.filter((step) => step.side === side);
            if (steps.length === 0) return null;
            return (
              <div key={side} className="py-1 first:pt-0 last:pb-0">
                {/* 주체는 그룹이 말한다 — 행마다 같은 태그를 네 번 찍는 대신 머리글 한 줄.
                    태그는 행에도 남는다: 그룹이 접히거나 한 행만 읽힐 때도 주체는 사실이다. */}
                <p className="py-1 text-[12px] font-medium text-[var(--pl-text-weak)]">
                  {INSTALL_SIDE_LABEL[side]}
                </p>
                {steps.map((step, index) => (
                  <StepRow key={step.id} step={step} first={index === 0} />
                ))}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
