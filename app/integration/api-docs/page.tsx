import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{ spec?: string }>;
}

export default async function IntegrationApiDocsPage({ searchParams }: PageProps) {
  const { spec } = await searchParams;

  redirect(spec ? `/api-docs?spec=${encodeURIComponent(spec)}` : '/api-docs');
}
