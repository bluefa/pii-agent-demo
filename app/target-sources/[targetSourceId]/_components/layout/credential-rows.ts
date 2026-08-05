import type { SecretKey } from '@/lib/types';

/**
 * Credential 이름은 `{userId}-{credential name}` 이다. 한 칸에 붙여 두면 "운영DB-MySQL"과
 * "운영DB-MySQL-replica" 처럼 앞부분이 같은 후보들이 한 덩어리 문자열로만 읽혀, 무엇이 다른지
 * 눈으로 찾아야 했다. 두 값으로 갈라 각자의 열에 둔다.
 */
export interface CredentialRow {
  /** 원본 이름 — 저장/비교는 항상 이 값으로 한다. */
  name: string;
  userId: string;
  label: string;
  createdAt: string;
}

/**
 * 첫 하이픈에서만 자른다: 뒤쪽 하이픈은 이름의 일부다(`운영DB-MySQL-replica` →
 * `운영DB` + `MySQL-replica`). 하이픈이 없거나 맨 앞에 있으면 userId 를 지어내지 않고
 * 전체를 이름으로 둔다 — 규칙에 맞지 않는 값을 규칙에 맞는 것처럼 보이게 하는 편이 더 나쁘다.
 */
export const toCredentialRow = (secret: SecretKey): CredentialRow => {
  const cut = secret.name.indexOf('-');
  return {
    name: secret.name,
    userId: cut > 0 ? secret.name.slice(0, cut) : '',
    label: cut > 0 ? secret.name.slice(cut + 1) : secret.name,
    // 계약은 loose 라 시각이 비어 올 수 있다. 여기서 '' 로 눕혀 두면 정렬은 그 행을
    // 맨 끝으로 보내고, 셀은 — 를 찍는다.
    createdAt: secret.createTimeStr ?? '',
  };
};

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
