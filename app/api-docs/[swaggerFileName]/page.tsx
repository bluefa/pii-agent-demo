import { notFound, redirect } from 'next/navigation';
import { resolveSwaggerSpecName } from '@/lib/swagger/specs';

interface PageProps {
  params: Promise<{ swaggerFileName: string }>;
}

export default async function ApiDocsSpecRedirectPage({ params }: PageProps) {
  const { swaggerFileName } = await params;
  const specName = resolveSwaggerSpecName(swaggerFileName);

  if (!specName) {
    notFound();
  }

  redirect(`/${specName}`);
}
