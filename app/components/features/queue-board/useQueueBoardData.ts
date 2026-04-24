import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { fetchInfraCamelJson } from '@/app/lib/api/infra';
import type { ApprovalRequestQueueResponse } from '@/lib/types/queue-board';

export type TabKey = 'pending' | 'processing' | 'completed';

const TAB_STATUS_MAP: Record<TabKey, string> = {
  pending: 'PENDING',
  processing: 'IN_PROGRESS',
  completed: 'APPROVED,REJECTED',
};

export const PAGE_SIZE = 20;

interface UseQueueBoardDataResult {
  activeTab: TabKey;
  requestType: string | null;
  search: string;
  page: number;
  data: ApprovalRequestQueueResponse | null;
  loading: boolean;
  setActiveTab: (tab: TabKey) => void;
  setRequestType: (type: string | null) => void;
  setSearch: (value: string) => void;
  setPage: Dispatch<SetStateAction<number>>;
  reset: () => void;
  refresh: () => void;
}

export const useQueueBoardData = (): UseQueueBoardDataResult => {
  const [activeTab, setActiveTabState] = useState<TabKey>('pending');
  const [requestType, setRequestTypeState] = useState<string | null>(null);
  const [search, setSearchState] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ApprovalRequestQueueResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(
    async (tab: TabKey, currentPage: number, type: string | null, query: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: TAB_STATUS_MAP[tab],
          page: String(currentPage),
          size: String(PAGE_SIZE),
          sort: 'requestedAt,desc',
        });
        if (type) params.set('requestType', type);
        if (query) params.set('search', query);

        const result = await fetchInfraCamelJson<ApprovalRequestQueueResponse>(
          `/task-admin/approval-requests?${params.toString()}`,
        );
        setData(result);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchData(activeTab, page, requestType, search);
  }, [activeTab, page, requestType, search, fetchData]);

  const setActiveTab = useCallback((tab: TabKey) => {
    setActiveTabState(tab);
    setPage(0);
  }, []);

  const setRequestType = useCallback((type: string | null) => {
    setRequestTypeState(type);
    setPage(0);
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(0);
  }, []);

  const reset = useCallback(() => {
    setRequestTypeState(null);
    setSearchState('');
    setPage(0);
  }, []);

  const refresh = useCallback(() => {
    fetchData(activeTab, page, requestType, search);
  }, [fetchData, activeTab, page, requestType, search]);

  return {
    activeTab,
    requestType,
    search,
    page,
    data,
    loading,
    setActiveTab,
    setRequestType,
    setSearch,
    setPage,
    reset,
    refresh,
  };
};
