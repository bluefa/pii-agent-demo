import 'server-only';
import type { BffClient } from '@/lib/bff/types';
import { mockBff } from '@/lib/bff/mock-adapter';
import { httpBff } from '@/lib/bff/http';

const IS_MOCK = process.env.USE_MOCK_DATA === 'true';
console.log('[BFF Client] USE_MOCK_DATA:', process.env.USE_MOCK_DATA, 'IS_MOCK:', IS_MOCK);

export const bff: BffClient = IS_MOCK ? mockBff : httpBff;
