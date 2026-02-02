export type AzureResourceType =
  | 'AZURE_MSSQL'
  | 'AZURE_POSTGRESQL'
  | 'AZURE_MYSQL'
  | 'AZURE_MARIADB'
  | 'AZURE_COSMOS_NOSQL'
  | 'AZURE_SYNAPSE'
  | 'AZURE_VM';

interface AzureServiceIconProps {
  type: AzureResourceType;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

// Azure 공식 색상
const AZURE_BLUE = '#0078D4';
const AZURE_DARK = '#004E8C';
const AZURE_LIGHT = '#50E6FF';

export const AzureServiceIcon = ({ type, size = 'md' }: AzureServiceIconProps) => {
  const sizeClass = sizeMap[size];

  const icons: Record<AzureResourceType, React.ReactNode> = {
    AZURE_MSSQL: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill={AZURE_BLUE} />
        <path d="M20 8c-5.5 0-10 2-10 4.5v15c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5v-15c0-2.5-4.5-4.5-10-4.5z" fill={AZURE_LIGHT} fillOpacity="0.3" />
        <ellipse cx="20" cy="12.5" rx="10" ry="4.5" fill={AZURE_DARK} />
        <ellipse cx="20" cy="12.5" rx="7" ry="3" fill={AZURE_LIGHT} fillOpacity="0.5" />
        <path d="M10 20c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke={AZURE_DARK} strokeWidth="1.5" />
        <path d="M10 27c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke={AZURE_DARK} strokeWidth="1.5" />
        <text x="20" y="22" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">SQL</text>
      </svg>
    ),
    AZURE_POSTGRESQL: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#336791" />
        <path d="M20 8c-5.5 0-10 2-10 4.5v15c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5v-15c0-2.5-4.5-4.5-10-4.5z" fill="white" fillOpacity="0.2" />
        <ellipse cx="20" cy="12.5" rx="10" ry="4.5" fill="#1D4F6F" />
        <ellipse cx="20" cy="12.5" rx="7" ry="3" fill="white" fillOpacity="0.3" />
        <path d="M10 20c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke="#1D4F6F" strokeWidth="1.5" />
        <path d="M10 27c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke="#1D4F6F" strokeWidth="1.5" />
        <text x="20" y="22" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold">PG</text>
      </svg>
    ),
    AZURE_MYSQL: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#00758F" />
        <path d="M20 8c-5.5 0-10 2-10 4.5v15c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5v-15c0-2.5-4.5-4.5-10-4.5z" fill="#F29111" fillOpacity="0.3" />
        <ellipse cx="20" cy="12.5" rx="10" ry="4.5" fill="#00546B" />
        <ellipse cx="20" cy="12.5" rx="7" ry="3" fill="#F29111" fillOpacity="0.5" />
        <path d="M10 20c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke="#00546B" strokeWidth="1.5" />
        <path d="M10 27c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke="#00546B" strokeWidth="1.5" />
      </svg>
    ),
    AZURE_MARIADB: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#C0765A" />
        <path d="M20 8c-5.5 0-10 2-10 4.5v15c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5v-15c0-2.5-4.5-4.5-10-4.5z" fill="white" fillOpacity="0.2" />
        <ellipse cx="20" cy="12.5" rx="10" ry="4.5" fill="#8B4D3B" />
        <ellipse cx="20" cy="12.5" rx="7" ry="3" fill="white" fillOpacity="0.3" />
        <path d="M10 20c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke="#8B4D3B" strokeWidth="1.5" />
        <path d="M10 27c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke="#8B4D3B" strokeWidth="1.5" />
      </svg>
    ),
    AZURE_COSMOS_NOSQL: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill={AZURE_BLUE} />
        <circle cx="20" cy="20" r="10" fill={AZURE_DARK} />
        <ellipse cx="20" cy="20" rx="10" ry="4" fill="none" stroke={AZURE_LIGHT} strokeWidth="1.5" />
        <ellipse cx="20" cy="20" rx="10" ry="4" fill="none" stroke={AZURE_LIGHT} strokeWidth="1.5" transform="rotate(60 20 20)" />
        <ellipse cx="20" cy="20" rx="10" ry="4" fill="none" stroke={AZURE_LIGHT} strokeWidth="1.5" transform="rotate(120 20 20)" />
        <circle cx="20" cy="20" r="3" fill={AZURE_LIGHT} />
      </svg>
    ),
    AZURE_SYNAPSE: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#0078D4" />
        <path d="M8 20h24" stroke={AZURE_LIGHT} strokeWidth="2" />
        <path d="M20 8v24" stroke={AZURE_LIGHT} strokeWidth="2" />
        <circle cx="14" cy="14" r="4" fill={AZURE_DARK} stroke={AZURE_LIGHT} strokeWidth="1" />
        <circle cx="26" cy="14" r="4" fill={AZURE_DARK} stroke={AZURE_LIGHT} strokeWidth="1" />
        <circle cx="14" cy="26" r="4" fill={AZURE_DARK} stroke={AZURE_LIGHT} strokeWidth="1" />
        <circle cx="26" cy="26" r="4" fill={AZURE_DARK} stroke={AZURE_LIGHT} strokeWidth="1" />
        <circle cx="20" cy="20" r="5" fill={AZURE_LIGHT} />
      </svg>
    ),
    AZURE_VM: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill={AZURE_BLUE} />
        <rect x="8" y="10" width="24" height="16" rx="2" fill={AZURE_DARK} />
        <rect x="10" y="12" width="20" height="12" rx="1" fill={AZURE_LIGHT} fillOpacity="0.3" />
        <rect x="16" y="26" width="8" height="2" fill={AZURE_DARK} />
        <rect x="12" y="28" width="16" height="2" rx="1" fill={AZURE_DARK} />
        <circle cx="20" cy="18" r="4" fill="white" fillOpacity="0.8" />
        <path d="M18 18l1.5 1.5 3-3" stroke={AZURE_BLUE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return icons[type] || <DefaultAzureIcon size={size} />;
};

const DefaultAzureIcon = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClass = sizeMap[size];
  return (
    <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="4" fill={AZURE_BLUE} />
      <path d="M11.5 28h17L19.5 10l-3 6 4.5 8H11.5z" fill="white" />
    </svg>
  );
};

// Azure 공식 로고 (ProjectInfoCard용)
export const AzureLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 96 96" fill="currentColor">
    <path d="M34.36 59.89L52.68 15.38C53.05 14.49 53.92 13.91 54.88 13.91H67.43C69.26 13.91 70.47 15.78 69.71 17.44L47.02 67.02C46.19 68.83 44.01 69.62 42.2 68.79C41.53 68.48 40.98 67.99 40.6 67.38L34.36 59.89Z" />
    <path d="M18.23 63.29L40.62 33.29C41.12 32.62 41.89 32.22 42.71 32.22H55.94C57.31 32.22 58.42 33.33 58.42 34.7C58.42 35.09 58.33 35.47 58.16 35.82L37.75 82.09C37.38 82.98 36.51 83.56 35.55 83.56H22.22C20.39 83.56 19.18 81.69 19.94 80.03L18.23 63.29Z" />
  </svg>
);

export const isAzureResourceType = (type: string): type is AzureResourceType => {
  return type.startsWith('AZURE_');
};
