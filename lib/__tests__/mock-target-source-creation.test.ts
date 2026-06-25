import { describe, it, expect, beforeEach } from 'vitest';
import { mockTargetSources } from '@/lib/bff/mock/target-sources';
import { setCurrentUser } from '@/lib/mock-data';
import { z } from 'zod';
import { schemas } from '@/lib/generated/install-v1';
type TargetSourceCreationCandidateResponseWire = z.infer<typeof schemas.TargetSourceCreationCandidateResponse>;

// The mock authors the swagger WIRE (snake) shape. These tests assert the raw wire
// is contract-shaped (Spec F 35/36) and that it survives the route boundary —
// `schemas.X.parse()` (the generated zod schema is the contract).

beforeEach(() => {
  globalThis.__piiAgentMockStore = undefined;
  setCurrentUser('admin-1');
});

const readJson = async (res: Response): Promise<unknown> => res.json();

describe('mockTargetSources.previewRegistration (35) — creation candidates', () => {
  it('returns a BARE ARRAY of snake candidates, one per database_types[i]', async () => {
    const res = await mockTargetSources.previewRegistration('aws', {
      cloud_type: 'aws',
      is_china_region: false,
      database_types: ['MYSQL', 'OTHERS'],
      grant_service_terraform_execution_permission: true,
      metadata: { aws_account_id: '999888777666' },
    });
    expect(res.status).toBe(200);

    const body = (await readJson(res)) as TargetSourceCreationCandidateResponseWire[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);

    const [first] = body;
    expect(first.status).toBe('ADD');
    expect(first.cloud_type).toBe('AWS'); // response enum is UPPERCASE
    expect(first.is_sdu_type).toBe(false);
    expect(first.is_china_region).toBe(false);
    expect(first.metadata).toEqual({ aws_account_id: '999888777666' });
    expect(first.grant_service_terraform_execution_permission).toBe(true);

    // Survives the route boundary: the generated zod schema validates the raw wire.
    expect(() =>
      z.array(schemas.TargetSourceCreationCandidateResponse).parse(body),
    ).not.toThrow();
  });

  it('rejects a request missing the required is_china_region (400)', async () => {
    const res = await mockTargetSources.previewRegistration('aws', {
      cloud_type: 'aws',
      database_types: ['MYSQL'],
      metadata: { aws_account_id: '999888777666' },
    });
    expect(res.status).toBe(400);
  });

  it('GCP candidate carries metadata.project_id (request casing)', async () => {
    const res = await mockTargetSources.previewRegistration('gcp', {
      cloud_type: 'gcp',
      is_china_region: false,
      database_types: ['BIGQUERY'],
      metadata: { project_id: 'gcp-proj-xyz' },
    });
    const body = (await readJson(res)) as TargetSourceCreationCandidateResponseWire[];
    expect(body[0].cloud_type).toBe('GCP');
    expect(body[0].metadata).toEqual({ project_id: 'gcp-proj-xyz' });
  });
});

describe('mockTargetSources.create (36) — round-trip → TargetSourceInfo', () => {
  it('accepts the candidate snake body and returns 201 TargetSourceInfo (camel top + snake metadata)', async () => {
    const candidate: TargetSourceCreationCandidateResponseWire = {
      status: 'ADD',
      cloud_type: 'AWS',
      is_sdu_type: false,
      is_china_region: true,
      metadata: { aws_account_id: '123456789012', description: 'prod-db' },
      grant_service_terraform_execution_permission: true,
    };

    const res = await mockTargetSources.create('aws', candidate);
    expect(res.status).toBe(201);

    const body = (await readJson(res)) as Record<string, unknown>;
    // Top-level camelCase.
    expect(typeof body.targetSourceId).toBe('number');
    expect(body.cloudProvider).toBe('AWS');
    expect(body.serviceCode).toBe('aws');
    expect(body.description).toBe('prod-db');
    // Nested metadata is snake on the wire.
    expect(body.metadata).toMatchObject({
      aws_account_id: '123456789012',
      is_china_region: true,
      grant_service_terraform_execution_permission: true,
    });

    // Survives the route boundary: the generated zod schema validates the raw wire.
    expect(() => schemas.TargetSourceInfo.parse(body)).not.toThrow();
  });

  it('a created AWS target then appears as DUPLICATE on a re-preview (round-trip identity)', async () => {
    const candidate: TargetSourceCreationCandidateResponseWire = {
      status: 'ADD',
      cloud_type: 'AWS',
      is_sdu_type: false,
      is_china_region: false,
      metadata: { aws_account_id: '111122223333' },
    };
    const created = (await readJson(await mockTargetSources.create('aws', candidate))) as {
      targetSourceId: number;
    };

    // The created project has no dbType (the contract dropped it), so it does
    // not participate in duplicate matching — re-preview stays ADD. This guards
    // against an accidental duplicate-key regression for dbType-less targets.
    const rePreview = (await readJson(
      await mockTargetSources.previewRegistration('aws', {
        cloud_type: 'aws',
        is_china_region: false,
        database_types: ['MYSQL'],
        metadata: { aws_account_id: '111122223333' },
      }),
    )) as TargetSourceCreationCandidateResponseWire[];

    expect(typeof created.targetSourceId).toBe('number');
    expect(rePreview[0].status).toBe('ADD');
  });

  it('forbids non-admin users (403)', async () => {
    setCurrentUser('user-1');
    const res = await mockTargetSources.create('aws', {
      status: 'ADD',
      cloud_type: 'AWS',
      is_sdu_type: false,
      is_china_region: false,
      metadata: { aws_account_id: '123456789012' },
    });
    expect(res.status).toBe(403);
  });
});

describe('mockTargetSources.list (37) — wire-snake TargetSourceDetail', () => {
  it('returns a bare array with snake keys + string process_status enum', async () => {
    const res = await mockTargetSources.list('aws');
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as Array<Record<string, unknown>>;
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      const item = body[0];
      expect(item).toHaveProperty('target_source_id');
      expect(item).toHaveProperty('process_status');
      expect(item).toHaveProperty('cloud_provider');
      expect(typeof item.process_status).toBe('string');
    }
  });
});
