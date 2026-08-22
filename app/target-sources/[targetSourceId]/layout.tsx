import { TopNav } from '@/app/components/layout/TopNav';
import { getMeOrNull } from '@/lib/bff/current-user';
import { cn } from '@/lib/theme';

export default async function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  // Same v16 lavender as before, spelled as the token it was promoted to
  // (--pl-bg-canvas) — the literal tripped the raw-hex policy gate.
  return (
    <div className={cn('min-h-screen', 'bg-[var(--pl-bg-canvas)]')}>
      <TopNav user={await getMeOrNull()} />
      {children}
    </div>
  );
}
