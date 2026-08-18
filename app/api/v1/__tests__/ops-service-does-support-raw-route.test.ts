import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    taskQueue: {
      getTargetSourcesPage: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/admin/ops/services/[serviceCode]/route';
import { bff } from '@/lib/bff/client';

const mockedPage = vi.mocked(bff.taskQueue.getTargetSourcesPage);

/**
 * 서비스 운영 카드의 실데이터 태그는 세 상태 중 하나만 그린다 — 이 라우트가 접는
 * 자리다. 부정형으로 접히면(`!== false`) 필드를 아직 안 싣는 대상 전부에 태그가 붙어,
 * 화면이 계약에서 받은 적 없는 사실을 말하게 된다.
 */
const row = (targetSourceId: number, extra: Record<string, unknown>) => ({
  targetSourceId,
  cloudProvider: 'AZURE',
  updatedAt: '2026-08-01T00:00:00Z',
  ...extra,
});

const call = () =>
  GET(new Request('http://localhost/pass/api/v1/admin/ops/services/azure'), {
    params: Promise.resolve({ serviceCode: 'azure' }),
  });

describe('GET …/admin/ops/services/[serviceCode] — does_support_raw 접기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPage.mockResolvedValue({
      content: [
        row(1013, { doesSupportRaw: true }),
        row(1014, { doesSupportRaw: false }),
        row(1015, {}),
      ],
      totalPages: 1,
      totalElements: 3,
    } as never);
  });

  it('명시적 true 만 참으로 접힌다 — 값이 없는 대상은 태그를 얻지 못한다', async () => {
    const detail = (await (await call()).json()) as {
      target_sources: { target_source_id: number; does_support_raw: boolean }[];
    };
    const byId = new Map(detail.target_sources.map((t) => [t.target_source_id, t.does_support_raw]));

    expect(byId.get(1013)).toBe(true);
    expect(byId.get(1014)).toBe(false);
    // 미확인은 이 화면에서 "말할 근거가 없다" 로 접힌다 (태그엔 off 모양이 없다).
    expect(byId.get(1015)).toBe(false);
  });
});
