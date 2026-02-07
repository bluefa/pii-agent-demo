/**
 * 데이터 어댑터 선택 (환경 기반) - ADR-005
 *
 * USE_MOCK_DATA=true → mockAdapter (개발)
 * USE_MOCK_DATA=false → bffAdapter (프로덕션)
 */

import { mockAdapter } from './mock-adapter';
import { bffAdapter } from './bff-adapter';
import type { DataAdapter } from './types';

export const dataAdapter: DataAdapter =
  process.env.USE_MOCK_DATA === 'true'
    ? mockAdapter
    : bffAdapter;

export type { DataAdapter, ProviderResult } from './types';
