// @vitest-environment jsdom
/**
 * Two behaviours the 인프라 작업 tab depends on:
 *
 *   1. The start CTA obeys `blockedReason` (확정 정보 gate). A dead button that
 *      still looks alive is the failure mode worth pinning.
 *   2. TerraformImpactNote is DERIVED, not fixed — it must count this run's
 *      terraform_action values, escalate on DESTROY, and stay silent for a run
 *      that touches no infrastructure at all.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  CurrentPipelineCard,
  EmptyPipelineCard,
} from '@/app/admin/pipelines/_detail/CurrentPipelineCard';
import type { PipelineDetail, TaskSummary, TerraformAction } from '@/lib/pipeline/types';

const PRE_WARNING = /작업을 시작하면 Terraform이 실행되어/;

const makeTask = (
  sequence: number,
  terraform_action: TerraformAction | null,
): TaskSummary => ({
  task_id: sequence,
  sequence,
  kind: terraform_action ? 'TERRAFORM_JOB' : 'CONDITION_CHECK',
  task_definition: `TASK_${sequence}`,
  operation: null,
  terraform_action,
  status: 'READY',
  fail_count: 0,
  error_code: null,
  consumes_terraform_slot: terraform_action != null,
  started_at: null,
  finished_at: null,
  description: null,
});

const makeDetail = (actions: Array<TerraformAction | null>): PipelineDetail =>
  ({
    pipeline_id: 900,
    type: 'INSTALL',
    target_source_id: '1583',
    service_code: 'svc',
    service_name: '재고서비스',
    cloud_provider: 'IDC',
    recipe_definition: 'IDC_INSTALL_V1',
    status: 'RUNNING',
    done_task_count: 0,
    total_task_count: actions.length,
    created_at: '2026-07-29T00:00:00.000Z',
    last_activity_at: '2026-07-29T00:00:00.000Z',
    current_task_sequence: 1,
    current_fail_count: null,
    current_max_fail_count: null,
    tasks: actions.map((action, index) => makeTask(index + 1, action)),
  }) as unknown as PipelineDetail;

const renderRun = (actions: Array<TerraformAction | null>) =>
  render(
    <CurrentPipelineCard
      detail={makeDetail(actions)}
      defs={new Map()}
      onOpenPipeline={vi.fn()}
    />,
  );

const startButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: /작업 시작/ }) as HTMLButtonElement;

describe('EmptyPipelineCard — 확정 정보 gate', () => {
  it('allows the start CTA and pre-warns when no reason is given', () => {
    render(<EmptyPipelineCard onStart={vi.fn()} />);

    expect(startButton().disabled).toBe(false);
    expect(screen.getByText(PRE_WARNING)).toBeTruthy();
  });

  it('disables the start CTA and states the reason when blocked', () => {
    render(<EmptyPipelineCard onStart={vi.fn()} blockedReason="확정된 연동 정보가 없어 시작할 수 없습니다." />);

    expect(startButton().disabled).toBe(true);
    expect(screen.getByText('확정된 연동 정보가 없어 시작할 수 없습니다.')).toBeTruthy();
    // The pre-warning describes what the button would do — pointless once it can't.
    expect(screen.queryByText(PRE_WARNING)).toBeNull();
  });
});

describe('TerraformImpactNote', () => {
  it('counts the run\'s own terraform actions', () => {
    renderRun(['PLAN', 'APPLY', 'APPLY']);

    expect(screen.getByText('이 작업은 실제 인프라를 변경합니다')).toBeTruthy();
    expect(screen.getByText('APPLY 2건')).toBeTruthy();
    expect(screen.getByText('PLAN 1건')).toBeTruthy();
  });

  it('escalates the wording when the run destroys', () => {
    renderRun(['PLAN', 'DESTROY', 'DESTROY', 'DESTROY']);

    expect(screen.getByText('이 작업은 실제 인프라를 삭제합니다')).toBeTruthy();
    expect(screen.getByText('DESTROY 3건')).toBeTruthy();
  });

  it('says nothing for a run with no terraform task', () => {
    renderRun([null, null]);

    expect(screen.queryByText(/실제 인프라를/)).toBeNull();
  });
});
