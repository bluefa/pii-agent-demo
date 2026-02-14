import Link from 'next/link';
import { SWAGGER_SPEC_NAMES, resolveSwaggerSpecName } from '@/lib/swagger/specs';

interface PageProps {
  searchParams: Promise<{ spec?: string }>;
}

export default async function ApiDocsHubPage({ searchParams }: PageProps) {
  const { spec } = await searchParams;
  const selectedSpec = resolveSwaggerSpecName(spec ?? '') ?? SWAGGER_SPEC_NAMES[0];

  return (
    <main className="min-h-screen p-4">
      <section className="grid min-h-[calc(100vh-2rem)] grid-cols-[220px_1fr] gap-4">
        <aside className="rounded border p-3">
          <p className="text-sm font-semibold">OpenAPI Specs</p>
          <div className="mt-3 flex flex-col gap-2">
            {SWAGGER_SPEC_NAMES.map((name) => (
              <Link
                key={name}
                href={`/api-docs?spec=${name}`}
                className={`rounded border px-3 py-2 text-sm ${selectedSpec === name ? 'font-semibold' : ''}`}
              >
                {name}.yaml
              </Link>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded border">
          <iframe
            title={`redoc-${selectedSpec}`}
            src={`/api-docs/${selectedSpec}`}
            className="h-[calc(100vh-2rem)] w-full border-0"
          />
        </section>
      </section>
    </main>
  );
}
