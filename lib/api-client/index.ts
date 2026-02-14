import type { ApiClient } from '@/lib/api-client/types';
import { mockClient } from '@/lib/api-client/mock';
import { bffClient } from '@/lib/api-client/bff-client';

const IS_MOCK = process.env.USE_MOCK_DATA !== 'false';

export const client: ApiClient = IS_MOCK ? mockClient : bffClient;
