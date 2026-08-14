import { CloudProvider } from '@/lib/types';
import { cn } from '@/lib/theme';

interface CloudProviderIconProps {
  provider: CloudProvider;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  variant?: 'icon' | 'badge';
}

const sizeMap = {
  sm: { icon: 'w-4 h-4', badge: 'px-2 py-0.5 text-xs', container: 'w-8 h-8' },
  md: { icon: 'w-5 h-5', badge: 'px-2.5 py-1 text-sm', container: 'w-10 h-10' },
  lg: { icon: 'w-7 h-7', badge: 'px-3 py-1.5 text-sm', container: 'w-12 h-12' },
};

const providerConfig: Record<CloudProvider, { bg: string; text: string; label: string }> = {
  AWS: { bg: 'bg-[#FF9900]/10', text: 'text-[#FF9900]', label: 'AWS' }, // design-exempt: brand logotype (WCAG 1.4.11)
  Azure: { bg: 'bg-[#0078D4]/10', text: 'text-[#0078D4]', label: 'Azure' },
  GCP: { bg: 'bg-[#4285F4]/10', text: 'text-[#4285F4]', label: 'GCP' }, // design-exempt: brand logotype (WCAG 1.4.11)
  IDC: { bg: 'bg-[#374151]/10', text: 'text-[#374151]', label: 'IDC' },
};

// Simple Icons - Amazon AWS (https://simpleicons.org/)
const AwsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z"/>
  </svg>
);

// Simple Icons - Microsoft Azure (https://simpleicons.org/)
const AzureIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.379 23.343a1.62 1.62 0 0 0 1.536-2.14v.002L17.35 1.76A1.62 1.62 0 0 0 15.816.657H8.184A1.62 1.62 0 0 0 6.65 1.76L.086 21.204a1.62 1.62 0 0 0 1.536 2.139h4.741a1.62 1.62 0 0 0 1.535-1.103l.977-2.892 4.947 3.675c.28.208.618.32.966.32m-3.084-12.531 3.624 10.739a.54.54 0 0 1-.51.713v-.001h-.03a.54.54 0 0 1-.322-.106l-9.287-6.9h4.853m6.313 7.006c.116-.326.13-.694.007-1.058L9.79 1.76a1.722 1.722 0 0 0-.007-.02h6.034a.54.54 0 0 1 .512.366l6.562 19.445a.54.54 0 0 1-.338.684"/>
  </svg>
);

// Simple Icons - Google Cloud (https://simpleicons.org/)
const GcpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-2.821-4.552l-.043.043.006-.05A9.344 9.344 0 0 0 12.19 2.38zm-.358 4.146c1.244-.04 2.518.368 3.486 1.15a5.186 5.186 0 0 1 1.862 4.078v.518c3.53-.07 3.53 5.262 0 5.193h-5.193l-.008.009v-.04H6.785a2.59 2.59 0 0 1-1.067-.23h.001a2.597 2.597 0 1 1 3.437-3.437l3.013-3.012A6.747 6.747 0 0 0 8.11 8.24c.018-.01.04-.026.054-.023a5.186 5.186 0 0 1 3.67-1.69z"/>
  </svg>
);

// IDC default icon — server-rack glyph (no brand). Used when CloudProvider=IDC.
const IdcIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
    <line x1="7" y1="17" x2="7.01" y2="17" />
  </svg>
);

// SDU — data the service owner uploads, so an upload glyph. It must not be the IDC
// rack: SDU used to reuse it, which left the two indistinguishable everywhere the
// mark is the provider's only identification.
const SduIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    <path d="M12 4.5V14" />
    <path d="M8.2 8.3 12 4.5l3.8 3.8" />
  </svg>
);

/*
 * ── Brand-coloured marks (opt-in via `tone="brand"`) ────────────────────────
 *
 * The vendors' own logos in the vendors' own hexes. Those hexes are not app tokens
 * on purpose: orange is what makes AWS read as AWS. A logotype is exempt from the
 * contrast floor under WCAG 1.4.11, so there is nothing here for design-guard to
 * measure — everything that is not a logo still owes its colour to a token.
 *
 * AWS reuses the geometry already in this file, split at its one absolute subpath
 * break into the two things it is: the wordmark and the smile. Azure and Google
 * Cloud need real multi-path geometry, so they carry their own.
 *
 * The viewBox on each is padding, not framing: the three marks have three aspect
 * ratios, so a shared square slot would render them at three optical sizes. Azure's
 * box is grown until its art is the same height as the Google cloud's. The AWS
 * logotype stays full-slot-width — it is wider than tall by nature, and matching its
 * height to the symbols would push it past the slot.
 *
 * Azure ships as gradients; they are flattened to their midpoints. At the sizes
 * this renders a gradient is invisible, and an inline <linearGradient> needs a
 * document-unique id — which one mark repeated down twelve rows cannot have.
 */

// design-exempt: brand logotype colours (WCAG 1.4.11).
const AwsBrandIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      fill="#252F3E"
      d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z"
    />
    <path
      fill="#FF9900"
      d="M21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z"
    />
  </svg>
);

// design-exempt: brand logotype colours (WCAG 1.4.11).
const AzureBrandIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="-23 -30 301 301" fill="none">
    <path
      fill="#0C5AA4"
      d="M85.3,0 L161.1,0 L82.5,233 C80.8,237.9 76.2,241.2 71,241.2 L12.1,241.2 C8.2,241.2 4.5,239.3 2.3,236.2 C0,233 -0.6,229 0.6,225.3 L73.9,8.2 C75.6,3.3 80.2,0 85.3,0 Z"
    />
    <path
      fill="#0078D4"
      d="M195.4,156.3 L75.3,156.3 C73,156.3 71,157.7 70.1,159.8 C69.3,161.9 69.8,164.4 71.5,165.9 L148.7,238 C150.9,240.1 153.9,241.2 157,241.2 L225,241.2 L195.4,156.3 Z"
    />
    <path
      fill="#32AFEA"
      d="M182.1,8.2 C180.4,3.3 175.8,0 170.7,0 L86.2,0 C91.4,0 96,3.3 97.7,8.2 L170.9,225.3 C172.2,229 171.6,233 169.3,236.2 C167,239.3 163.4,241.2 159.5,241.2 L243.9,241.2 C247.8,241.2 251.5,239.3 253.7,236.2 C256,233 256.6,229 255.4,225.3 L182.1,8.2 Z"
    />
  </svg>
);

// design-exempt: brand logotype colours (WCAG 1.4.11).
const GcpBrandIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 -25 256 256" fill="none">
    <path
      fill="#EA4335"
      d="M170.3,56.8 L192.5,34.6 L194,25.2 C153.4,-11.7 89,-7.5 52.4,33.9 C42.3,45.4 34.7,59.8 30.7,74.6 L38.7,73.4 L83.2,66.1 L86.6,62.6 C106.4,40.9 139.9,37.9 162.8,56.4 L170.3,56.8 Z"
    />
    <path
      fill="#4285F4"
      d="M224.2,73.9 C219.1,55.1 208.6,38.1 194,25.2 L162.8,56.4 C175.9,67.2 183.5,83.4 183.1,100.5 L183.1,106 C198.5,106 210.9,118.5 210.9,133.8 C210.9,149.2 198.5,161.3 183.1,161.3 L127.5,161.3 L122,167.2 L122,200.6 L127.5,205.8 L183.1,205.8 C223.1,206.1 255.7,174.3 256,134.4 C256.2,110.2 244.3,87.5 224.2,73.9 Z"
    />
    <path
      fill="#34A853"
      d="M71.9,205.8 L127.5,205.8 L127.5,161.3 L71.9,161.3 C67.9,161.3 64.1,160.4 60.5,158.8 L52.6,161.2 L30.2,183.5 L28.2,191 C40.8,200.5 56.1,205.9 71.9,205.8 Z"
    />
    <path
      fill="#FBBC05"
      d="M71.9,61.4 C31.9,61.7 -0.2,94.2 0,134.2 C0.1,156.5 10.5,177.4 28.2,191 L60.5,158.8 C46.5,152.5 40.3,136 46.6,122 C52.9,108 69.4,101.8 83.4,108.1 C89.5,110.9 94.5,115.9 97.2,122 L129.5,89.8 C115.8,71.8 94.5,61.3 71.9,61.4 Z"
    />
  </svg>
);

const IconMap: Record<CloudProvider, React.FC<{ className?: string }>> = {
  AWS: AwsIcon,
  Azure: AzureIcon,
  GCP: GcpIcon,
  IDC: IdcIcon,
};

/** Lowercased wire value → glyph. Admin passes raw wire strings ('AZURE', 'UNKNOWN'). */
const GLYPH_BY_KEY: Record<string, React.FC<{ className?: string }>> = {
  aws: AwsIcon,
  azure: AzureIcon,
  gcp: GcpIcon,
  idc: IdcIcon,
  sdu: SduIcon,
};

/** Only the three public clouds have a brand. IDC and SDU have none — see BRAND_BY_KEY use. */
const BRAND_BY_KEY: Record<string, React.FC<{ className?: string }>> = {
  aws: AwsBrandIcon,
  azure: AzureBrandIcon,
  gcp: GcpBrandIcon,
};

export { AwsIcon, AzureIcon, GcpIcon, IdcIcon, SduIcon };

interface ProviderGlyphProps {
  /** Wire or display value, any casing. */
  provider: CloudProvider | string | null | undefined;
  /** An SDU target reads as SDU over its underlying CSP. */
  isSdu?: boolean;
  /**
   * `brand` swaps AWS/Azure/GCP for the vendor's own colours. IDC and SDU are ours,
   * have no brand, and stay on `currentColor` under either tone.
   */
  tone?: 'mono' | 'brand';
  className?: string;
}

/**
 * The provider mark on its own — no tile, no label. This is the shared source for
 * every place the provider is shown as a shape rather than a colour swatch: a
 * coloured square carries no more information than the glyph, and a glyph survives
 * being printed, greyed, or read at a glance.
 *
 * `currentColor` stays the default so the surrounding screen keeps owning the hue.
 * A screen that has spent its colour budget elsewhere opts into `tone="brand"` —
 * the marks are then recognition, not status, and cost no status colour.
 *
 * Returns null for values with no mark (UNKNOWN, empty) so callers render no gap.
 */
export const ProviderGlyph = ({ provider, isSdu, tone = 'mono', className }: ProviderGlyphProps) => {
  const key = isSdu ? 'sdu' : (provider ?? '').toLowerCase();
  const Icon = (tone === 'brand' ? BRAND_BY_KEY[key] : undefined) ?? GLYPH_BY_KEY[key];
  return Icon ? <Icon className={className} /> : null;
};

export const CloudProviderIcon = ({
  provider,
  size = 'md',
  showLabel = true,
  variant = 'badge',
}: CloudProviderIconProps) => {
  const config = providerConfig[provider];
  const sizes = sizeMap[size];
  const Icon = IconMap[provider];

  if (variant === 'icon') {
    return (
      <div className={cn(sizes.container, config.bg, 'rounded-lg flex items-center justify-center')}>
        <Icon className={cn(sizes.icon, config.text)} />
      </div>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', sizes.badge, 'rounded-lg', config.bg, config.text, 'font-medium')}>
      <Icon className={sizes.icon} />
      {showLabel && config.label}
    </span>
  );
};
