import { TopNav } from '@/app/components/layout/TopNav';
import { cn } from '@/lib/theme';

export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('min-h-screen', 'bg-[#F4F4FB]')}>
      <TopNav />
      {children}
    </div>
  );
}
