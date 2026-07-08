import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LatestCell } from '@/app/integration/admin/pipelines/_services/LatestCell';
import type { PipelineStatus, PipelineSummary } from '@/lib/pipeline/types';

const summary = (status: PipelineStatus, pipeline_id = 128): PipelineSummary => ({
  pipeline_id,
  type: 'INSTALL',
  target_source_id: '101',
  service_code: 'SVC-000',
  service_name: '테스트 서비스',
  cloud_provider: 'AWS',
  recipe_definition: 'AWS_INSTALL_V1',
  status,
  done_task_count: 1,
  total_task_count: 3,
  created_at: '2026-07-01T00:00:00Z',
  last_activity_at: '2026-07-01T00:00:00Z',
});

const render = (entry: PipelineSummary | null | undefined): string =>
  renderToStaticMarkup(<LatestCell entry={entry} />);

describe('LatestCell', () => {
  it('loading (undefined) renders the muted em dash', () => {
    const html = render(undefined);
    expect(html).toContain('—');
    expect(html).toContain('--pl-text-weak');
    expect(html).not.toContain('#');
  });

  it('idle (null / 204) renders the muted em dash', () => {
    expect(render(null)).toContain('—');
  });

  it('terminal latest (DONE) is idle — muted, no pill', () => {
    const html = render(summary('DONE'));
    expect(html).toContain('—');
    expect(html).not.toContain('#128');
  });

  it('active RUNNING renders a pill + mono #id', () => {
    const html = render(summary('RUNNING', 128));
    expect(html).toContain('>RUNNING');
    expect(html).toContain('#128');
    expect(html).toContain('--pl-font-mono');
  });

  it('active PENDING renders a pill + mono #id', () => {
    const html = render(summary('PENDING', 129));
    expect(html).toContain('>PENDING');
    expect(html).toContain('#129');
  });
});
