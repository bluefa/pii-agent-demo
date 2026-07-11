import { TopNav } from '@/app/components/layout/TopNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
