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
  sm: 16,
  md: 20,
  lg: 24,
};

// Azure 공식 아이콘 파일 매핑 (Azure Architecture Icons)
// 출처: https://learn.microsoft.com/en-us/azure/architecture/icons/
const iconFileMap: Record<AzureResourceType, string> = {
  AZURE_MSSQL: '/icons/azure-sql.svg',
  AZURE_POSTGRESQL: '/icons/azure-postgresql.svg',
  AZURE_MYSQL: '/icons/azure-mysql.svg',
  AZURE_MARIADB: '/icons/azure-mariadb.svg',
  AZURE_COSMOS_NOSQL: '/icons/azure-cosmos.svg',
  AZURE_SYNAPSE: '/icons/azure-synapse.svg',
  AZURE_VM: '/icons/azure-vm.svg',
};

export const AzureServiceIcon = ({ type, size = 'md' }: AzureServiceIconProps) => {
  const iconSize = sizeMap[size];
  const iconFile = iconFileMap[type];

  if (!iconFile) {
    return <DefaultAzureIcon size={iconSize} />;
  }

  return (
    <img
      src={iconFile}
      alt={type}
      width={iconSize}
      height={iconSize}
      className="inline-block"
    />
  );
};

const DefaultAzureIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#0078D4">
    <path d="M22.379 23.343a1.62 1.62 0 0 0 1.536-2.14v.002L17.35 1.76A1.62 1.62 0 0 0 15.816.657H8.184A1.62 1.62 0 0 0 6.65 1.76L.086 21.204a1.62 1.62 0 0 0 1.536 2.139h4.741a1.62 1.62 0 0 0 1.535-1.103l.977-2.892 4.947 3.675c.28.208.618.32.966.32m-3.084-12.531 3.624 10.739a.54.54 0 0 1-.51.713v-.001h-.03a.54.54 0 0 1-.322-.106l-9.287-6.9h4.853m6.313 7.006c.116-.326.13-.694.007-1.058L9.79 1.76a1.722 1.722 0 0 0-.007-.02h6.034a.54.54 0 0 1 .512.366l6.562 19.445a.54.54 0 0 1-.338.684"/>
  </svg>
);

export const isAzureResourceType = (type: string): type is AzureResourceType => {
  return type.startsWith('AZURE_');
};
