import { splitCredentialName } from '@/lib/credentials';
import type { SecretKey } from '@/lib/types';

/** 갈라 놓은 이름 + 원본 + 생성 시각. 가르는 규칙 자체는 `lib/credentials` 가 소유한다 —
 *  관리자 화면의 Credential 배정도 같은 규칙으로 갈라야 하기 때문이다. */
export interface CredentialRow {
  /** 원본 이름 — 저장/비교는 항상 이 값으로 한다. */
  name: string;
  userId: string;
  label: string;
  createdAt: string;
}

export const toCredentialRow = (secret: SecretKey): CredentialRow => ({
  name: secret.name,
  ...splitCredentialName(secret.name),
  // 계약은 loose 라 시각이 비어 올 수 있다. 여기서 '' 로 눕혀 두면 정렬은 그 행을
  // 맨 끝으로 보내고, 셀은 — 를 찍는다.
  createdAt: secret.createTimeStr ?? '',
});

export type CredentialSortKey = 'userId' | 'label' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

/** 검색은 갈라 놓은 두 값 중 어느 쪽에 걸려도 맞다 — 사용자는 앞뒤 어느 쪽으로도 찾는다. */
export const matchesQuery = (row: CredentialRow, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return row.name.toLowerCase().includes(needle);
};

export const sortCredentialRows = (
  rows: readonly CredentialRow[],
  key: CredentialSortKey,
  direction: SortDirection,
): CredentialRow[] => {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    // 같은 값이면 이름으로 한 번 더 가른다 — 정렬이 렌더마다 흔들리지 않게.
    const primary =
      key === 'createdAt'
        ? a.createdAt.localeCompare(b.createdAt)
        : a[key].localeCompare(b[key]);
    return (primary || a.name.localeCompare(b.name)) * sign;
  });
};
