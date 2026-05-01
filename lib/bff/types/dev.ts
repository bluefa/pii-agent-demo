/**
 * Typed shapes for `bff.dev` methods (ADR-011 setup spec adr011-01).
 *
 * Responses are snake_case at the BFF boundary (see ADR-014).
 */

import type { UserRole } from '@/lib/types';

export interface DevUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** GET /dev/users. */
export interface DevGetUsersResponse {
  current_user: DevUser | null;
  users: DevUser[];
}

/** POST /dev/switch-user (snake_case raw passthrough). */
export interface DevSwitchUserResult {
  success: boolean;
  user: DevUser;
}
