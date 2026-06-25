import type { PageServiceItem } from '@/app/lib/api';

type ServiceItem = NonNullable<PageServiceItem['content']>[number];

// Page metadata extracted from the flat Spring Page envelope.
interface ServicePageInfo {
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface ServiceListState {
  services: ServiceItem[];
  selectedService: string | null;
  query: string;
  pageNum: number;
  pageInfo: ServicePageInfo;
}

export type ServiceListAction =
  | { type: 'SET_SERVICES'; services: ServiceItem[]; pageInfo: ServicePageInfo }
  | { type: 'SET_SELECTED'; serviceCode: string | null }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_PAGE'; pageNum: number }
  | { type: 'HYDRATE'; payload: { selectedService: string; searchQuery: string; pageNumber: number } };

export const buildInitialServiceListState = (): ServiceListState => ({
  services: [],
  selectedService: null,
  query: '',
  pageNum: 0,
  pageInfo: { totalElements: 0, totalPages: 0, number: 0, size: 10 },
});

export const serviceListReducer = (
  state: ServiceListState,
  action: ServiceListAction,
): ServiceListState => {
  switch (action.type) {
    case 'SET_SERVICES':
      return { ...state, services: action.services, pageInfo: action.pageInfo };
    case 'SET_SELECTED':
      return { ...state, selectedService: action.serviceCode };
    case 'SET_QUERY':
      return { ...state, query: action.query };
    case 'SET_PAGE':
      return { ...state, pageNum: action.pageNum };
    case 'HYDRATE':
      return {
        ...state,
        selectedService: action.payload.selectedService,
        query: action.payload.searchQuery,
        pageNum: action.payload.pageNumber,
      };
  }
};
