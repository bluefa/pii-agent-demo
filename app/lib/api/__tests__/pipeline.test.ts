import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OrchestratorApiError,
  createPipeline,
  getLatestPipelineByTarget,
  getPipeline,
  getTaskDetail,
} from '@/app/lib/api/pipeline';

const fetchMock = vi.fn();

describe('app/lib/api/pipeline CSR helper', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves {status, code, message, body} on a 409 as OrchestratorApiError', async () => {
    const errorBody = {
      timestamp: '2026-07-06T00:00:00Z',
      status: '409 CONFLICT',
      code: 'ORCHESTRATION_PIPELINE_ALREADY_ACTIVE',
      message: "target '1006' already has an active run",
      path: '/api/v1/target-sources/1006/pipelines',
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(errorBody), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const thrown = await createPipeline('1006', { type: 'INSTALL' }).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(OrchestratorApiError);
    if (thrown instanceof OrchestratorApiError) {
      expect(thrown.status).toBe(409);
      expect(thrown.code).toBe('ORCHESTRATION_PIPELINE_ALREADY_ACTIVE');
      expect(thrown.message).toBe("target '1006' already has an active run");
      expect(thrown.body).toEqual(errorBody);
    }
  });

  it('resolves latest-by-target to null on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(getLatestPipelineByTarget('1010')).resolves.toBeNull();
  });

  it('returns the parsed body on a 200', async () => {
    const detail = { pipeline_id: 128, status: 'RUNNING', target_source_id: '1006' };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(detail), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(getPipeline(128)).resolves.toEqual(detail);
  });

  // The detail page's stale-result prevention (lazy task-detail fetch + live
  // poll) relies on these two getters forwarding an AbortSignal to fetch so an
  // in-flight request can be cancelled when the selection changes / on unmount.
  it('forwards the AbortSignal to fetch for getPipeline', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ pipeline_id: 128 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const controller = new AbortController();
    await getPipeline(128, { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
  });

  it('forwards the AbortSignal to fetch for getTaskDetail', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ task_id: 12401 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const controller = new AbortController();
    await getTaskDetail(128, 12401, { signal: controller.signal });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/pipelines/128/tasks/12401');
    expect(init).toMatchObject({ signal: controller.signal });
  });

  it('rejects with the fetch AbortError once the signal is aborted', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.reject(
        Object.assign(new Error('The operation was aborted'), {
          name: init?.signal?.aborted ? 'AbortError' : 'Error',
        }),
      ),
    );
    const controller = new AbortController();
    controller.abort();
    const thrown = await getTaskDetail(128, 12401, { signal: controller.signal }).catch(
      (e: unknown) => e,
    );
    expect((thrown as Error).name).toBe('AbortError');
  });
});
