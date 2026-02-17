import { NextResponse } from 'next/server';
import { mockServices } from '@/lib/api-client/mock/services';
import { mockProjects } from '@/lib/api-client/mock/projects';

export const mockTargetSources = {
  list: async (serviceCode: string) => {
    const response = await mockServices.projects.list(serviceCode);
    if (!response.ok) return response;
    const { projects } = await response.json();
    return NextResponse.json({ targetSources: projects });
  },

  get: async (projectId: string) => {
    const response = await mockProjects.get(projectId);
    if (!response.ok) return response;
    const { project } = await response.json();
    return NextResponse.json({ targetSource: project });
  },

  create: async (body: unknown) => {
    const response = await mockProjects.create(body);
    if (!response.ok) return response;
    const { project } = await response.json();
    return new NextResponse(JSON.stringify({ targetSource: project }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
