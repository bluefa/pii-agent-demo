import type { ServicePageResponse } from '@/app/lib/api';
import type { ServiceCode } from '@/lib/types';

export interface ServiceListState {
  services: ServiceCode[];
  selectedService: string | null;
  query: string;
  pageNum: number;
  pageInfo: ServicePageResponse['page'];
}

export type ServiceListAction =
  | { type: 'SET_SERVICES'; services: ServiceCode[]; pageInfo: ServicePageResponse['page'] }
  | { type: 'SET_SELECTED'; serviceCode: string | null }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_PAGE'; pageNum: number };

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
  }
};
