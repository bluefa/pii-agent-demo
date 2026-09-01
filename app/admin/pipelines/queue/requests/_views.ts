/**
 * The three views the 연동 요청 queue rail switches between, and the `?view=`
 * parser the server shell uses. A plain module (not the client view) so
 * `page.tsx` can validate the search param before any client bundle is reached.
 */

/** `?view=` slug — also the rail's item key. */
export type RequestView = 'pending' | 'rejected' | 'history';

const REQUEST_VIEWS: readonly RequestView[] = ['pending', 'rejected', 'history'];

/** `?view=` value → view. Unknown / missing falls back to the first 작업 view. */
export const requestView = (slug: string | undefined): RequestView =>
  REQUEST_VIEWS.find((v) => v === slug) ?? 'pending';
