// @vitest-environment jsdom
/**
 * 재시작 모달이 성공과 실패를 각각 어떻게 넘기는지 — 두 경로 다 오너가 이번에
 * 지정한 동작이다(2026-09-03).
 *
 *   1. 성공하면 서버가 만든 새 작업을 `onStarted` 로 넘긴다. 작업 상세 페이지는
 *      이 값으로 새 작업으로 이동하고, ops 탭은 무시하고 제자리에서 갱신한다.
 *      id 를 안 넘기면 이동할 곳을 호출부가 알 수 없다.
 *   2. 실패하면 모달을 닫지 않고 CTA 바로 위에 실패를 남긴다. 서버 원문만으로는
 *      "재시작이 실패했다"가 안 읽히므로 그 사실을 앞에서 말한다.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineDetail, RestartPreview } from '@/lib/pipeline/types';

const getRestartPreview = vi.fn();
const restartPipeline = vi.fn();
const getTaskDefinitions = vi.fn();

vi.mock('@/app/lib/api/pipeline', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/api/pipeline')>(
    '@/app/lib/api/pipeline',
  );
  return {
    ...actual,
    getRestartPreview: (...args: unknown[]) => getRestartPreview(...args),
    restartPipeline: (...args: unknown[]) => restartPipeline(...args),
    getTaskDefinitions: (...args: unknown[]) => getTaskDefinitions(...args),
  };
});

const { RestartModal } = await import('@/app/admin/pipelines/_detail/RestartModal');

const PREVIEW: RestartPreview = {
  origin: {
    pipeline_id: 41,
    type: 'INSTALL',
    recipe_definition: 'AWS_INSTALL_V1',
    status: 'FAILED',
    total_task_count: 2,
  } as RestartPreview['origin'],
  resume_from_sequence: 1,
  skipped_tasks: [{ sequence: 0, task_definition: 'TASK_1', status: 'DONE' }],
  tasks_to_run: [
    {
      sequence: 1,
      task_definition: 'TASK_2',
      kind: 'TERRAFORM_JOB',
      terraform_action: 'APPLY',
      origin_task_id: 7,
      origin_status: 'FAILED',
      origin_error_code: 'JOB_FAILED',
      origin_fail_count: 3,
    },
  ],
  warnings: [],
};

const renderModal = (onStarted?: (created: PipelineDetail) => void) =>
  render(
    <RestartModal
      open
      onClose={vi.fn()}
      targetSourceId="1099"
      pipelineId={41}
      provider="AWS"
      showToast={vi.fn()}
      onStarted={onStarted}
    />,
  );

const restartButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: /단계부터 재시작/ }) as HTMLButtonElement;

beforeEach(() => {
  getRestartPreview.mockResolvedValue(PREVIEW);
  getTaskDefinitions.mockResolvedValue({ task_definitions: [] });
  restartPipeline.mockReset();
});

afterEach(cleanup);

describe('RestartModal', () => {
  it('hands the created run to onStarted, so the caller can follow it', async () => {
    restartPipeline.mockResolvedValue({ pipeline_id: 142 } as PipelineDetail);
    const onStarted = vi.fn();
    renderModal(onStarted);

    await waitFor(() => expect(restartButton().disabled).toBe(false));
    fireEvent.click(restartButton());

    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    expect(onStarted.mock.calls[0][0].pipeline_id).toBe(142);
  });

  it('leaves the failure by the button, saying the restart is what failed', async () => {
    restartPipeline.mockRejectedValue(new Error('작업 서버에 연결하지 못했습니다'));
    const onStarted = vi.fn();
    renderModal(onStarted);

    await waitFor(() => expect(restartButton().disabled).toBe(false));
    fireEvent.click(restartButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('재시작하지 못했습니다. 작업 서버에 연결하지 못했습니다');
    // 실패했는데 성공 경로가 울리면 호출부가 엉뚱한 작업으로 이동한다.
    expect(onStarted).not.toHaveBeenCalled();
    // 모달은 열린 채로 — 다시 누를 버튼이 있어야 한다.
    expect(restartButton()).toBeTruthy();
  });
});
