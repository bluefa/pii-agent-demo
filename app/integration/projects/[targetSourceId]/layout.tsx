import { TopNav } from '@/app/components/layout/TopNav';
import { bgColors } from '@/lib/theme';

export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen ${bgColors.muted}`}>
      <TopNav />
      {children}
    </div>
  );
}
