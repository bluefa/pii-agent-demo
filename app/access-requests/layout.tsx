import { TopNav } from '@/app/components/layout/TopNav';
import { getMeOrNull } from '@/lib/bff/current-user';
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
 * 960 rather than 1440: the sidebar's width was never this screen's to take.
 *
 * It was 768, chosen when all three tabs were single-column card lists — a wider
 * column then only stretched each row's whitespace. 내 요청 내역 is now a
 * six-column table (owner instruction 2026-08-17): four fixed tracks (88 code,
 * 96 status, 124 timestamp, 68 action) plus five 12px gaps, and whatever is left
 * splits 1 : 1.6 between 서비스 이름 and 요청 사유. At 768 that leaves the two of
 * them 91 and 145 — service names cut at six characters and every reason wrapped
 * to three lines. 960 gives them 164 and 262 (measured in the browser at the
 * geometry that shipped: table on the card's own paper, code column 88). The
 * reason the older width was right expired with the card list it was measured
 * against.
 *
 * Before that it was 1000, and the list capped itself at 640 inside it — so the
 * page had three widths nested (1000 column, 828 card, 640 list) and ~290px of
 * the card was dead. One width is the screen's; the lists simply fill it.
 */
const CONTENT = 'mx-auto w-full max-w-[960px] px-8 pt-6 pb-12';

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
export default async function AccessRequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav user={await getMeOrNull()} />
      <main className={CONTENT}>
        <PlToastProvider>{children}</PlToastProvider>
      </main>
    </>
  );
}
