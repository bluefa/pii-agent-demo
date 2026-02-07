/**
 * 데이터 어댑터 선택 (환경 기반) - ADR-005
 *
 * USE_MOCK_DATA=false → bffAdapter (프로덕션)
 * 그 외 (미설정 포함) → mockAdapter (개발, 기본값)
 */

import { mockAdapter } from './mock-adapter';
import { bffAdapter } from './bff-adapter';
import type { DataAdapter } from './types';

export const dataAdapter: DataAdapter =
  process.env.USE_MOCK_DATA !== 'false'
    ? mockAdapter
    : bffAdapter;

export type { DataAdapter, ProviderResult } from './types';
