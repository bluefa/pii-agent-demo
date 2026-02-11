import type { GcpResourceType } from '@/lib/types';

interface GcpServiceIconProps {
  type: GcpResourceType;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const colorMap: Record<GcpResourceType, string> = {
  CLOUD_SQL: '#4285F4',
  BIGQUERY: '#669DF6',
};

const CloudSqlIcon = ({ className, color }: { className?: string; color: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 2c4.42 0 8 1.57 8 3.5S16.42 11 12 11 4 9.43 4 7.5 7.58 4 12 4zM4 17.5v-3.07c1.52 1.26 4.46 2.07 8 2.07s6.48-.81 8-2.07v3.07c0 1.93-3.58 3.5-8 3.5s-8-1.57-8-3.5zm16-5c0 1.93-3.58 3.5-8 3.5s-8-1.57-8-3.5v-3.07C5.52 10.69 8.46 11.5 12 11.5s6.48-.81 8-2.07v3.07z"/>
  </svg>
);

const BigQueryIcon = ({ className, color }: { className?: string; color: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill={color}>
    <path d="M6.32 9.9a5.69 5.69 0 1 0 7.78 7.78l3.25 3.25a.75.75 0 0 0 1.06-1.06L15.16 16.62A5.69 5.69 0 0 0 6.32 9.9zm6.72 6.72a4.19 4.19 0 1 1 0-5.93 4.19 4.19 0 0 1 0 5.93zM10.19 11.5v3.19l2.26 1.36.53-.85-1.73-1.04v-2.66h-1.06z"/>
  </svg>
);

export const GcpServiceIcon = ({ type, size = 'md' }: GcpServiceIconProps) => {
  const sizeClass = sizeMap[size];
  const color = colorMap[type] || '#6B7280';

  const icons: Record<GcpResourceType, React.ReactNode> = {
    CLOUD_SQL: <CloudSqlIcon className={sizeClass} color={color} />,
    BIGQUERY: <BigQueryIcon className={sizeClass} color={color} />,
  };

  return icons[type] || <DefaultGcpIcon className={sizeClass} />;
};

const DefaultGcpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#4285F4">
    <ellipse cx="12" cy="5" rx="8" ry="3"/>
    <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/>
  </svg>
);

export const isGcpResourceType = (type: string): type is GcpResourceType =>
  type === 'CLOUD_SQL' || type === 'BIGQUERY';
