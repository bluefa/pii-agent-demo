/**
 * Typed shapes for `bff.users` methods (ADR-011 setup spec adr011-01).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 */

import type { User } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';

export type { CurrentUser };

/** GET /users/search. */
export interface UserSearchResponse {
  users: Array<Pick<User, 'id' | 'name' | 'email'>>;
}

/** GET /user/me. The BFF wraps the user under `{ user }`. */
export interface UserMeResponse {
  user: CurrentUser;
}

/** GET /user/services. */
export interface UserServicesResponse {
  services: Array<{ service_code: string; service_name: string }>;
}

/** GET /user/services/page. */
export interface UserServicesPageResponse {
  content: Array<{ service_code: string; service_name: string }>;
  page: {
    page?: number;
    size: number;
    number?: number;
    total_elements: number;
    total_pages: number;
  };
}
