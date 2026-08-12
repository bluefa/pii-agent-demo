import { TopNav } from '@/app/components/layout/TopNav';
import { LockIcon } from '@/app/components/ui/icons';
import { bff } from '@/lib/bff/client';
import { cn, textColors } from '@/lib/theme';

/**
 * Admin-only gate for `/admin/**`. `role` is read from the same `/user/me` the
 * TopNav chip uses, but server-side — non-admin users never receive the admin
 * markup, and there is no flash of gated content.
 *
 * ADMIN is the only settled value of `UserMeResponse.role`, so the check is an
 * allowlist: every other role, a missing/blank field, or an unreachable BFF
 * falls through to the notice. Authorization itself still belongs to the BFF
 * (it 403s a non-admin) — this is only its UX surface.
 */
// The gate is per-user, so the admin shell must never be prerendered: at build
// time `authHeaders()` has no request scope and would bake the notice in.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await bff.users.me().catch(() => null);
  // `users.me()` is a raw upstream passthrough — nothing parses it at this
  // layer, so `role` can arrive as a non-string JSON value despite the
  // generated type. Coerce before comparing: a malformed payload must land on
  // the notice, never on a 500.
  const isAdmin = String(me?.role ?? '').trim().toUpperCase() === 'ADMIN';

  return (
    <>
      <TopNav />
      {isAdmin ? (
        children
      ) : (
        // Not the shared EmptyState: this is a whole-page denial, so it centres
        // on the viewport (76px = TopNav's sticky bar, which occupies flow) and carries its own
        // larger type. EmptyState's block variant is sized for a slot inside a
        // page and is shared app-wide — it cannot grow for this one screen.
        <div className="flex min-h-[calc(100vh-76px)] flex-col items-center justify-center px-6 text-center">
          {/* Decorative: the heading already carries the message, so the glyph
              stays aria-hidden (LockIcon's default) and adds no label. */}
          <LockIcon className={cn('mb-4 h-12 w-12', textColors.tertiary)} />
          <h1 className={cn('text-[24px] font-bold', textColors.secondary)}>
            관리자만 접근할 수 있어요
          </h1>
          <p className={cn('mt-3 text-[20px]', textColors.tertiary)}>
            이 페이지는 관리자 권한이 필요해요. 접근이 필요하면 관리자에게 문의해 주세요.
          </p>
        </div>
      )}
    </>
  );
}
