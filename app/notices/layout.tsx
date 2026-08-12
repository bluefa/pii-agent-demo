import { TopNav } from '@/app/components/layout/TopNav';

export default function NoticesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
