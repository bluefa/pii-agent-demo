import { Suspense } from 'react';
import { NewPostEditor } from '@/app/admin/pipelines/posts/new/_components/NewPostEditor';

// NewPostEditor reads `?type=` via useSearchParams, which must sit under a
// Suspense boundary in the App Router.
export default function NewPostPage() {
  return (
    <Suspense>
      <NewPostEditor />
    </Suspense>
  );
}
