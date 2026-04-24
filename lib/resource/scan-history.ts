import type { MockResource } from '@/lib/types';

export type ResourceScanHistory = '신규' | '변경' | null;

// I-06 (Phase 0): BFF 가 scanHistoryStatus 필드를 게시할 때까지 null 반환.
// 모든 row 가 '—' 로 렌더되며, 필드가 들어오면 이 함수 본문만 교체하면 됨.
export const getResourceScanHistory = (_resource: MockResource): ResourceScanHistory => null;
