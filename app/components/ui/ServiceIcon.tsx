import type { AwsResourceType, CloudProvider } from '@/lib/types';
import { normalizeAzureResourceType, normalizeResourceType } from '@/lib/types';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';
import { AzureServiceIcon, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';
import { GcpServiceIcon, isGcpResourceType } from '@/app/components/ui/GcpServiceIcon';

interface ServiceIconProps {
  provider: CloudProvider;
  resourceType: string;
  size?: 'sm' | 'md' | 'lg';
}

const isAwsResourceType = (type: string): type is AwsResourceType => (
  ['RDS', 'RDS_CLUSTER', 'DOCUMENTDB', 'DYNAMODB', 'ATHENA', 'REDSHIFT', 'EC2'] as const
).includes(type as AwsResourceType);

export const ServiceIcon = ({ provider, resourceType, size = 'md' }: ServiceIconProps) => {
  const normalizedResourceType = normalizeResourceType(resourceType) ?? resourceType;
  const normalizedAzureType = normalizeAzureResourceType(normalizedResourceType);

  if (provider === 'AWS' && isAwsResourceType(normalizedResourceType)) {
    return <AwsServiceIcon type={normalizedResourceType} size={size} />;
  }
  if ((provider === 'Azure' || normalizedAzureType) && normalizedAzureType && isAzureResourceType(normalizedAzureType)) {
    return <AzureServiceIcon type={normalizedAzureType} size={size} />;
  }
  if (provider === 'GCP' && isGcpResourceType(normalizedResourceType)) {
    return <GcpServiceIcon type={normalizedResourceType} size={size} />;
  }
  return null;
};
