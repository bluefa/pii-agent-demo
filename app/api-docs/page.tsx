import Link from 'next/link';
import { SWAGGER_SPEC_NAMES, resolveSwaggerSpecName } from '@/lib/swagger/specs';
import { cn, textColors } from '@/lib/theme';

interface PageProps {
  searchParams: Promise<{ spec?: string }>;
}

export default async function IntegrationApiDocsPage({ searchParams }: PageProps) {
  const { spec } = await searchParams;
  const selectedSpec = resolveSwaggerSpecName(spec ?? '') ?? SWAGGER_SPEC_NAMES[0];

  return (
    <main className={cn('min-h-screen bg-white p-4', textColors.primary)}>
      <section className="grid min-h-[calc(100vh-2rem)] grid-cols-[220px_1fr] gap-4">
        <aside className="rounded border bg-white p-3">
          <p className="text-sm font-semibold">OpenAPI Specs</p>
          <div className="mt-3 flex flex-col gap-2">
            {SWAGGER_SPEC_NAMES.map((name) => (
              <Link
                key={name}
                // basePath-aware: next/link prepends `/pass`.
                href={`/api-docs?spec=${name}`}
                className={cn('rounded border bg-white px-3 py-2 text-sm', textColors.primary, selectedSpec === name && 'font-semibold')}
              >
                {name}.yaml
              </Link>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded border bg-white">
          <iframe
            title={`swagger-${selectedSpec}`}
            src={`/pass/swagger/${selectedSpec}`}
            className="h-[calc(100vh-2rem)] w-full border-0"
          />
        </section>
      </section>
    </main>
  );
}
