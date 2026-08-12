import { TopNav } from '@/app/components/layout/TopNav';
import { LockIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import { bff } from '@/lib/bff/client';
import { isAdminRole } from '@/lib/roles';
import { cn, textColors } from '@/lib/theme';

/**
 * Admin-only gate for `/admin/**`. `role` is read from the same `/user/me` the
 * TopNav chip uses, but server-side — non-admin users never receive the admin
 * markup, and there is no flash of gated content.
 *
 * Allowlist: only ADMIN opens the section. `USER` is the contract's other
 * declared value, and a role added later must be opted in deliberately rather
 * than inheriting access from a `!== 'ADMIN'` test. Authorization itself still
 * belongs to the BFF (it 403s a non-admin) — this is only its UX surface.
 *
 * A verdict needs an answer, so the two failures are kept apart: a RESOLVED
 * non-admin role is a permission verdict, while a `/user/me` that never
 * resolved (BFF down, 401 per ADR-008) is an outage. Both stay closed, but
 * telling an admin mid-outage "you are not an admin" sends them to ask for
 * access they already have.
 */
// The gate is per-user, so the admin shell must never be prerendered: at build
// time `authHeaders()` has no request scope and would bake the notice in.
export const dynamic = 'force-dynamic';

/**
 * Whole-page notice. Not the shared EmptyState: that variant is sized for a
 * slot inside a page and is shared app-wide, so it cannot grow for this screen.
 * 64px = TopNav's sticky bar, which occupies flow. That number is not owned
 * here — see the list in app/components/layout/TopNav.tsx; every site holding
 * it has to move together.
 */
const FullPageNotice = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 text-center">
    {/* Decorative: the heading already carries the message, so the glyph stays
        aria-hidden (the icon default) and adds no label. */}
    {icon}
    <h1 className={cn('text-[24px] font-bold', textColors.secondary)}>{title}</h1>
    <p className={cn('mt-3 text-[20px]', textColors.tertiary)}>{description}</p>
  </div>
);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // `reachable` is the discriminator: `me` is null both when the call failed and
  // when the BFF legitimately answered with an empty body, and those two mean
  // opposite things to the person reading the screen.
  let me: Awaited<ReturnType<typeof bff.users.me>> | null = null;
  let reachable = true;
  try {
    me = await bff.users.me();
  } catch {
    reachable = false;
  }

  if (!reachable) {
    return (
      <>
        <TopNav />
        <FullPageNotice
          icon={<StatusWarningIcon className={cn('mb-4 h-12 w-12', textColors.tertiary)} />}
          title="권한을 확인하지 못했어요"
          description="일시적인 오류예요. 잠시 후 새로고침해 주세요. 계속되면 담당자에게 알려주세요."
        />
      </>
    );
  }

  // Shared with UserChip, which hides/shows the 관리자 entry — one rule, so the
  // menu can never offer a destination this gate denies.
  const isAdmin = isAdminRole(me?.role);

  return (
    <>
      <TopNav />
      {isAdmin ? (
        children
      ) : (
        <FullPageNotice
          icon={<LockIcon className={cn('mb-4 h-12 w-12', textColors.tertiary)} />}
          title="관리자만 접근할 수 있어요"
          description="이 페이지는 관리자 권한이 필요해요. 접근이 필요하면 관리자에게 문의해 주세요."
        />
      )}
    </>
  );
}
