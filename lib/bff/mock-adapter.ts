/**
 * Wraps the in-memory `lib/api-client/mock/*` handlers as `BffClient`.
 *
 * Mock business logic (auth, state transitions, validation) is reused
 * verbatim. The adapter only converts NextResponse → typed data, throwing
 * `BffError` on non-2xx so `withV1` can map it to ProblemDetails.
 *
 * Per ADR-011 §"Cross-cutting decisions" #3, mock-only `authorize()`
 * checks are preserved by default — tests asserting 401/403 from mocks
 * continue to pass via the BffError → ProblemDetails path.
 */
import type { NextResponse } from 'next/server';
import type { BffClient } from '@/lib/bff/types';
import type { LegacyErrorBody } from '@/lib/bff/errors';
import { BffError, extractLegacyError } from '@/lib/bff/errors';
import { mockTargetSources } from '@/lib/api-client/mock/target-sources';
import { mockProjects } from '@/lib/api-client/mock/projects';
import { mockUsers } from '@/lib/api-client/mock/users';
import { mockServices } from '@/lib/api-client/mock/services';
import { mockDashboard } from '@/lib/api-client/mock/dashboard';
import { mockDev } from '@/lib/api-client/mock/dev';
import { mockScan } from '@/lib/api-client/mock/scan';
import { mockQueueBoard } from '@/lib/api-client/mock/queue-board';

async function unwrap<T>(response: NextResponse): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch((): LegacyErrorBody => ({}));
    const { code, message } = extractLegacyError(body);
    throw new BffError(
      response.status,
      code || 'INTERNAL_ERROR',
      message || `HTTP ${response.status}`,
    );
  }
  return await response.json() as T;
}

export const mockBff: BffClient = {
  targetSources: {
    get: async (id) => unwrap(await mockTargetSources.get(String(id))),
    list: async (serviceCode) => unwrap(await mockTargetSources.list(serviceCode)),
    create: async (body) => unwrap(await mockTargetSources.create(body)),
  },

  projects: {
    get: async (id) => unwrap(await mockProjects.get(String(id))),
    delete: async (id) => unwrap(await mockProjects.delete(String(id))),
    create: async (body) => unwrap(await mockProjects.create(body)),
    approve: async (id, body) => unwrap(await mockProjects.approve(String(id), body)),
    reject: async (id, body) => unwrap(await mockProjects.reject(String(id), body)),
    confirmTargets: async (id, body) => unwrap(await mockProjects.confirmTargets(String(id), body)),
    completeInstallation: async (id) => unwrap(await mockProjects.completeInstallation(String(id))),
    confirmCompletion: async (id) => unwrap(await mockProjects.confirmCompletion(String(id))),
    credentials: async (id) => unwrap(await mockProjects.credentials(String(id))),
    history: async (id, query) => unwrap(await mockProjects.history(String(id), {
      type: query.type ?? '',
      limit: query.limit ?? '',
      offset: query.offset ?? '',
    })),
    resourceCredential: async (id, body) => unwrap(await mockProjects.resourceCredential(String(id), body)),
    resourceExclusions: async (id) => unwrap(await mockProjects.resourceExclusions(String(id))),
    resources: async (id) => unwrap(await mockProjects.resources(String(id))),
    scan: async (id) => unwrap(await mockProjects.scan(String(id))),
    terraformStatus: async (id) => unwrap(await mockProjects.terraformStatus(String(id))),
    testConnection: async (id, body) => unwrap(await mockProjects.testConnection(String(id), body)),
  },

  users: {
    search: async (query, excludeIds) => unwrap(await mockUsers.search(query, excludeIds)),
    me: async () => unwrap(await mockUsers.getMe()),
    getServices: async () => unwrap(await mockUsers.getServices()),
    getServicesPage: async (page, size, query) => unwrap(await mockUsers.getServicesPage(page, size, query)),
  },

  services: {
    permissions: {
      list: async (serviceCode) => unwrap(await mockServices.permissions.list(serviceCode)),
      add: async (serviceCode, body) => unwrap(await mockServices.permissions.add(serviceCode, body)),
      remove: async (serviceCode, userId) => unwrap(await mockServices.permissions.remove(serviceCode, userId)),
    },
    settings: {
      aws: {
        get: async (serviceCode) => unwrap(await mockServices.settings.aws.get(serviceCode)),
        update: async (serviceCode, body) => unwrap(await mockServices.settings.aws.update(serviceCode, body)),
        verifyScanRole: async (serviceCode) => unwrap(await mockServices.settings.aws.verifyScanRole(serviceCode)),
      },
      azure: {
        get: async (serviceCode) => unwrap(await mockServices.settings.azure.get(serviceCode)),
      },
    },
  },

  dashboard: {
    summary: async () => unwrap(await mockDashboard.summary()),
    systems: async (params) => unwrap(await mockDashboard.systems(params)),
    systemsExport: async (params) => mockDashboard.systemsExport(params),
  },

  dev: {
    getUsers: async () => unwrap(await mockDev.getUsers()),
    switchUser: async (body) => unwrap(await mockDev.switchUser(body)),
  },

  scan: {
    get: async (id, scanId) => unwrap(await mockScan.get(String(id), scanId)),
    getHistory: async (id, query) => unwrap(await mockScan.getHistory(String(id), query)),
    create: async (id, body) => unwrap(await mockScan.create(String(id), body)),
    getStatus: async (id) => unwrap(await mockScan.getStatus(String(id))),
  },

  taskAdmin: {
    getApprovalRequestQueue: async (params) => unwrap(await mockQueueBoard.getApprovalRequestQueue(params)),
  },
};
