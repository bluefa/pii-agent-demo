import { TopNav } from '@/app/components/layout/TopNav';
import { getMeOrNull } from '@/lib/bff/current-user';
import { cn } from '@/lib/theme';

export default async function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('min-h-screen', 'bg-[#F4F4FB]')}>
      <TopNav user={await getMeOrNull()} />
      {children}
    </div>
  );
}
