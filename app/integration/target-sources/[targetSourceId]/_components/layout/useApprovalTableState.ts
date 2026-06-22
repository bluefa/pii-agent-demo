'use client';

import { useCallback, useMemo, useState } from 'react';
import type { WaitingApprovalResource } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import type { ApprovalFilter } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';

const DEFAULT_PAGE_SIZE = 10;

const collectOptions = (
  resources: readonly WaitingApprovalResource[],
  accessor: (resource: WaitingApprovalResource) => string,
): ReadonlyArray<{ value: string; label: string }> => {
  const unique = new Set<string>();
  for (const resource of resources) {
    const value = accessor(resource).trim();
    if (value) unique.add(value);
  }
  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
};

/**
 * Search / filter / pagination state shared by the step-2 and step-3 approval tables.
 * Pure derivation over the supplied resource list — both cards fetch their own data,
 * then drive the identical toolbar + table + pagination from this hook.
 */
export const useApprovalTableState = (resources: readonly WaitingApprovalResource[]) => {
  const [searchValue, setSearchValue] = useState('');
  const [filter, setFilter] = useState<ApprovalFilter>('all');
  const [dbType, setDbType] = useState('');
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const dbTypeOptions = useMemo(
    () => collectOptions(resources, (resource) => resource.resourceType),
    [resources],
  );
  const regionOptions = useMemo(
    () => collectOptions(resources, (resource) => resource.region),
    [resources],
  );

  const countsByFilter = useMemo(() => {
    let target = 0;
    let excluded = 0;
    for (const resource of resources) {
      if (resource.selected) target += 1;
      else excluded += 1;
    }
    return { all: resources.length, target, excluded };
  }, [resources]);

  const filteredResources = useMemo(() => {
    const search = searchValue.trim().toLowerCase();
    return resources.filter((resource) => {
      if (dbType && resource.resourceType !== dbType) return false;
      if (region && resource.region !== region) return false;
      if (filter === 'target' && !resource.selected) return false;
      if (filter === 'excluded' && resource.selected) return false;
      if (search) {
        const hayId = resource.resourceId.toLowerCase();
        const hayName = resource.resourceName.toLowerCase();
        if (!hayId.includes(search) && !hayName.includes(search)) return false;
      }
      return true;
    });
  }, [resources, dbType, region, filter, searchValue]);

  const filteredCount = filteredResources.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const sliceStart = safePage * pageSize;
  const sliceEnd = Math.min(filteredCount, sliceStart + pageSize);
  const visibleResources = useMemo(
    () => filteredResources.slice(sliceStart, sliceEnd),
    [filteredResources, sliceStart, sliceEnd],
  );
  const visibleStart = filteredCount === 0 ? 0 : sliceStart + 1;
  const visibleEnd = sliceEnd;

  const handleFilterChange = useCallback((next: ApprovalFilter) => {
    setFilter(next);
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((next: string) => {
    setSearchValue(next);
    setPage(0);
  }, []);

  const handleDbTypeChange = useCallback((next: string) => {
    setDbType(next);
    setPage(0);
  }, []);

  const handleRegionChange = useCallback((next: string) => {
    setRegion(next);
    setPage(0);
  }, []);

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(0);
  }, []);

  return {
    searchValue,
    filter,
    dbType,
    region,
    pageSize,
    safePage,
    dbTypeOptions,
    regionOptions,
    countsByFilter,
    filteredCount,
    visibleResources,
    visibleStart,
    visibleEnd,
    onSearchChange: handleSearchChange,
    onFilterChange: handleFilterChange,
    onDbTypeChange: handleDbTypeChange,
    onRegionChange: handleRegionChange,
    onPageChange: setPage,
    onPageSizeChange: handlePageSizeChange,
  };
};
