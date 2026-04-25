/**
 * Typed shapes for `bff.users` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

import type { User } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';

export type { CurrentUser };

/** GET /users/search (camelCase). */
export interface UserSearchResponse {
  users: Array<Pick<User, 'id' | 'name' | 'email'>>;
}

/** GET /user/me (camelCase). The BFF wraps the user under `{ user }`. */
export interface UserMeResponse {
  user: CurrentUser;
}

/** GET /user/services (camelCase). */
export interface UserServicesResponse {
  services: Array<{ serviceCode: string; serviceName: string }>;
}

/** GET /user/services/page (camelCase). */
export interface UserServicesPageResponse {
  content: Array<{ serviceCode: string; serviceName: string }>;
  page: {
    page?: number;
    size: number;
    number?: number;
    totalElements: number;
    totalPages: number;
  };
}
