import { TopNav } from '@/app/components/layout/TopNav';

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
