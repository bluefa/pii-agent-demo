/**
 * DB Credential 이름은 `{userId}-{credential name}` 이다. 한 칸에 붙여 두면 "hgildong-mysql" 과
 * "hgildong-mysql-replica" 처럼 앞부분이 같은 후보들이 한 덩어리 문자열로만 읽혀, 무엇이 다른지
 * 눈으로 찾아야 한다. 두 값으로 갈라 각자의 열에 둔다.
 *
 * 사용자 화면(Step 5)과 관리자 화면이 같은 이름을 다르게 가르면 같은 Credential 이 두 화면에서
 * 다른 사람의 것으로 읽힌다 — 그래서 규칙은 여기 한 곳에만 있다.
 */
export interface CredentialNameParts {
  userId: string;
  label: string;
}

/**
 * 첫 하이픈에서만 자른다: 뒤쪽 하이픈은 이름의 일부다(`hgildong-mysql-replica` →
 * `hgildong` + `mysql-replica`). 하이픈이 없거나 맨 앞에 있으면 userId 를 지어내지 않고
 * 전체를 이름으로 둔다 — 규칙에 맞지 않는 값을 규칙에 맞는 것처럼 보이게 하는 편이 더 나쁘다.
 */
export const splitCredentialName = (name: string): CredentialNameParts => {
  const cut = name.indexOf('-');
  return cut > 0
    ? { userId: name.slice(0, cut), label: name.slice(cut + 1) }
    : { userId: '', label: name };
};
