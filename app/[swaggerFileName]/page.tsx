import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { resolveSwaggerSpecName } from '@/lib/swagger/specs';

interface PageProps {
  params: Promise<{ swaggerFileName: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { swaggerFileName } = await params;
  const specName = resolveSwaggerSpecName(swaggerFileName);

  if (!specName) {
    return { title: 'Swagger Preview Not Found' };
  }

  return {
    title: `Swagger Preview - ${specName}.yaml`,
  };
}

export default async function SwaggerPreviewPage({ params }: PageProps) {
  const { swaggerFileName } = await params;
  const specName = resolveSwaggerSpecName(swaggerFileName);

  if (!specName) {
    notFound();
  }
  redirect(`/integration/swagger/${specName}`);
}
