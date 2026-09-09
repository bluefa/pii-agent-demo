/**
 * 재확정(ADR-023)이 목 백엔드에서 네 CSP 모두 완주하는가 — preview 로 순서를 보고,
 * 생성해서 실행이 서는 데까지.
 *
 * 레시피는 CSP 마다 삭제 prefix 만 다르고 꼬리 둘은 같다: 확정 정보 삭제 →
 * 추천값으로 다시 등록. 그 꼬리 둘이 `HTTP_REQUEST` · ALL_CSP 이며, 네 레시피가 같은
 * 정의 **하나씩**을 공유한다(복제본 없음).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mockPipeline, resetPipelineMockStore } from '@/lib/bff/mock/pipeline';
import type {
  CloudProvider,
  OrchestratorErrorBody,
  PipelineDetail,
  PipelineSummary,
  RecipePreview,
  SpringPage,
  TaskCatalogResponse,
} from '@/lib/pipeline/types';

/** 활성 실행이 없는 대상 하나씩 — 있는 대상은 생성이 409 다(대상당 실행 하나). */
const TARGETS: ReadonlyArray<{
  provider: CloudProvider;
  targetSourceId: string;
  recipe: string;
  /** 삭제 prefix 길이 + 공통 Task 둘. */
  taskCount: number;
}> = [
  { provider: 'AWS', targetSourceId: '1008', recipe: 'AWS_RECONFIRM_V1', taskCount: 5 },
  { provider: 'GCP', targetSourceId: '1015', recipe: 'GCP_RECONFIRM_V1', taskCount: 4 },
  { provider: 'AZURE', targetSourceId: '1005', recipe: 'AZURE_RECONFIRM_V1', taskCount: 3 },
  { provider: 'IDC', targetSourceId: '1021', recipe: 'IDC_RECONFIRM_V1', taskCount: 4 },
];

const COMMON_TAIL = ['DELETE_CONFIRMED_RESOURCES_V1', 'CONFIRM_RESOURCES_FROM_RECOMMENDATION_V1'];

describe('mockPipeline — 재확정 (ADR-023)', () => {
  beforeEach(() => {
    resetPipelineMockStore();
  });

  describe('preview (#9)', () => {
    it.each(TARGETS)('$provider 는 $recipe 를 $taskCount 단계로 내놓는다', (t) => {
      const res = mockPipeline.preview(t.targetSourceId, 'RECONFIRM');
      expect(res.status).toBe(200);

      const preview = res.body as RecipePreview;
      expect(preview.type).toBe('RECONFIRM');
      expect(preview.provider).toBe(t.provider);
      expect(preview.recipe_definition).toBe(t.recipe);
      expect(preview.steps).toHaveLength(t.taskCount);
    });

    it.each(TARGETS)('$provider 의 마지막 두 단계는 같은 공통 Task 다', (t) => {
      const preview = mockPipeline.preview(t.targetSourceId, 'RECONFIRM').body as RecipePreview;
      const tail = preview.steps.slice(-2);

      expect(tail.map((s) => s.task_definition)).toEqual(COMMON_TAIL);
      // HTTP Task 는 terraform 슬롯을 쓰지 않고 PLAN/APPLY/DESTROY 도 갖지 않는다.
      for (const step of tail) {
        expect(step.kind).toBe('HTTP_REQUEST');
        expect(step.terraform_action).toBeNull();
        expect(step.consumes_terraform_slot).toBe(false);
      }
    });

    it.each(TARGETS)('$provider 의 앞쪽은 그 CSP 의 인프라 삭제 그대로다', (t) => {
      const preview = mockPipeline.preview(t.targetSourceId, 'RECONFIRM').body as RecipePreview;
      const destroy = mockPipeline.preview(t.targetSourceId, 'DELETE').body as RecipePreview;

      expect(preview.steps.slice(0, -2).map((s) => s.task_definition)).toEqual(
        destroy.steps.map((s) => s.task_definition),
      );
    });
  });

  describe('생성 (#10)', () => {
    it.each(TARGETS)('$provider 는 $taskCount 개 Task 를 가진 실행을 만든다', (t) => {
      const res = mockPipeline.create(t.targetSourceId, { type: 'RECONFIRM' });
      expect(res.status).toBe(200);

      const created = res.body as PipelineDetail;
      expect(created.type).toBe('RECONFIRM');
      expect(created.recipe_definition).toBe(t.recipe);
      expect(created.cloud_provider).toBe(t.provider);
      expect(created.total_task_count).toBe(t.taskCount);
      // 다른 유형과 같은 자리에서 선다 — 첫 Task 만 READY, 나머지는 BLOCKED.
      expect(created.status).toBe('PENDING');
      expect(created.tasks[0].status).toBe('READY');
      expect(created.tasks.at(-1)?.kind).toBe('HTTP_REQUEST');
    });

    it('만든 실행은 유형 필터로 다시 찾힌다', () => {
      const created = mockPipeline.create('1008', { type: 'RECONFIRM' }).body as PipelineDetail;
      const listed = mockPipeline.list('type=RECONFIRM');

      expect(listed.status).toBe(200);
      const rows = (listed.body as SpringPage<PipelineSummary>).content;
      expect(rows.map((p) => p.pipeline_id)).toContain(created.pipeline_id);
      expect(rows.every((p) => p.type === 'RECONFIRM')).toBe(true);
    });

    it('대상에 활성 실행이 있으면 409 — 재확정도 예외가 아니다', () => {
      mockPipeline.create('1008', { type: 'RECONFIRM' });
      const second = mockPipeline.create('1008', { type: 'RECONFIRM' });

      expect(second.status).toBe(409);
      expect((second.body as OrchestratorErrorBody).code).toBe('ORCHESTRATION_PIPELINE_ALREADY_ACTIVE');
    });
  });

  /**
   * ponytail 의 관측 가능한 면 — 공통 Task 둘은 레시피 안에서만 살고 카탈로그에는
   * 나오지 않는다. 이 검사가 깨지는 날은 `TaskCatalogEntry` 가 nullable provider 를
   * 받도록 넓어진 날이고, 그때 CUSTOM 빌더도 함께 열린다.
   */
  it('공통 Task 는 아직 CUSTOM 카탈로그에 없다', () => {
    for (const provider of ['AWS', 'GCP', 'AZURE', 'IDC'] as const) {
      const body = mockPipeline.taskDefinitions(provider).body as TaskCatalogResponse;
      const names = body.task_definitions.map((d) => d.name);

      for (const common of COMMON_TAIL) expect(names).not.toContain(common);
      // 그 CSP 의 Task 는 그대로 나온다 — 빠진 것은 공통 둘뿐이다.
      expect(names.length).toBeGreaterThan(0);
      expect(body.task_definitions.every((d) => d.provider === provider)).toBe(true);
    }
  });
});
