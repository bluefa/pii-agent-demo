/**
 * Typed shapes for `bff.dev` methods (ADR-011 setup spec adr011-01).
 *
 * Conventions (per adr011-README §"Observable Behavior Invariants" I-3):
 *   - GET responses use camelCase (`proxyGet` runs `camelCaseKeys`).
 *   - POST/PUT/DELETE responses use snake_case (raw passthrough).
 */

import type { UserRole } from '@/lib/types';

export interface DevUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** GET /dev/users (camelCase). */
export interface DevGetUsersResponse {
  currentUser: DevUser | null;
  users: DevUser[];
}

/** POST /dev/switch-user (snake_case raw passthrough). */
export interface DevSwitchUserResult {
  success: boolean;
  user: DevUser;
}
