import 'server-only';
import type { BffClient } from '@/lib/bff/types';
import { mockBff } from '@/lib/bff/mock-adapter';
import { httpBff } from '@/lib/bff/http';
import { isMock } from '@/lib/env';

console.log('[BFF Client] USE_MOCK_DATA:', process.env.USE_MOCK_DATA, 'IS_MOCK:', isMock());

export const bff: BffClient = isMock() ? mockBff : httpBff;
