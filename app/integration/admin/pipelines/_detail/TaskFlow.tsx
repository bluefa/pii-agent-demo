'use client';

/**
 * TaskFlow — horizontal task-chain canvas, R19 n8n-style (improvement-r18.md
 * lineage; owner: "N8N처럼, 격자 무늬, 카드 가운데 정렬, Terraform+클라우드
 * 아이콘"). Line-grid canvas (fine 20px + strong 100px), a centered track
 * (margin-inline:auto — centers when it fits, scrolls when it overflows),
 * identity icon pair per node (kind mark: Terraform logomark / condition
 * clock + provider logomark; IDC·SDU are text chips), and the task STATUS as
 * an n8n-style corner badge instead of the old leading status tile.
 *
 * The node/connector grammar needs pseudo-elements and keyframes that Tailwind
 * utilities can't express, so the structural CSS is scoped here in a single
 * <style> block keyed under `.pl-flow`. Every color is a `--pl-*` token from
 * app/globals.css; only the rule grammar lives here.
 */
import { Fragment, useCallback, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import {
  connectorClass,
  nodeStateClass,
} from '@/app/integration/admin/pipelines/_detail/flowClasses';
import { taskMetaLine } from '@/lib/pipeline/format';
import type { CloudProvider, TaskDetail, TaskStatus, TaskSummary } from '@/lib/pipeline/types';

const FLOW_CSS = `
.pl-flow{display:flex;align-items:stretch;min-height:440px;overflow:hidden;background-color:var(--pl-bg-inner);background-image:linear-gradient(var(--pl-flow-grid) 1px,transparent 1px),linear-gradient(90deg,var(--pl-flow-grid) 1px,transparent 1px),linear-gradient(var(--pl-flow-grid-strong) 1px,transparent 1px),linear-gradient(90deg,var(--pl-flow-grid-strong) 1px,transparent 1px);background-size:20px 20px,20px 20px,100px 100px,100px 100px;border:1px solid var(--pl-border);border-radius:12px}
.pl-flow .pl-scroll{flex:1;min-width:0;overflow-x:auto;padding:28px 20px;display:flex;flex-direction:column;justify-content:center}
.pl-flow .pl-track{display:flex;align-items:center;width:max-content;margin-inline:auto}
.pl-flow .pl-tnode{flex:none;width:184px;background:var(--pl-bg-card);border:1px solid var(--pl-border);border-radius:10px;padding:12px 12px 10px;position:relative;cursor:pointer;box-shadow:var(--pl-shadow-xs);transition:border-color .15s,box-shadow .15s}
.pl-flow .pl-tnode:hover{border-color:var(--pl-border-strong)}
.pl-flow .pl-tnode:focus-visible{outline:2px solid var(--pl-primary);outline-offset:2px}
.pl-flow .pl-tnode.s-selected{outline:2px solid var(--pl-primary);outline-offset:2px}
.pl-flow .nd-icons{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.pl-flow .nd-mark{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex:none;background:var(--pl-bg-card);border:1px solid var(--pl-border)}
.pl-flow .nd-mark.m-cond{color:var(--pl-text-weak);background:var(--pl-gray-100);border-color:var(--pl-gray-100)}
.pl-flow .nd-mark-txt{width:auto;min-width:26px;padding:0 6px;height:26px;border-radius:7px;display:grid;place-items:center;flex:none;background:var(--pl-gray-100);border:1px solid var(--pl-gray-100);font-size:12px;font-weight:700;letter-spacing:.02em;color:var(--pl-gray-600)}
.pl-flow .nd-badge{position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px var(--pl-bg-inner)}
.pl-flow .nd-badge svg{width:12px;height:12px;stroke-width:3}
.pl-flow .nd-badge.b-done{background:var(--pl-ok);color:var(--pl-white)}
.pl-flow .nd-badge.b-failed{background:var(--pl-err);color:var(--pl-white)}
.pl-flow .nd-badge.b-cancelled{background:var(--pl-gray-400);color:var(--pl-white)}
.pl-flow .nd-badge.b-running{background:var(--pl-bg-card);border:1px solid var(--pl-info-border)}
.pl-flow .nd-badge.b-ready{background:var(--pl-warn);color:var(--pl-white)}
.pl-flow .nd-badge.b-queued{background:var(--pl-gray-200);color:var(--pl-text-weak)}
.pl-flow .nd-name{font-size:14px;font-weight:600;line-height:1.3;color:var(--pl-text-strong);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pl-flow .nd-meta{font-size:12px;color:var(--pl-text-weak);line-height:1.4;min-height:17px;margin-top:6px;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pl-flow .pl-tnode.s-done{border-color:var(--pl-ok-border)}
.pl-flow .pl-tnode.s-running{border-color:var(--pl-info)}
.pl-flow .pl-tnode.s-ready{border-color:var(--pl-warn-border)}
.pl-flow .pl-tnode.s-failed{border-color:var(--pl-err-border);box-shadow:0 0 0 4px var(--pl-flow-failed-halo)}
.pl-flow .pl-tnode.s-failed .nd-meta{color:var(--pl-err-text);font-weight:600}
.pl-flow .pl-tnode.s-queued{border-style:dashed;background:var(--pl-flow-idle-bg)}
.pl-flow .pl-tnode.s-queued .nd-name{color:var(--pl-text-weak)}
.pl-flow .pl-tnode.s-cancelled{background:var(--pl-flow-idle-bg)}
.pl-flow .pl-tnode.s-cancelled .nd-name{color:var(--pl-text-weak)}
.pl-flow .pl-spin{width:12px;height:12px;border-radius:50%;border:2px solid var(--pl-info-border);border-top-color:var(--pl-info);display:inline-block}
.pl-flow .pl-connector{flex:none;width:56px;height:14px;position:relative}
.pl-flow .pl-connector .cdot{position:absolute;left:1px;top:50%;transform:translateY(-50%);width:6px;height:6px;border-radius:50%;background:var(--pl-gray-300)}
.pl-flow .pl-connector::before{content:"";position:absolute;left:6px;right:9px;top:50%;margin-top:-1px;height:2px;border-radius:1px;background:var(--pl-gray-300)}
.pl-flow .pl-connector::after{content:"";position:absolute;right:2px;top:50%;transform:translateY(-50%);border:5px solid transparent;border-left:6px solid var(--pl-gray-300);border-right:0}
.pl-flow .pl-connector.done .cdot{background:var(--pl-ok)}
.pl-flow .pl-connector.done::before{background:var(--pl-ok)}
.pl-flow .pl-connector.done::after{border-left-color:var(--pl-ok)}
.pl-flow .pl-connector.active .cdot{background:var(--pl-info)}
.pl-flow .pl-connector.active::before{background:repeating-linear-gradient(90deg,var(--pl-info) 0 6px,var(--pl-flow-connector-info) 6px 12px)}
.pl-flow .pl-connector.active::after{border-left-color:var(--pl-info)}
.pl-flow .pl-connector.toFail .cdot{background:var(--pl-err)}
.pl-flow .pl-connector.toFail::before{background:repeating-linear-gradient(90deg,var(--pl-err) 0 6px,var(--pl-flow-connector-err) 6px 12px)}
.pl-flow .pl-connector.toFail::after{border-left-color:var(--pl-err)}
@keyframes pl-nodePulse{0%,100%{box-shadow:0 0 0 3px var(--pl-flow-pulse-info-a)}50%{box-shadow:0 0 0 8px var(--pl-flow-pulse-info-b)}}
@keyframes pl-nodePulseAmber{0%,100%{box-shadow:0 0 0 3px var(--pl-flow-pulse-warn-a)}50%{box-shadow:0 0 0 8px var(--pl-flow-pulse-warn-b)}}
@keyframes pl-spin{to{transform:rotate(360deg)}}
@keyframes pl-flowDash{to{background-position:12px 0}}
@media (prefers-reduced-motion:no-preference){
.pl-flow .pl-tnode.s-running{animation:pl-nodePulse 1.8s ease-in-out infinite}
.pl-flow .pl-tnode.s-ready{animation:pl-nodePulseAmber 2.2s ease-in-out infinite}
.pl-flow .pl-spin{animation:pl-spin .8s linear infinite}
.pl-flow .pl-connector.active::before{animation:pl-flowDash .5s linear infinite}
}
`;

/** Terraform logomark — three isometric blocks, brand purple (artwork, not UI text). */
function TerraformMark(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--pl-brand-tf)" aria-hidden="true" focusable="false">
      <path d="M8.7 4.3 15 7.9v7.2L8.7 11.5Z" />
      <path d="M15.8 8.4 22 4.8v7.2l-6.2 3.6Z" opacity=".75" />
      <path d="M2 8.2l6 3.4v7L2 15.2Z" opacity=".55" />
      <path d="M8.7 12.6 15 16.2v7.2l-6.3-3.6Z" />
    </svg>
  );
}

/** Simplified provider logomarks; IDC/SDU render as text chips (owner: 글자만). */
function ProviderMark({ provider }: { provider: CloudProvider }): ReactElement {
  switch (provider) {
    case 'AWS':
      return (
        <span className="nd-mark" title="AWS">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <text
              x="12"
              y="12.5"
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="700"
              fill="var(--pl-brand-aws-ink)"
              fontFamily="var(--pl-font-sans)"
            >
              aws
            </text>
            <path
              d="M5.5 15.5c4 2.6 9.2 2.6 13-.2"
              stroke="var(--pl-brand-aws-smile)"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
            <path d="m18.5 13.6.3 2-2 .3" stroke="var(--pl-brand-aws-smile)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </span>
      );
    case 'AZURE':
      return (
        <span className="nd-mark" title="Azure">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M13.2 4 6.3 18.6a.8.8 0 0 0 .7 1.1h4l6.9-15.7Z" fill="var(--pl-pv-azure)" opacity=".65" />
            <path d="m14.6 8.6-4 9.3 3.3 1.8h4.9a.8.8 0 0 0 .7-1.1Z" fill="var(--pl-pv-azure)" />
          </svg>
        </span>
      );
    case 'GCP':
      return (
        <span className="nd-mark" title="Google Cloud">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M7 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.62-1.46A4.5 4.5 0 0 1 17.5 18H7Z"
              fill="var(--pl-pv-gcp)"
            />
          </svg>
        </span>
      );
    default:
      return <span className="nd-mark-txt">{provider}</span>;
  }
}

/** n8n-style corner status badge: DONE ✓ / FAILED ✕ / spinner / CANCELLED ⊘ / seq. */
function nodeBadge(status: TaskStatus, sequence: number): ReactElement {
  switch (status) {
    case 'DONE':
      return (
        <span className="nd-badge b-done" aria-hidden="true">
          <Icon name="check" />
        </span>
      );
    case 'FAILED':
      return (
        <span className="nd-badge b-failed" aria-hidden="true">
          <Icon name="x" />
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="nd-badge b-running" aria-hidden="true">
          <span className="pl-spin" />
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="nd-badge b-cancelled" aria-hidden="true">
          <Icon name="ban" />
        </span>
      );
    case 'READY':
      return (
        <span className="nd-badge b-ready" aria-hidden="true">
          {sequence}
        </span>
      );
    default:
      return (
        <span className="nd-badge b-queued" aria-hidden="true">
          {sequence}
        </span>
      );
  }
}

export interface TaskFlowProps {
  tasks: readonly TaskSummary[];
  /** task_id → loaded TaskDetail (null while pending / on failure). */
  detailMap: ReadonlyMap<number, TaskDetail | null>;
  resolveName: (task: TaskSummary) => string;
  /** Pipeline's cloud provider — drives each node's provider logomark. */
  provider: CloudProvider;
  onOpen: (task: TaskSummary) => void;
  /** R18 §7-3 — task_id whose inline panel is open (primary ring highlight). */
  selectedId?: number | null;
  /**
   * R19.5 — right-docked detail panel (TaskDetailPanel), rendered flush at the
   * canvas edge OUTSIDE the horizontal scroll region so it can never block
   * left/right scrolling (owner mandate).
   */
  panel?: ReactNode;
  className?: string;
}

/** Center the clicked node in the scrollport (the overlay panel may cover the
 *  right edge — R19.5); block:'nearest' keeps the page from jumping. */
function revealNode(el: HTMLElement): void {
  el.scrollIntoView({
    inline: 'center',
    block: 'nearest',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

export function TaskFlow({
  tasks,
  detailMap,
  resolveName,
  provider,
  onOpen,
  selectedId,
  panel,
  className,
}: TaskFlowProps): ReactElement {
  const onKey = useCallback(
    (task: TaskSummary) => (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(task);
        revealNode(event.currentTarget);
      }
    },
    [onOpen],
  );

  return (
    <div className={cn('pl-flow', className)}>
      <style>{FLOW_CSS}</style>
      <div className="pl-scroll">
        <div className="pl-track">
        {tasks.map((task, index) => {
          const name = resolveName(task);
          return (
            <Fragment key={task.task_id}>
              {index > 0 && (
                <div
                  className={cn('pl-connector', connectorClass(tasks[index - 1].status, task.status))}
                  aria-hidden="true"
                >
                  <span className="cdot" />
                </div>
              )}
              <div
                className={cn('pl-tnode', nodeStateClass(task.status), selectedId === task.task_id && 's-selected')}
                role="button"
                tabIndex={0}
                aria-label={`${name} 상세 열기`}
                aria-pressed={selectedId === task.task_id}
                onClick={(event) => {
                  onOpen(task);
                  revealNode(event.currentTarget);
                }}
                onKeyDown={onKey(task)}
              >
                <div className="nd-icons">
                  {task.kind === 'TERRAFORM_JOB' ? (
                    <span className="nd-mark" title="Terraform">
                      <TerraformMark />
                    </span>
                  ) : (
                    <span className="nd-mark m-cond" title="조건 확인 — 폴링">
                      <Icon name="clock" size="sm" />
                    </span>
                  )}
                  <ProviderMark provider={provider} />
                </div>
                {nodeBadge(task.status, task.sequence)}
                <span className="nd-name">{name}</span>
                <div className="nd-meta">{taskMetaLine(task, detailMap.get(task.task_id))}</div>
              </div>
            </Fragment>
          );
        })}
        </div>
      </div>
      {panel}
    </div>
  );
}
