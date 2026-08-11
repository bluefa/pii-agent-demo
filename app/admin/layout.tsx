import { TopNav } from '@/app/components/layout/TopNav';
import { EmptyState } from '@/app/components/ui/state/EmptyState';
import { bff } from '@/lib/bff/client';

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
  const isAdmin = me?.role?.trim().toUpperCase() === 'ADMIN';

  return (
    <>
      <TopNav />
      {isAdmin ? (
        children
      ) : (
        <EmptyState
          title="관리자만 접근할 수 있어요"
          description="이 페이지는 관리자 권한이 필요해요. 접근이 필요하면 관리자에게 문의해 주세요."
        />
      )}
    </>
  );
}
