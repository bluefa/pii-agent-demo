import type { CloudProvider, ResourceType, AwsResourceType } from '@/lib/types';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';
import { AzureServiceIcon, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';
import { GcpServiceIcon, isGcpResourceType } from '@/app/components/ui/GcpServiceIcon';

interface ServiceIconProps {
  provider: CloudProvider;
  resourceType: ResourceType;
  size?: 'sm' | 'md' | 'lg';
}

export const ServiceIcon = ({ provider, resourceType, size = 'md' }: ServiceIconProps) => {
  if (provider === 'AWS') return <AwsServiceIcon type={resourceType as AwsResourceType} size={size} />;
  if (provider === 'Azure' && isAzureResourceType(resourceType)) return <AzureServiceIcon type={resourceType} size={size} />;
  if (provider === 'GCP' && isGcpResourceType(resourceType)) return <GcpServiceIcon type={resourceType} size={size} />;
  return null;
};
