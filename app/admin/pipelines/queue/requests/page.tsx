/**
 * P2 연동 요청 목록 (/admin/pipelines/queue/requests) — server shell.
 *
 * The `?view=` deep link is read HERE rather than with useSearchParams in the
 * client view, so the view needs no Suspense boundary and the first paint
 * already shows the linked view (no flash of 승인 대기). `searchParams` is a
 * Promise on this Next version. Same shape as the ops target-source shell.
 */
import type { ReactElement } from 'react';

import { RequestsView } from '@/app/admin/pipelines/queue/requests/_components/RequestsView';
import { requestView } from '@/app/admin/pipelines/queue/requests/_views';

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}): Promise<ReactElement> {
  const { view } = await searchParams;
  return <RequestsView initialView={requestView(view)} />;
}
