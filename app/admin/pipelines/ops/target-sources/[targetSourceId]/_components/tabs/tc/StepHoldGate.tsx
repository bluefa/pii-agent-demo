'use client';

/**
 * 5단계 종료 조건 두 행 — 연결 테스트 카드 안, 알림 상자들 아래·실행 밴드 바로 위.
 *
 * 이 탭은 「현재 단계」 로젠지가 붙는 탭인데 밴드는 최신 실행이 어땠는지만 말했다. 실행
 * 결과는 5단계 종료 조건의 절반이고, 나머지 절반(서비스 담당자의 승인 요청)과 그 둘을
 * 되돌리는 사건(관리자의 재실행 요청)이 화면에 없어서 "성공했는데 왜 5단계인가"에 답이
 * 없었다 (docs/ux/benchmark/step5-hold-reason.md, 시안 E). 두 행이 그 답이다.
 *
 * 문법은 관리자 승인 탭의 승인 조건 카드(`GateCard`)에서 빌렸다 — 판정 마크 셋(✓ 충족 ·
 * ✗ 미충족 · ⚠ 미확인) · 요건문 · 라벨–값 근거 행. 카드 셋을 한 행 세 열로 세우는 그쪽
 * 껍데기는 안 빌린다: 여기는 실행 밴드 위에 얹히는 한 프레임이라 두 행이 한 목록으로 선다.
 * 마크 낱말도 그쪽 그대로다 — 모름은 ✗ 를 쓰지 못한다(확인하지 못한 것을 미충족이라
 * 단정하게 된다).
 *
 * ⛔ 게이트가 아니다. 실행 버튼을 잠그지 않는다(#856 「게이트가 아니라 주의」와 같은 규칙).
 * 관리자의 실행은 여전히 정당한 우회로이고, 이 프레임은 무엇이 남았고 누구 차례인지만 말한다.
 *
 * 5단계에서만 선다. 판정은 `stepHoldView` 가 접고, 이 파일은 그리기만 한다.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import type {
  StepHoldRow,
  StepHoldView,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/stepHold';

const RUN_REQUIREMENT = '최신 연결 테스트 결과가 성공이어야 합니다';
const ACK_REQUIREMENT = '서비스 담당자가 승인 요청을 눌러야 합니다';

/** 판정 마크 — 승인 탭 GateCard 의 셋 + 「아직 물을 수 없다」의 시계. 20px 은 그쪽 값. */
function RowMark({ state }: { state: StepHoldRow['state'] }): ReactElement {
  switch (state) {
    case 'ok':
      return <Icon name="check-circle" size={20} className="text-[var(--pl-ok-text)]" title="충족" />;
    case 'unmet':
      return <Icon name="x-circle" size={20} className="text-[var(--pl-err-text)]" title="미충족" />;
    case 'unknown':
      return <Icon name="warn-tri" size={20} className="text-[var(--pl-warn-text)]" title="미확인" />;
    case 'loading':
      return (
        <Icon
          name="loader"
          size={20}
          className="animate-spin text-[var(--pl-text-weak)] motion-reduce:animate-none"
        />
      );
    default:
      // 앞 조건이 안 서서 아직 판정할 수 없는 행 — 미충족(✗)이 아니라 순서상 대기다.
      return <Icon name="clock" size={20} className="text-[var(--pl-text-weak)]" title="대기" />;
  }
}

function HoldRow({ text, row }: { text: string; row: StepHoldRow }): ReactElement {
  const loading = row.state === 'loading' && row.facts.length === 0;
  return (
    <li className="grid grid-cols-[20px_1fr] gap-x-2.5 gap-y-2 px-4 py-3">
      <span
        className="mt-px flex-none"
        {...(loading ? { role: 'status', 'aria-label': '확인 중' } : {})}
      >
        <RowMark state={row.state} />
      </span>
      <p
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold leading-[1.4] break-keep',
          row.state === 'na' ? 'text-[var(--pl-text-weak)]' : 'text-[var(--pl-text-strong)]',
        )}
      >
        {text}
        {row.tag && <TcPill tone={row.tag.tone} label={row.tag.label} />}
      </p>
      {loading ? (
        // 근거가 앉을 자리를 미리 잡아 둔다 — 도착하면서 프레임이 자라면 아래 밴드가 밀린다.
        <div aria-hidden className={cn(pipelineStyles.skeletonBar, 'col-start-2 h-[21px] w-2/3 rounded')} />
      ) : (
        row.facts.length > 0 && (
          // 근거 행의 활자는 승인 조건 카드 그대로 — 라벨 12px gray-600 / 값 14px medium,
          // 산문 줄은 14px weak. 사실 하나가 줄 하나를 갖는다.
          <dl className="col-start-2 flex flex-col gap-1.5">
            {row.facts.map((fact, i) =>
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
    </li>
  );
}

export interface StepHoldGateProps {
  /** null = 이 대상은 5단계가 아니다(또는 SDU) — 아무것도 그리지 않는다. */
  view: StepHoldView | null;
  className?: string;
}

export function StepHoldGate({ view, className }: StepHoldGateProps): ReactElement | null {
  if (!view) return null;
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
      <ol className="divide-y divide-[var(--pl-border)]">
        <HoldRow text={RUN_REQUIREMENT} row={view.run} />
        <HoldRow text={ACK_REQUIREMENT} row={view.ack} />
      </ol>
    </section>
  );
}
