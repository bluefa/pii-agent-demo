import { TopNav } from '@/app/components/layout/TopNav';
import { PlToastProvider } from '@/app/admin/pipelines/_components/PlToastProvider';
import { pipelineStyles } from '@/lib/theme';

/**
 * 내 권한 요청 section shell.
 *
 * This screen sits OUTSIDE `/admin/**` on purpose. The admin gate
 * (app/admin/layout.tsx) is an ADMIN allowlist, and the people who need to ask
 * for a service permission are exactly the ones it turns away — under the admin
 * shell the screen would only ever be reachable by users who never need it.
 *
 * It borrows the admin section's toast root and content metrics rather than
 * inventing its own: the page is built from the same parts as the 접근 권한
 * screens, and `usePlToast` renders nothing at all without a provider above it.
 */
export default function AccessRequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className={pipelineStyles.layout.content}>
        <PlToastProvider>{children}</PlToastProvider>
      </main>
    </>
  );
}
