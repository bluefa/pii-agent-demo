import type {
  AzureSettingsStatus,
  AzureServiceSettings,
  AzureTargetSourceSettings,
} from '@/lib/types/azure';

export interface AzureSettingsResponse {
  tenant_id?: string;
  subscription_id?: string;
  scan_app: {
    app_id: string;
    status: AzureSettingsStatus;
    last_verified_at?: string;
  };
}

interface LegacyAzureScanAppPayload {
  registered?: boolean;
  app_id?: string;
  appId?: string;
  status?: AzureSettingsStatus | 'NOT_VERIFIED';
  last_verified_at?: string;
  lastVerifiedAt?: string;
}

interface LegacyAzureSettingsPayload {
  tenant_id?: string;
  tenantId?: string;
  subscription_id?: string;
  subscriptionId?: string;
  scan_app?: LegacyAzureScanAppPayload;
  scanApp?: LegacyAzureScanAppPayload;
}

export type AzureSettingsResponsePayload =
  | AzureSettingsResponse
  | AzureServiceSettings
  | AzureTargetSourceSettings
  | LegacyAzureSettingsPayload;

interface AzureIdentifierFallback {
  tenantId?: string;
  subscriptionId?: string;
}

type ScanAppPayload =
  | AzureServiceSettings['scanApp']
  | AzureSettingsResponse['scan_app']
  | LegacyAzureScanAppPayload;

const normalizeStatus = (
  status?: AzureSettingsStatus | 'NOT_VERIFIED',
): AzureSettingsStatus => {
  if (status === 'NOT_VERIFIED' || !status) return 'UNVERIFIED';
  return status;
};

export const extractAzureSettings = (
  payload: AzureSettingsResponsePayload,
  fallback?: AzureIdentifierFallback,
): AzureSettingsResponse => {
  const scanApp: ScanAppPayload | undefined = 'scan_app' in payload ? payload.scan_app : payload.scanApp;
  const appId = scanApp
    ? ('app_id' in scanApp ? scanApp.app_id ?? '' : scanApp.appId ?? '')
    : '';
  const registered = scanApp && 'registered' in scanApp
    ? (scanApp.registered ?? appId.length > 0)
    : appId.length > 0;
  const lastVerifiedAt = scanApp
    ? ('last_verified_at' in scanApp
      ? scanApp.last_verified_at
      : ('lastVerifiedAt' in scanApp ? scanApp.lastVerifiedAt : undefined))
    : undefined;
  const tenantId = ('tenant_id' in payload ? payload.tenant_id : ('tenantId' in payload ? payload.tenantId : undefined))
    ?? fallback?.tenantId;
  const subscriptionId = ('subscription_id' in payload ? payload.subscription_id : ('subscriptionId' in payload ? payload.subscriptionId : undefined))
    ?? fallback?.subscriptionId;

  return {
    ...(tenantId && { tenant_id: tenantId }),
    ...(subscriptionId && { subscription_id: subscriptionId }),
    scan_app: {
      app_id: registered ? appId : '',
      status: registered ? normalizeStatus(scanApp?.status) : 'UNVERIFIED',
      ...(lastVerifiedAt && { last_verified_at: lastVerifiedAt }),
    },
  };
};
