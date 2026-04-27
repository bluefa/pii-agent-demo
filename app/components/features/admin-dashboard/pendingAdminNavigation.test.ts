import { describe, expect, it, beforeEach } from 'vitest';

import {
  consumePendingAdminNavigation,
  setPendingAdminNavigation,
} from '@/app/components/features/admin-dashboard/pendingAdminNavigation';

describe('pendingAdminNavigation', () => {
  beforeEach(() => {
    // Drain any payload left over from a previous test so each case
    // starts from the empty state.
    consumePendingAdminNavigation();
  });

  it('returns null when nothing was set', () => {
    expect(consumePendingAdminNavigation()).toBeNull();
  });

  it('returns the payload that was last set', () => {
    setPendingAdminNavigation({
      selectedService: 'SVC-1',
      searchQuery: 'foo',
      pageNumber: 2,
    });
    expect(consumePendingAdminNavigation()).toEqual({
      selectedService: 'SVC-1',
      searchQuery: 'foo',
      pageNumber: 2,
    });
  });

  it('returns null on the second consume after a single set', () => {
    setPendingAdminNavigation({
      selectedService: 'SVC-1',
      searchQuery: '',
      pageNumber: 0,
    });
    consumePendingAdminNavigation();
    expect(consumePendingAdminNavigation()).toBeNull();
  });

  it('keeps only the most recent payload when set is called twice', () => {
    setPendingAdminNavigation({
      selectedService: 'SVC-1',
      searchQuery: 'first',
      pageNumber: 0,
    });
    setPendingAdminNavigation({
      selectedService: 'SVC-2',
      searchQuery: 'second',
      pageNumber: 5,
    });
    expect(consumePendingAdminNavigation()).toEqual({
      selectedService: 'SVC-2',
      searchQuery: 'second',
      pageNumber: 5,
    });
  });
});
