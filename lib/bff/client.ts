import 'server-only';
import type { BffClient } from '@/lib/bff/types';
import { mockBff } from '@/lib/bff/mock-adapter';
import { httpBff } from '@/lib/bff/http';

const IS_MOCK = process.env.USE_MOCK_DATA !== 'false';

export const bff: BffClient = IS_MOCK ? mockBff : httpBff;
