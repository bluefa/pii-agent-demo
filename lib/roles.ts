/**
 * `UserMeResponse.role` 판정. 서버 게이트(`app/admin/layout.tsx`)와 그 게이트를
 * 노출로 반영하는 클라이언트(`UserChip`)가 반드시 같은 규칙을 써야 한다 —
 * 한쪽만 casing/공백을 정규화하면 메뉴는 보이는데 열면 차단되는(또는 그 반대)
 * 화면이 나온다.
 *
 * 허용 목록이다. 계약(`docs/swagger/install-v1.yaml` UserMeResponse.role)이
 * 선언한 값은 ADMIN 과 USER 두 개이고, 그중 접근을 여는 건 ADMIN 뿐이다.
 * `!== 'ADMIN'` 부정형이면 나중에 추가되는 role 이 아무 결정 없이 관리자 권한을
 * 물려받는다 — 새 role 은 여기 명시적으로 넣어야 열린다.
 * `role` 은 raw 패스스루로 도착해 문자열이 아닐 수 있어 먼저 강제 변환한다.
 */
export const isAdminRole = (role: unknown): boolean =>
  String(role ?? '')
    .trim()
    .toUpperCase() === 'ADMIN';
