import { ServiceCode, ProjectSummary, User, CloudProvider, Project } from '../../lib/types';

const BASE_URL = '/api';

export const getServices = async (): Promise<ServiceCode[]> => {
  const res = await fetch(`${BASE_URL}/user/services`);
  if (!res.ok) throw new Error('Failed to fetch services');
  const data = await res.json();
  return data.services;
};

export const getProjects = async (serviceCode: string): Promise<ProjectSummary[]> => {
  const res = await fetch(`${BASE_URL}/services/${serviceCode}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  const data = await res.json();
  return data.projects;
};

export const createProject = async (payload: {
  projectCode: string;
  serviceCode: string;
  cloudProvider: CloudProvider;
  description?: string;
}): Promise<void> => {
  const res = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create project');
};

export const getPermissions = async (serviceCode: string): Promise<User[]> => {
  const res = await fetch(`${BASE_URL}/services/${serviceCode}/permissions`);
  if (!res.ok) throw new Error('Failed to fetch permissions');
  const data = await res.json();
  return data.users;
};

export const addPermission = async (serviceCode: string, userId: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/services/${serviceCode}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error('Failed to add permission');
};

export const deletePermission = async (serviceCode: string, userId: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/services/${serviceCode}/permissions/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete permission');
};

export const getProject = async (id: string): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to fetch project');
  }
  const data = await res.json();
  return data.project;
};

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}

export const searchUsers = async (
  query: string,
  excludeIds: string[] = []
): Promise<UserSearchResult[]> => {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','));

  const res = await fetch(`${BASE_URL}/users/search?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to search users');
  const data = await res.json();
  return data.users;
};
