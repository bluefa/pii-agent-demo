import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{ spec?: string }>;
}

export default async function ApiDocsHubPage({ searchParams }: PageProps) {
  const { spec } = await searchParams;
  redirect(spec ? `/integration/api-docs?spec=${encodeURIComponent(spec)}` : '/integration/api-docs');
}
