import { bgColors } from '@/lib/theme';

export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  return <div className={`min-h-screen ${bgColors.muted}`}>{children}</div>;
}
