import { TopNav } from '@/app/components/layout/TopNav';
import { PlToastProvider } from '@/app/admin/pipelines/_components/PlToastProvider';

/**
 * Content metrics — deliberately NOT `pipelineStyles.layout.content`.
 *
 * That token reads `flex-1 min-w-0 max-w-[1440px] …` and assumes the admin
 * shell: inside `layout.shell` (a flex row) it sits to the right of the 216px
 * dark sidebar, and the sidebar is what pushes the 1440 block toward the
 * middle. Here the parent is `<body>`, which is not a flex container — so
 * `flex-1` does nothing, there is no `mx-auto`, and the block ends up pinned to
 * the left wall with the whole remainder of a wide monitor empty on the right.
 *
 * 1200 rather than 1440: the sidebar's width was never this screen's to take,
 * and this is two lists, not the row-scan tables the wider cap was raised for.
 */
const CONTENT = 'mx-auto w-full max-w-[1200px] px-8 pt-6 pb-12';

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
      <main className={CONTENT}>
        <PlToastProvider>{children}</PlToastProvider>
      </main>
    </>
  );
}
