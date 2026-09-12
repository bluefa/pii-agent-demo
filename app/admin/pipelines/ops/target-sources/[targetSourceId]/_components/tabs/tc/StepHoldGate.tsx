'use client';

/**
 * 5단계 종료 조건 한 행 — 연결 테스트 카드 안, 알림 상자들 아래·실행 밴드 바로 위.
 *
 * 이 탭은 「현재 단계」 로젠지가 붙는 탭인데 밴드는 최신 실행이 어땠는지만 말했다. 5단계를
 * 끝내는 사건은 서비스 담당자의 승인 요청 하나이고, 그것이 왜 아직 없는지(실행 없음 · 실패 ·
 * 재실행 요청 · 성공했는데 안 누름)가 화면에 없어서 "성공했는데 왜 5단계인가"에 답이 없었다
 * (docs/ux/benchmark/step5-hold-reason.md, 시안 E → 오너 09-12 한 행으로). 이 행이 그 답이다.
 *
 * 문법은 관리자 승인 탭의 승인 조건 카드(`GateCard`)에서 빌렸다 — 판정 마크 셋(✓ 충족 ·
 * ✗ 미충족 · ⚠ 미확인) · 요건문 · 라벨–값 근거 행. 그쪽 껍데기(한 행 세 열 카드)는 안
 * 빌린다: 여기는 실행 밴드 위에 얹히는 한 프레임이다. 모름은 ✗ 를 쓰지 못한다(확인하지
 * 못한 것을 미충족이라 단정하게 된다).
 *
 * 관리자도 누른다 (오너 2026-09-12). 서비스가 막혔을 때의 우회로라 행의 오른쪽에 「승인 요청」
 * 이 선다 — 누를 수 있는 전제는 서비스 화면과 같다(성공한 실행). 전제가 안 서면 `blocked` +
 * 툴팁으로 사유를 든다(⛔ 이유 없이 잠긴 버튼 금지). 요청이 이미 됐으면 버튼이 없다.
 *
 * ⛔ 실행 게이트가 아니다. 실행 버튼을 잠그지 않는다(#856 「게이트가 아니라 주의」와 같은 규칙).
 *
 * 5단계에서만 선다. 판정은 `stepHoldView` 가 접고, 이 파일은 그리기만 한다.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import type { StepHoldView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/stepHold';

/** 요건문 — 오너의 낱말 그대로 (2026-09-12). */
const REQUIREMENT = '승인 요청을 눌러야 5단계 이상으로 진입합니다';
const BLOCKED_HINT = '최신 연결 테스트가 성공해야 승인 요청을 보낼 수 있습니다';

/** 판정 마크 — 승인 탭 GateCard 의 셋 + 조회 중. 20px 은 그쪽 값. */
function Mark({ state }: { state: StepHoldView['state'] }): ReactElement {
  switch (state) {
    case 'ok':
      return <Icon name="check-circle" size={20} className="text-[var(--pl-ok-text)]" title="충족" />;
    case 'unmet':
      return <Icon name="x-circle" size={20} className="text-[var(--pl-err-text)]" title="미충족" />;
    case 'unknown':
      return <Icon name="warn-tri" size={20} className="text-[var(--pl-warn-text)]" title="미확인" />;
    default:
      return (
        <Icon
          name="loader"
          size={20}
          className="animate-spin text-[var(--pl-text-weak)] motion-reduce:animate-none"
        />
      );
  }
}

export interface StepHoldGateProps {
  /** null = 이 대상은 5단계가 아니다(또는 SDU) — 아무것도 그리지 않는다. */
  view: StepHoldView | null;
  /** 관리자의 「승인 요청」 — 확인 모달을 여는 것까지가 호출자의 몫. */
  onRequestApproval: () => void;
  requesting: boolean;
  className?: string;
}

export function StepHoldGate({
  view,
  onRequestApproval,
  requesting,
  className,
}: StepHoldGateProps): ReactElement | null {
  if (!view) return null;
  const loading = view.state === 'loading' && view.facts.length === 0;

  // 슬롯 — 요청됐으면 할 일이 없어 비고, 조회 중엔 아직 모른다. 그 밖엔 늘 선다: 열려
  // 있거나(성공 + 미요청) 사유를 든 채 잠겨 있거나.
  const action = ((): ReactElement | null => {
    if (loading || view.state === 'ok') return null;
    if (view.canRequest) {
      return (
        <PlButton variant="primary" size="sm" onClick={onRequestApproval} disabled={requesting}>
          {requesting ? '요청 중…' : '승인 요청'}
        </PlButton>
      );
    }
    return (
      <Tooltip content={BLOCKED_HINT} variant="value" triggerClassName="shrink-0">
        <PlButton variant="primary" size="sm" blocked>
          승인 요청
        </PlButton>
      </Tooltip>
    );
  })();

  return (
    <section
      className={cn(
        // 밴드와 같은 10px 라운드·헤어라인, 면은 흰색 — 바로 아래 밴드가 국면의 면을 입으므로
        // 이 프레임까지 칠하면 카드 안에 색 판이 둘이 된다.
        'rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)]',
        className,
      )}
      aria-label="5단계 종료 조건"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--pl-border)] px-4 py-2">
        <p className="text-[12px] font-semibold text-[var(--pl-text-weak)]">5단계 종료 조건</p>
        {/* 차례 한 마디 — 관리자에게 이 단계는 남의 차례라는 사실이 곧 "내가 할 일이 없다"다. */}
        {view.turn && <p className="text-[12px] font-medium text-[var(--pl-gray-600)]">{view.turn}</p>}
      </div>
      <div className="grid grid-cols-[20px_1fr_auto] items-start gap-x-2.5 gap-y-2 px-4 py-3">
        <span
          className="mt-px flex-none"
          {...(loading ? { role: 'status', 'aria-label': '확인 중' } : {})}
        >
          <Mark state={view.state} />
        </span>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold leading-[1.4] break-keep text-[var(--pl-text-strong)]">
          {REQUIREMENT}
          {view.tag && <TcPill tone={view.tag.tone} label={view.tag.label} />}
        </p>
        <span className="flex-none">{action}</span>
        {loading ? (
          // 근거가 앉을 자리를 미리 잡아 둔다 — 도착하면서 프레임이 자라면 아래 밴드가 밀린다.
          <div aria-hidden className={cn(pipelineStyles.skeletonBar, 'col-start-2 h-[21px] w-2/3 rounded')} />
        ) : (
          view.facts.length > 0 && (
            // 근거 행의 활자는 승인 조건 카드 그대로 — 라벨 12px gray-600 / 값 14px medium,
            // 산문 줄은 14px weak. 사실 하나가 줄 하나를 갖는다.
            <dl className="col-start-2 col-end-4 flex flex-col gap-1.5">
              {view.facts.map((fact, i) =>
                fact.label ? (
                  <div key={i} className="flex items-baseline gap-2">
                    <dt className="w-[68px] flex-none text-[12px] leading-[1.5] text-[var(--pl-gray-600)]">
                      {fact.label}
                    </dt>
                    <dd className="min-w-0 flex-1 text-[14px] leading-[1.5] tabular-nums break-keep text-[var(--pl-text-medium)]">
                      {fact.value}
                    </dd>
                  </div>
                ) : (
                  <dd key={i} className="text-[14px] leading-[1.6] break-keep text-[var(--pl-text-weak)]">
                    {fact.value}
                  </dd>
                ),
              )}
            </dl>
          )
        )}
      </div>
    </section>
  );
}
