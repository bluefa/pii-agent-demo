// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecipePreview } from '@/lib/pipeline/types';

// Wire sample 2026-10-02 — the China tail arrives with operation UNKNOWN.
const PREVIEW: RecipePreview = {
  type: 'INSTALL',
  provider: 'AWS',
  recipe_definition: 'AWS_INSTALL_V1',
  display_name: 'AWS 인프라 설치',
  description: '',
  steps: [
    {
      sequence: 6,
      task_definition: 'AWS_SERVICE_ACCOUNT_CREATE_V1',
      kind: 'HTTP_REQUEST',
      operation: 'UNKNOWN',
      terraform_action: null,
      display_name: 'AWS Agent Service Account 생성',
      consumes_terraform_slot: false,
      definition: {
        name: 'AWS_SERVICE_ACCOUNT_CREATE_V1',
        display_name: 'AWS Agent Service Account 생성',
        description: '',
        success_policy: '',
        result_storage: '',
      },
    },
  ],
};

vi.mock('@/app/lib/api/pipeline', () => ({
  previewRecipe: () => Promise.resolve(PREVIEW),
  getTaskDefinitions: () => Promise.resolve({ task_definitions: [] }),
  getLatestPipelineByTarget: () => Promise.resolve(null),
  createPipeline: vi.fn(),
  createCustomPipeline: vi.fn(),
  OrchestratorApiError: class extends Error {},
}));

import { PreviewModal } from '@/app/admin/pipelines/_detail/PreviewModal';
import { pipelineTypeGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';

afterEach(cleanup);

describe('PreviewModal — recipe preview marks', () => {
  it('marks an operation-UNKNOWN step by its definition, like every other surface', async () => {
    const { container } = render(
      <PreviewModal
        open
        onClose={vi.fn()}
        targetSourceId="1018"
        provider="AWS"
        initialType="INSTALL"
        typeGate={pipelineTypeGate('CONFIRMED', true)}
        showToast={vi.fn()}
        onStarted={vi.fn()}
      />,
    );
    await waitFor(() => expect(container.querySelector('.r24-ticon')).not.toBeNull());
    expect(container.querySelector('.r24-ticon')?.getAttribute('title')).toBe('Service Account 생성');
  });
});
