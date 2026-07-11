import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    pipeline: {
      detail: vi.fn(),
      create: vi.fn(),
      latestByTarget: vi.fn(),
      list: vi.fn(),
    },
  },
}));

import { GET as detailGET } from '@/app/api/v1/orchestrator/pipelines/[pipelineId]/route';
import { GET as listGET } from '@/app/api/v1/orchestrator/pipelines/route';
import { GET as latestGET } from '@/app/api/v1/orchestrator/target-sources/[targetSourceId]/pipelines/latest/route';
import { POST as createPOST } from '@/app/api/v1/orchestrator/target-sources/[targetSourceId]/pipelines/route';
import { bff } from '@/lib/bff/client';
import { OrchestratorUnreachableError } from '@/lib/bff/errors';

const mockedDetail = vi.mocked(bff.pipeline.detail);
const mockedCreate = vi.mocked(bff.pipeline.create);
const mockedLatest = vi.mocked(bff.pipeline.latestByTarget);
const mockedList = vi.mocked(bff.pipeline.list);

describe('orchestrator proxy routes (withOrchestratorProxy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes a 200 body through verbatim and stamps x-request-id', async () => {
    const body = { pipeline_id: 128, status: 'RUNNING', target_source_id: '1006' };
    mockedDetail.mockResolvedValue({ status: 200, body });

    const response = await detailGET(
      new Request('http://localhost/integration/api/v1/orchestrator/pipelines/128'),
      { params: Promise.resolve({ pipelineId: '128' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(mockedDetail).toHaveBeenCalledWith('128');
  });

  it('passes a 409 error body + status through VERBATIM (no ProblemDetails rewrite)', async () => {
    const errorBody = {
      timestamp: '2026-07-06T00:00:00Z',
      status: '409 CONFLICT',
      code: 'ORCHESTRATION_PIPELINE_ALREADY_ACTIVE',
      message: "target '1006' already has an active run",
      path: '/api/v1/target-sources/1006/pipelines',
    };
    mockedCreate.mockResolvedValue({ status: 409, body: errorBody });

    const response = await createPOST(
      new Request('http://localhost/integration/api/v1/orchestrator/target-sources/1006/pipelines', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'INSTALL' }),
      }),
      { params: Promise.resolve({ targetSourceId: '1006' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(errorBody);
    expect(mockedCreate).toHaveBeenCalledWith('1006', { type: 'INSTALL' });
  });

  it('returns an empty 204 for latest when the target has no runs', async () => {
    mockedLatest.mockResolvedValue({ status: 204, body: null });

    const response = await latestGET(
      new Request('http://localhost/integration/api/v1/orchestrator/target-sources/1010/pipelines/latest'),
      { params: Promise.resolve({ targetSourceId: '1010' }) },
    );

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
  });

  it('passes REPEATABLE sort params through to bff.pipeline.list intact and in order', async () => {
    mockedList.mockResolvedValue({ status: 200, body: { content: [] } });

    const response = await listGET(
      new Request(
        'http://localhost/integration/api/v1/orchestrator/pipelines?size=200&sort=createdAt,desc&sort=id,desc',
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mockedList).toHaveBeenCalledTimes(1);
    const forwarded = new URLSearchParams(mockedList.mock.calls[0][0]);
    expect(forwarded.get('size')).toBe('200');
    expect(forwarded.getAll('sort')).toEqual(['createdAt,desc', 'id,desc']);
  });

  it('maps an unreachable upstream to 502 ORCHESTRATOR_UNREACHABLE', async () => {
    mockedDetail.mockRejectedValueOnce(new OrchestratorUnreachableError('pipeline-orchestrator unreachable'));

    const response = await detailGET(
      new Request('http://localhost/integration/api/v1/orchestrator/pipelines/128'),
      { params: Promise.resolve({ pipelineId: '128' }) },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: 'ORCHESTRATOR_UNREACHABLE' });
  });
});
