/**
 * Typed shapes for `bff.users` methods.
 *
 * Casing (ADR-019 D1/D2): responses are snake on the wire → `camelCaseKeys`
 * at the route-handler boundary → camel domain. These BffClient result types
 * are the post-`camelCaseKeys` (camel) domain shapes; mocks author the wire
 * (snake) shape and route through the same boundary (PLAN §2 mock-parity).
 *
 * Source of truth: `docs/swagger/install-v1.yaml` (operationIds searchUsers /
 * getUserServices / getUserMe). Spec F §5/§6/§7-A.
 */

/** Shared user shape — swagger `UserInfo` (case-neutral keys). */
export interface UserInfo {
  id?: string;
  name?: string;
  email?: string;
}

/** GET /users/search → `UserSearchResponse` (48). */
export interface UserSearchResponse {
  users?: UserInfo[];
}

/** GET /user/me → `UserMeResponse` (50) — FLAT (no `{ user }` wrapper). */
export interface UserMeResponse {
  id?: string;
  name?: string;
  email?: string;
}

/** Item of `PageServiceItem.content` — swagger `ServiceItem` (camel domain). */
export interface ServiceItem {
  serviceCode?: string;
  serviceName?: string;
}

/** swagger `SortObject` (camel domain). */
export interface SortObject {
  direction?: string;
  nullHandling?: string;
  ascending?: boolean;
  property?: string;
  ignoreCase?: boolean;
}

/** swagger `PageableObject` (camel domain). */
export interface PageableObject {
  paged?: boolean;
  pageNumber?: number;
  pageSize?: number;
  unpaged?: boolean;
  offset?: number;
  sort?: SortObject[];
}

/**
 * GET /user/services/page → `PageServiceItem` (49) — Spring Page envelope.
 *
 * Page metadata is FLAT on the envelope (`totalElements`/`totalPages`/
 * `number`/`size`) plus `pageable`/`sort` objects — NOT nested under a `page`
 * key. `content[]` is snake on the wire (`service_code`/`service_name`),
 * camel after `camelCaseKeys`.
 */
export interface PageServiceItem {
  totalPages?: number;
  totalElements?: number;
  pageable?: PageableObject;
  first?: boolean;
  last?: boolean;
  size?: number;
  content?: ServiceItem[];
  number?: number;
  sort?: SortObject[];
  numberOfElements?: number;
  empty?: boolean;
}
