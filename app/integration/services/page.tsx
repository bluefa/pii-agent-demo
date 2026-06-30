import { Suspense } from 'react';
import { ServiceManagementView } from '@/app/integration/services/_components/ServiceManagementView';

// ServiceManagementView reads `?service_code=` via useSearchParams, which must
// sit under a Suspense boundary in the App Router.
export default function ServicesPage() {
  return (
    <Suspense>
      <ServiceManagementView />
    </Suspense>
  );
}
