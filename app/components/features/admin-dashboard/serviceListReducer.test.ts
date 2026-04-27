import { describe, expect, it } from 'vitest';

import {
  buildInitialServiceListState,
  serviceListReducer,
  type ServiceListState,
} from '@/app/components/features/admin-dashboard/serviceListReducer';

describe('serviceListReducer — HYDRATE', () => {
  it('seeds selectedService, query and pageNum without touching services / pageInfo', () => {
    const seeded: ServiceListState = {
      ...buildInitialServiceListState(),
      services: [{ code: 'SVC-EXISTING', name: 'Existing' }],
      pageInfo: { totalElements: 1, totalPages: 1, number: 0, size: 10 },
    };

    const next = serviceListReducer(seeded, {
      type: 'HYDRATE',
      payload: {
        selectedService: 'SVC-CLICKED',
        searchQuery: 'sit',
        pageNumber: 3,
      },
    });

    expect(next.selectedService).toBe('SVC-CLICKED');
    expect(next.query).toBe('sit');
    expect(next.pageNum).toBe(3);
    // services / pageInfo are untouched — the subsequent fetch will overwrite them.
    expect(next.services).toBe(seeded.services);
    expect(next.pageInfo).toBe(seeded.pageInfo);
  });

  it('overwrites prior selectedService / query / pageNum values', () => {
    const seeded: ServiceListState = {
      ...buildInitialServiceListState(),
      selectedService: 'OLD',
      query: 'old-query',
      pageNum: 7,
    };

    const next = serviceListReducer(seeded, {
      type: 'HYDRATE',
      payload: {
        selectedService: 'NEW',
        searchQuery: '',
        pageNumber: 0,
      },
    });

    expect(next.selectedService).toBe('NEW');
    expect(next.query).toBe('');
    expect(next.pageNum).toBe(0);
  });
});
