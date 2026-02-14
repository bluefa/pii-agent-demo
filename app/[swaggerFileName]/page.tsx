import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { resolveSwaggerSpecName } from '@/lib/swagger/specs';

interface PageProps {
  params: Promise<{ swaggerFileName: string }>;
}

const SWAGGER_CUSTOM_CSS = `
.swagger-ui {
  background: #ffffff;
  color: #111827;
}

.swagger-ui .scheme-container {
  background: #ffffff;
  box-shadow: none;
}

.swagger-ui .opblock-tag {
  color: #111827;
}

.swagger-ui .model-box,
.swagger-ui .highlight-code,
.swagger-ui .microlight,
.swagger-ui .highlight-code pre,
.swagger-ui pre.microlight,
.swagger-ui .highlight-code .hljs {
  background: #000000 !important;
  color: #f8fafc !important;
}
`;

const createSwaggerInitScript = (specUrl: string, customCss: string) => `(() => {
  const mount = () => {
    if (!window.SwaggerUIBundle || !window.SwaggerUIStandalonePreset) return;
    window.SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      docExpansion: 'full',
      showExtensions: true,
      showCommonExtensions: true,
      displayRequestDuration: true,
      customCss: ${JSON.stringify(customCss)},
      presets: [
        window.SwaggerUIBundle.presets.apis,
        window.SwaggerUIStandalonePreset
      ],
      layout: 'BaseLayout'
    });
  };

  if (document.readyState === 'complete') {
    mount();
    return;
  }

  window.addEventListener('load', mount, { once: true });
})();`;

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

  const specUrl = `/api/swagger-spec/${specName}`;

  return (
    <main className="min-h-screen bg-white">
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
      />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="beforeInteractive"
      />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"
        strategy="beforeInteractive"
      />
      <Script
        id={`swagger-ui-init-${specName}`}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: createSwaggerInitScript(specUrl, SWAGGER_CUSTOM_CSS) }}
      />

      <div id="swagger-ui" className="min-h-screen" />
    </main>
  );
}
