import { TopNav } from '@/app/components/layout/TopNav';
import { getMeOrNull } from '@/lib/bff/current-user';

export default async function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav user={await getMeOrNull()} />
      {children}
    </>
  );
}
