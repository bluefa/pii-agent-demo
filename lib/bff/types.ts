import type { Project, SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';

/**
 * BFF 데이터 접근 인터페이스.
 * 순수 도메인 데이터를 반환한다 (NextResponse 아님).
 *
 * - mock: 기존 mock 핸들러를 래핑하여 데이터 추출
 * - http : 실제 BFF API 호출
 */
export interface BffClient {
  targetSources: {
    get: (id: number) => Promise<Project>;
    secrets: (id: number) => Promise<SecretKey[]>;
  };
  users: {
    me: () => Promise<CurrentUser>;
  };
}
