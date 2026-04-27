import 'client-only';

/**
 * One-shot module-level payload used to transfer ServiceList state from the
 * target-source detail page to /integration/admin during a soft navigation,
 * without exposing search query / page / service code in the URL.
 *
 * Lifecycle: written by the source route (immediately before router.push)
 * and consumed exactly once by AdminDashboard's hydration effect. Lives in
 * the same browser JS context only — F5 / new tab / direct entry returns null.
 */
export interface AdminNavigationPayload {
  selectedService: string;
  searchQuery: string;
  pageNumber: number;
}

let pendingAdminNavigation: AdminNavigationPayload | null = null;

export const setPendingAdminNavigation = (payload: AdminNavigationPayload): void => {
  pendingAdminNavigation = payload;
};

export const consumePendingAdminNavigation = (): AdminNavigationPayload | null => {
  const payload = pendingAdminNavigation;
  pendingAdminNavigation = null;
  return payload;
};
