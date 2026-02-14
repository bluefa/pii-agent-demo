import type { NextResponse } from 'next/server';

export interface ApiClient {
  projects: {
    get: (projectId: string) => Promise<NextResponse>;
    delete: (projectId: string) => Promise<NextResponse>;
    approve: (projectId: string, body: unknown) => Promise<NextResponse>;
  };
  users: {
    search: (query: string, excludeIds: string[]) => Promise<NextResponse>;
  };
  sdu: {
    checkInstallation: (projectId: string) => Promise<NextResponse>;
  };
}
