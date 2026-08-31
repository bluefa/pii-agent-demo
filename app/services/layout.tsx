import { TopNav } from '@/app/components/layout/TopNav';
import { getMeOrNull } from '@/lib/bff/current-user';
import { consoleUrls } from '@/lib/env';

export default async function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav user={await getMeOrNull()} consoleUrls={consoleUrls()} />
      {children}
    </>
  );
}
