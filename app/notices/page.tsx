import { Suspense } from 'react';
import { NoticeBoardView } from '@/app/notices/_components/NoticeBoardView';

// NoticeBoardView reads `?type=` via useSearchParams, which must sit under a
// Suspense boundary in the App Router.
export default function NoticesPage() {
  return (
    <Suspense>
      <NoticeBoardView />
    </Suspense>
  );
}
