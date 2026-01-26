import { AwsResourceType } from '../../../lib/types';

interface AwsServiceIconProps {
  type: AwsResourceType;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const AwsServiceIcon = ({ type, size = 'md' }: AwsServiceIconProps) => {
  const sizeClass = sizeMap[size];

  const icons: Record<AwsResourceType, React.ReactNode> = {
    RDS: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#3B48CC" />
        <path d="M20 8c-5.5 0-10 2-10 4.5v15c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5v-15c0-2.5-4.5-4.5-10-4.5z" fill="#5294CF" />
        <ellipse cx="20" cy="12.5" rx="10" ry="4.5" fill="#1A476F" />
        <ellipse cx="20" cy="12.5" rx="7" ry="3" fill="#2E73B8" />
        <path d="M10 20c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke="#1A476F" strokeWidth="1.5" />
        <path d="M10 27c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5" stroke="#1A476F" strokeWidth="1.5" />
      </svg>
    ),
    RDS_CLUSTER: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#3B48CC" />
        <path d="M20 6c-6 0-11 2.2-11 5v18c0 2.8 5 5 11 5s11-2.2 11-5V11c0-2.8-5-5-11-5z" fill="#5294CF" />
        <ellipse cx="20" cy="11" rx="11" ry="5" fill="#1A476F" />
        <ellipse cx="20" cy="11" rx="8" ry="3.5" fill="#2E73B8" />
        <path d="M9 18c0 2.8 5 5 11 5s11-2.2 11-5" stroke="#1A476F" strokeWidth="1.5" />
        <path d="M9 25c0 2.8 5 5 11 5s11-2.2 11-5" stroke="#1A476F" strokeWidth="1.5" />
        <circle cx="28" cy="28" r="6" fill="#FF9900" />
        <path d="M26 28h4M28 26v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    DYNAMODB: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#3B48CC" />
        <path d="M8 12l12-4 12 4v16l-12 4-12-4V12z" fill="#5294CF" />
        <path d="M8 12l12 4 12-4" stroke="#1A476F" strokeWidth="1.5" />
        <path d="M20 16v16" stroke="#1A476F" strokeWidth="1.5" />
        <path d="M8 20l12 4 12-4" stroke="#1A476F" strokeWidth="1" strokeDasharray="2 2" />
        <path d="M8 24l12 4 12-4" stroke="#1A476F" strokeWidth="1" strokeDasharray="2 2" />
        <ellipse cx="20" cy="12" rx="12" ry="4" fill="#2E73B8" />
      </svg>
    ),
    ATHENA: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#8C4FFF" />
        <path d="M20 8l10 6v12l-10 6-10-6V14l10-6z" fill="#B98AFF" />
        <path d="M20 8l10 6-10 6-10-6 10-6z" fill="#6B2FD9" />
        <path d="M20 20v12l10-6V14" fill="#9D5CFF" />
        <path d="M20 20v12l-10-6V14" fill="#B98AFF" />
        <circle cx="20" cy="18" r="4" fill="white" fillOpacity="0.9" />
        <path d="M18 18l1.5 1.5 3-3" stroke="#6B2FD9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    REDSHIFT: (
      <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#205B99" />
        <path d="M10 14h20v16H10V14z" fill="#5294CF" />
        <rect x="10" y="14" width="20" height="4" fill="#1A476F" />
        <rect x="10" y="22" width="20" height="4" fill="#1A476F" />
        <path d="M12 8h16l4 6H8l4-6z" fill="#2E73B8" />
        <rect x="14" y="16" width="4" height="2" rx="0.5" fill="white" fillOpacity="0.8" />
        <rect x="20" y="16" width="6" height="2" rx="0.5" fill="white" fillOpacity="0.5" />
        <rect x="14" y="24" width="6" height="2" rx="0.5" fill="white" fillOpacity="0.5" />
        <rect x="22" y="24" width="4" height="2" rx="0.5" fill="white" fillOpacity="0.8" />
      </svg>
    ),
  };

  return icons[type] || <DefaultDbIcon size={size} />;
};

const DefaultDbIcon = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClass = sizeMap[size];
  return (
    <svg className={sizeClass} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="4" fill="#6B7280" />
      <ellipse cx="20" cy="12" rx="10" ry="4" fill="#9CA3AF" />
      <path d="M10 12v16c0 2.2 4.5 4 10 4s10-1.8 10-4V12" fill="#4B5563" />
      <path d="M10 20c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#374151" strokeWidth="1.5" />
      <path d="M10 26c0 2.2 4.5 4 10 4s10-1.8 10-4" stroke="#374151" strokeWidth="1.5" />
    </svg>
  );
};
