import Script from 'next/script';
import { notFound } from 'next/navigation';
import { resolveSwaggerSpecName } from '@/lib/swagger/specs';

interface PageProps {
  params: Promise<{ swaggerFileName: string }>;
}

const createRedocInitScript = (specUrl: string) => `(() => {
  const mount = () => {
    if (!window.Redoc) {
      window.setTimeout(mount, 50);
      return;
    }

    const container = document.getElementById('redoc-container');
    if (!container) return;

    window.Redoc.init(
      '${specUrl}',
      {
        hideDownloadButton: true,
        expandResponses: '200,201',
        theme: {
          colors: {
            primary: { main: '#2563eb' },
            text: { primary: '#111827', secondary: '#4b5563' },
            border: { dark: '#d1d5db', light: '#e5e7eb' },
            responses: {
              success: { color: '#16a34a' },
              error: { color: '#dc2626' }
            }
          },
          sidebar: {
            backgroundColor: '#f9fafb',
            textColor: '#111827'
          },
          rightPanel: {
            backgroundColor: '#ffffff'
          }
        }
      },
      container
    );
  };

  mount();
})();`;

export default async function ApiDocsSpecPage({ params }: PageProps) {
  const { swaggerFileName } = await params;
  const specName = resolveSwaggerSpecName(swaggerFileName);

  if (!specName) {
    notFound();
  }

  const specUrl = `/api/swagger-spec/${specName}`;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <style>{`
        html, body {
          background: #ffffff;
          color: #111827;
        }
      `}</style>
      <Script
        src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"
        strategy="beforeInteractive"
      />
      <Script
        id={`redoc-init-${specName}`}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: createRedocInitScript(specUrl) }}
      />
      <div id="redoc-container" className="min-h-screen" />
    </main>
  );
}
