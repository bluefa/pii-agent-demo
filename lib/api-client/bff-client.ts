import { NextResponse } from 'next/server';
import type { ApiClient } from '@/lib/api-client/types';

const BFF_URL = process.env.BFF_API_URL;

const proxyGet = async (path: string): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${path}`);
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyPost = async (path: string, body: unknown): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyDelete = async (path: string): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${path}`, { method: 'DELETE' });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

export const bffClient: ApiClient = {
  projects: {
    get: (projectId) => proxyGet(`/projects/${projectId}`),
    delete: (projectId) => proxyDelete(`/projects/${projectId}`),
    approve: (projectId, body) => proxyPost(`/projects/${projectId}/approve`, body),
  },
  users: {
    search: (query, excludeIds) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','));
      const qs = params.toString();
      return proxyGet(`/users/search${qs ? `?${qs}` : ''}`);
    },
  },
  sdu: {
    checkInstallation: (projectId) => proxyPost(`/sdu/projects/${projectId}/check-installation`, {}),
  },
};
