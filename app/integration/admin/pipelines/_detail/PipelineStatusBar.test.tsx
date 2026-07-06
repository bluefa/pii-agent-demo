import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnchorHTMLAttributes } from 'react';

// next/link needs the App Router context; stub it as a plain anchor.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PipelineStatusBar } from '@/app/integration/admin/pipelines/_detail/PipelineStatusBar';
import type { PipelineDetail, PipelineStatus, TaskSummary } from '@/lib/pipeline/types';

function pipeline(partial: Partial<PipelineDetail> & Pick<PipelineDetail, 'status'>): PipelineDetail {
  const tasks: TaskSummary[] = partial.tasks ?? [
    { task_id: 1, sequence: 0, kind: 'TERRAFORM_JOB', task_definition: 'a', operation: 'AWS_SERVICE_TF_APPLY', status: 'DONE', fail_count: 0, error_code: null, consumes_terraform_slot: true, started_at: null, finished_at: null, description: null },
  ];
  return {
    pipeline_id: partial.pipeline_id ?? 128,
    type: partial.type ?? 'INSTALL',
    target_source_id: partial.target_source_id ?? '1006',
    cloud_provider: partial.cloud_provider ?? 'AWS',
    recipe_definition: partial.recipe_definition ?? 'AWS_INSTALL_V1',
    status: partial.status,
    created_at: partial.created_at ?? '2026-06-30T05:00:00Z',
    last_activity_at: partial.last_activity_at ?? '2026-06-30T05:10:00Z',
    next_due_at: partial.next_due_at ?? null,
    leased: partial.leased ?? false,
    cancel_requested: partial.cancel_requested ?? false,
    due_lag_millis: partial.due_lag_millis ?? 0,
    current_task_sequence: partial.current_task_sequence ?? null,
    final_task_sequence: partial.final_task_sequence ?? null,
    current_fail_count: partial.current_fail_count ?? null,
    current_max_fail_count: partial.current_max_fail_count ?? null,
    done_task_count: partial.done_task_count ?? 1,
    total_task_count: partial.total_task_count ?? tasks.length,
    tasks,
  };
}

const opName = (t: TaskSummary): string => t.operation ?? t.task_definition;

const renderPipeline = (d: PipelineDetail): string =>
  renderToStaticMarkup(
    <PipelineStatusBar detail={d} variant="pipeline" resolveName={opName} onCancel={() => {}} />,
  );

describe('PipelineStatusBar — pipeline variant sb-meta gating', () => {
  it('shows leased + 스케줄 지연 only for non-terminal (RUNNING/PENDING)', () => {
    const running = renderPipeline(pipeline({ status: 'RUNNING', leased: true }));
    expect(running).toContain('leased 예 — 워커 실행 중');
    expect(running).toContain('스케줄 지연');

    const done = renderPipeline(pipeline({ status: 'DONE' }));
    expect(done).not.toContain('leased');
    expect(done).not.toContain('스케줄 지연');
  });

  it('flags a > 1000ms schedule lag with ⚠️', () => {
    expect(renderPipeline(pipeline({ status: 'RUNNING', due_lag_millis: 2500 }))).toContain('2500 ms ⚠️');
    expect(renderPipeline(pipeline({ status: 'RUNNING', due_lag_millis: 200 }))).not.toContain('⚠️');
  });

  it('renders the 취소 요청됨 ftag + 취소 처리 대기 중 when cancel_requested', () => {
    const html = renderPipeline(pipeline({ status: 'RUNNING', cancel_requested: true }));
    expect(html).toContain('취소 요청됨');
    expect(html).toContain('취소 처리 대기 중');
    expect(html).toContain('disabled'); // cancel button disabled (canCancel false)
  });

  it('shows the 다음 실행 meta when RUNNING with a next_due_at', () => {
    expect(renderPipeline(pipeline({ status: 'RUNNING', next_due_at: '2026-06-30T06:00:00Z' }))).toContain('다음 실행');
  });

  it('shows 진행·대기 중만 취소 가능 when terminal (not cancellable, not requested)', () => {
    expect(renderPipeline(pipeline({ status: 'FAILED' }))).toContain('진행·대기 중만 취소 가능');
  });
});

describe('PipelineStatusBar — target variant', () => {
  const renderTarget = (status: PipelineStatus): string =>
    renderToStaticMarkup(
      <PipelineStatusBar
        detail={pipeline({ status })}
        variant="target"
        resolveName={opName}
        onCancel={() => {}}
        openHref="/integration/admin/pipelines/128"
      />,
    );

  it('renders the {type} #{id} · 레시피 · 생성 · 마지막 활동 sb-meta always', () => {
    const html = renderTarget('DONE');
    expect(html).toContain('#128');
    expect(html).toContain('레시피');
    expect(html).toContain('AWS 인프라 설치'); // recipe display name
    expect(html).toContain('생성');
    expect(html).toContain('마지막 활동');
    expect(html).toContain('href="/integration/admin/pipelines/128"'); // drill-down link
  });

  it('shows the 취소 button only when RUNNING/PENDING', () => {
    expect(renderTarget('RUNNING')).toContain('이 파이프라인을 취소합니다');
    expect(renderTarget('DONE')).not.toContain('이 파이프라인을 취소합니다');
  });
});
