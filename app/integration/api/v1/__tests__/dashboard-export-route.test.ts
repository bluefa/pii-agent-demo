import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    dashboard: {
      systemsExport: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/admin/dashboard/systems/export/route';
import { bff } from '@/lib/bff/client';

const mockedExport = vi.mocked(bff.dashboard.systemsExport);

describe('GET /integration/api/v1/admin/dashboard/systems/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CSV body와 content-type을 그대로 전달한다', async () => {
    const csv = 'col1,col2\nrow1a,row1b';
    mockedExport.mockResolvedValue(
      new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="dashboard-systems.csv"',
        },
      }),
    );

    const response = await GET(
      new Request('http://localhost/integration/api/v1/admin/dashboard/systems/export?search=foo'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain('dashboard-systems.csv');
    await expect(response.text()).resolves.toBe(csv);
  });
});
