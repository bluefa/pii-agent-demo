'use client';

/**
 * TaskFlow — horizontal task-chain canvas (design-inventory §Flow). Status-tinted
 * nodes + state-aware connectors on a dotted-grid canvas that scrolls ONLY inside
 * itself (the page never shifts; nodes never wrap/shrink). Click / Enter / Space
 * on a node opens its detail modal.
 *
 * The node/connector grammar needs pseudo-elements (connector line + arrowhead)
 * and keyframes (node pulse, spinner, flow-dash) that Tailwind utility classes
 * can't express, so the structural CSS is scoped here in a single <style> block
 * keyed under `.pl-flow` rather than added to `globals.css`. Every color —
 * including the rgba alpha layers (idle-tint, connector dash gap, pulse halo) —
 * is still a `--pl-*` token declared in app/globals.css (verbatim prototype
 * rgba values, just named instead of inlined); only the rule grammar lives here.
 */
import { Fragment, useCallback, type KeyboardEvent, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import { KindChip } from '@/app/integration/admin/pipelines/_components/KindChip';
import {
  connectorClass,
  nodeStateClass,
} from '@/app/integration/admin/pipelines/_detail/flowClasses';
import { taskMetaLine } from '@/lib/pipeline/format';
import type { TaskDetail, TaskStatus, TaskSummary } from '@/lib/pipeline/types';

const FLOW_CSS = `
.pl-flow{display:flex;align-items:center;overflow-x:auto;padding:24px 16px;background-color:var(--pl-bg-inner);background-image:radial-gradient(circle,var(--pl-gray-200) 1px,transparent 1px);background-size:16px 16px;border:1px solid var(--pl-border);border-radius:10px}
.pl-flow .pl-tnode{flex:none;width:178px;background:var(--pl-bg-card);border:1px solid var(--pl-border);border-radius:10px;padding:12px 12px 10px;position:relative;cursor:pointer;box-shadow:var(--pl-shadow-xs);transition:border-color .15s,box-shadow .15s}
.pl-flow .pl-tnode:hover{border-color:var(--pl-border-strong)}
.pl-flow .pl-tnode:focus-visible{outline:2px solid var(--pl-primary);outline-offset:2px}
.pl-flow .nd-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.pl-flow .nd-ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;background:var(--pl-off-bg);color:var(--pl-text-faint)}
.pl-flow .nd-ico svg{width:14px;height:14px;stroke-width:2.5}
.pl-flow .nd-name{font-size:14px;font-weight:600;line-height:1.3;color:var(--pl-text-strong);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pl-flow .nd-meta{font-size:12px;color:var(--pl-text-weak);line-height:1.4;min-height:17px;margin-top:6px;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pl-flow .pl-tnode.s-done{border-color:var(--pl-ok-border)}
.pl-flow .pl-tnode.s-done .nd-ico{background:var(--pl-ok-bg);color:var(--pl-ok-text)}
.pl-flow .pl-tnode.s-running{border-color:var(--pl-info)}
.pl-flow .pl-tnode.s-running .nd-ico{background:var(--pl-info-bg);color:var(--pl-info-text)}
.pl-flow .pl-tnode.s-ready{border-color:var(--pl-warn-border)}
.pl-flow .pl-tnode.s-ready .nd-ico{background:var(--pl-warn-bg);color:var(--pl-warn-text)}
.pl-flow .pl-tnode.s-failed{border-color:var(--pl-err-border);box-shadow:0 0 0 4px var(--pl-flow-failed-halo)}
.pl-flow .pl-tnode.s-failed .nd-ico{background:var(--pl-err-bg);color:var(--pl-err-text)}
.pl-flow .pl-tnode.s-failed .nd-meta{color:var(--pl-err-text);font-weight:600}
.pl-flow .pl-tnode.s-queued{border-style:dashed;background:var(--pl-flow-idle-bg)}
.pl-flow .pl-tnode.s-queued .nd-name{color:var(--pl-text-weak)}
.pl-flow .pl-tnode.s-cancelled{background:var(--pl-flow-idle-bg)}
.pl-flow .pl-tnode.s-cancelled .nd-ico{background:var(--pl-off-bg);color:var(--pl-off-text)}
.pl-flow .pl-tnode.s-cancelled .nd-name{color:var(--pl-text-weak)}
.pl-flow .pl-spin{width:13px;height:13px;border-radius:50%;border:2px solid var(--pl-info-border);border-top-color:var(--pl-info);display:inline-block}
.pl-flow .pl-connector{flex:none;width:48px;height:14px;position:relative}
.pl-flow .pl-connector::before{content:"";position:absolute;left:2px;right:9px;top:50%;margin-top:-1px;height:2px;background:var(--pl-gray-300);border-radius:1px}
.pl-flow .pl-connector::after{content:"";position:absolute;right:2px;top:50%;transform:translateY(-50%);border:5px solid transparent;border-left:6px solid var(--pl-gray-300);border-right:0}
.pl-flow .pl-connector.done::before{background:var(--pl-ok)}
.pl-flow .pl-connector.done::after{border-left-color:var(--pl-ok)}
.pl-flow .pl-connector.active::before{background:repeating-linear-gradient(90deg,var(--pl-info) 0 6px,var(--pl-flow-connector-info) 6px 12px)}
.pl-flow .pl-connector.active::after{border-left-color:var(--pl-info)}
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

/** Node status glyph: DONE ✓ / IN_PROGRESS spinner / FAILED ✕ / CANCELLED ⊘ / else seq. */
function nodeIcon(status: TaskStatus, sequence: number): ReactElement | string {
  switch (status) {
    case 'DONE':
      return <Icon name="check" />;
    case 'IN_PROGRESS':
      return <span className="pl-spin" aria-hidden="true" />;
    case 'FAILED':
      return <Icon name="x" />;
    case 'CANCELLED':
      return <Icon name="ban" />;
    default:
      return String(sequence);
  }
}

export interface TaskFlowProps {
  tasks: readonly TaskSummary[];
  /** task_id → loaded TaskDetail (null while pending / on failure). */
  detailMap: ReadonlyMap<number, TaskDetail | null>;
  resolveName: (task: TaskSummary) => string;
  onOpen: (task: TaskSummary) => void;
  className?: string;
}

export function TaskFlow({ tasks, detailMap, resolveName, onOpen, className }: TaskFlowProps): ReactElement {
  const onKey = useCallback(
    (task: TaskSummary) => (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(task);
      }
    },
    [onOpen],
  );

  return (
    <div className={cn('pl-flow mt-3', className)}>
      <style>{FLOW_CSS}</style>
      {tasks.map((task, index) => {
        const name = resolveName(task);
        return (
          <Fragment key={task.task_id}>
            {index > 0 && (
              <div
                className={cn('pl-connector', connectorClass(tasks[index - 1].status, task.status))}
                aria-hidden="true"
              />
            )}
            <div
              className={cn('pl-tnode', nodeStateClass(task.status))}
              role="button"
              tabIndex={0}
              aria-label={`seq ${task.sequence} ${name} 상세 열기`}
              onClick={() => onOpen(task)}
              onKeyDown={onKey(task)}
            >
              <div className="nd-top">
                <span className="nd-ico">{nodeIcon(task.status, task.sequence)}</span>
                <span className="nd-name">{name}</span>
              </div>
              <KindChip kind={task.kind} />
              <div className="nd-meta">{taskMetaLine(task, detailMap.get(task.task_id))}</div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
