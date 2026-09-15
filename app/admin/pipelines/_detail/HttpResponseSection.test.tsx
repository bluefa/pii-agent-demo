// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAttemptHttpResponse = vi.fn();
vi.mock('@/app/lib/api/pipeline', () => ({
  getAttemptHttpResponse: (...args: unknown[]) => getAttemptHttpResponse(...args),
}));

import { HttpResponseSection } from '@/app/admin/pipelines/_detail/HttpResponseSection';

afterEach(() => {
  cleanup();
  getAttemptHttpResponse.mockReset();
});

describe('HttpResponseSection', () => {
  it('fetches the attempt response and shows status + body', async () => {
    getAttemptHttpResponse.mockResolvedValue({
      metadata: { operation: 'CONFIRMATION_POST', status_code: 400, content_type: 'application/json',
        received_at: null, truncated: false, confirmation_input_id: 1 },
      body: '{"code":"INVALID_REQUEST","message":"Invalid confirmed resource request"}',
    });
    render(<HttpResponseSection pipelineId={108} taskId={348} attemptNumber={1} />);
    expect(await screen.findByText('Infra Manager 응답')).toBeTruthy();
    expect(screen.getByText(/HTTP 400 · CONFIRMATION_POST/)).toBeTruthy();
    expect(screen.getByText(/"message": "Invalid confirmed resource request"/)).toBeTruthy();
    expect(getAttemptHttpResponse).toHaveBeenCalledWith(108, 348, 1, expect.anything());
  });

  it('shows a skeleton while loading', () => {
    getAttemptHttpResponse.mockReturnValue(new Promise(() => {}));
    render(<HttpResponseSection pipelineId={108} taskId={348} attemptNumber={1} />);
    expect(screen.getByText('Infra Manager 응답')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Infra Manager 응답을 불러오는 중' })).toBeTruthy();
  });

  it('says so and offers 재시도 when the call fails', async () => {
    getAttemptHttpResponse
      .mockRejectedValueOnce(new Error('502'))
      .mockResolvedValueOnce({
        metadata: { operation: 'CONFIRMATION_POST', status_code: 400, content_type: null,
          received_at: null, truncated: false, confirmation_input_id: null },
        body: '{}',
      });
    render(<HttpResponseSection pipelineId={108} taskId={348} attemptNumber={1} />);
    expect(await screen.findByText('Infra Manager 응답을 불러오지 못했습니다')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '재시도' }));
    await waitFor(() => expect(screen.getByText(/HTTP 400/)).toBeTruthy());
    expect(getAttemptHttpResponse).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when nothing was stored (204 → null)', async () => {
    getAttemptHttpResponse.mockResolvedValue(null);
    render(<HttpResponseSection pipelineId={108} taskId={348} attemptNumber={2} />);
    await waitFor(() => expect(getAttemptHttpResponse).toHaveBeenCalled());
    expect(screen.queryByText('Infra Manager 응답')).toBeNull();
  });
});
