import { cache } from 'react';
import { bff } from '@/lib/bff/client';

/**
 * Request-scoped `/user/me`. Two server surfaces need the same answer on one
 * render — every layout's TopNav chip and the `/admin` gate — and `cache`
 * collapses them into a single upstream call.
 *
 * This supersedes the CSR path: `getCurrentUser` in `app/lib/api` and the
 * `/pass/api/v1/user/me` proxy route behind it now have no caller. They are
 * left in place because deleting them touches `app/lib/api/**` and `app/api/**`,
 * which contract-check reads as a contract change and fails without a swagger
 * diff — they go in a pass that can clear that gate.
 */
export const getMe = cache(() => bff.users.me());

/**
 * Chip variant. A failed call is not an error state here: auth is owned by the
 * IAP/SSO layer in front of the app, so the chip just hides and the bar renders.
 * The `/admin` gate keeps `getMe` instead, because it has to tell "not an admin"
 * apart from "BFF down".
 */
export const getMeOrNull = () => getMe().catch(() => null);
