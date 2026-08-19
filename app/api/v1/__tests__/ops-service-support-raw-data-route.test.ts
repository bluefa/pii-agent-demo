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

describe('GET …/admin/ops/services/[serviceCode] — support_raw_data 접기', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPage.mockResolvedValue({
      content: [
        row(1013, { supportRawData: true }),
        row(1014, { supportRawData: false }),
        row(1015, {}),
      ],
      totalPages: 1,
      totalElements: 3,
    } as never);
  });

  it('명시적 true 만 참으로 접힌다 — 값이 없는 대상은 태그를 얻지 못한다', async () => {
    const detail = (await (await call()).json()) as {
      target_sources: { target_source_id: number; support_raw_data: boolean }[];
    };
    const byId = new Map(detail.target_sources.map((t) => [t.target_source_id, t.support_raw_data]));

    expect(byId.get(1013)).toBe(true);
    expect(byId.get(1014)).toBe(false);
    // 미확인은 이 화면에서 "말할 근거가 없다" 로 접힌다 (태그엔 off 모양이 없다).
    expect(byId.get(1015)).toBe(false);
  });
});

/**
 * 최초 연동 시각은 camel 로 와서 snake 로 나간다 — 이 라우트가 유일한 홉이고, 여기서
 * 이름이 어긋나면 도장은 조용히 한 번도 안 찍힌다(에러도 빈 목록도 없이 그냥 없다).
 */
describe('GET …/admin/ops/services/[serviceCode] — 최초 연동 시각', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPage.mockResolvedValue({
      content: [
        row(1018, { piiAgentFirstInstalledAt: '2024-02-02T15:00:00Z' }),
        row(1011, {}),
      ],
      totalPages: 1,
      totalElements: 2,
    } as never);
  });

  it('camel 원문을 그대로 실어 보낸다', async () => {
    const detail = (await (await call()).json()) as {
      target_sources: { target_source_id: number; pii_agent_first_installed_at: string | null }[];
    };
    const byId = new Map(
      detail.target_sources.map((t) => [t.target_source_id, t.pii_agent_first_installed_at]),
    );

    expect(byId.get(1018)).toBe('2024-02-02T15:00:00Z');
    // 기록이 없는 대상은 null — 도장은 이 값 하나로 갈린다.
    expect(byId.get(1011)).toBeNull();
  });
});
