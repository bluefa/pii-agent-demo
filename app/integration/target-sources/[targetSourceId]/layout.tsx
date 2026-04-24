import { TopNav } from '@/app/components/layout/TopNav';
import { bgColors, cn } from '@/lib/theme';

export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('min-h-screen', bgColors.muted)}>
      <TopNav />
      {children}
    </div>
  );
}
