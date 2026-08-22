import { cache } from 'react';
import { bff } from '@/lib/bff/client';

/**
 * Request-scoped `/user/me`. Two server surfaces need the same answer on one
 * render — every layout's TopNav chip and the `/admin` gate — and `cache`
 * collapses them into a single upstream call.
 *
 * This is the only path to `/user/me`. The CSR one it replaced — `getCurrentUser`
 * plus the `/pass/api/v1/user/me` proxy route behind it — is gone.
 */
export const getMe = cache(() => bff.users.me());

/**
 * Chip variant. A failed call is not an error state here: auth is owned by the
 * IAP/SSO layer in front of the app, so the chip just hides and the bar renders.
 * The `/admin` gate keeps `getMe` instead, because it has to tell "not an admin"
 * apart from "BFF down".
 */
export const getMeOrNull = () => getMe().catch(() => null);
