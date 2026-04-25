/**
 * Guide CMS — mock namespace.
 *
 * Spec: docs/reports/guide-cms/spec.md §4 + §4.5 (drift).
 *
 * ADR-007: returns `NextResponse` from every branch so route handlers
 * stay thin (dispatch-only). All validation, ProblemDetails creation,
 * and drift seeding happen here.
 *
 * Drift policy (§4.5):
 *  - Invalid identifier (`name ∉ GUIDE_NAMES`)            → 404 GUIDE_NOT_FOUND
 *  - Valid name with no stored entry (registry ↔ store drift)
 *    → 200 with empty contents and epoch `updatedAt`; seed
 *      the empty shell into the store and warn on the console.
 */

import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { GUIDE_NAMES } from '@/lib/constants/guide-registry';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

import { guidesSeed } from './guides-seed';

import type { GuideContents, GuideDetail, GuideName } from '@/lib/types/guide';
import type { ValidationError } from '@/lib/utils/validate-guide-html';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const EPOCH_ISO = '1970-01-01T00:00:00Z';

const store = new Map<GuideName, GuideDetail>();

let seeded = false;

const ensureSeeded = (): void => {
  if (seeded) return;
  for (const name of GUIDE_NAMES) {
    const entry = guidesSeed[name];
    if (entry) store.set(name, entry);
  }
  seeded = true;
};

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

const isGuideName = (name: string): name is GuideName =>
  (GUIDE_NAMES as readonly string[]).includes(name);

interface UpdateBody {
  contents: GuideContents;
}

const isUpdateBody = (body: unknown): body is UpdateBody => {
  if (typeof body !== 'object' || body === null) return false;
  const contents = (body as Record<string, unknown>).contents;
  if (typeof contents !== 'object' || contents === null) return false;
  const { ko, en } = contents as Record<string, unknown>;
  return typeof ko === 'string' && typeof en === 'string';
};

// ---------------------------------------------------------------------------
// Problem helpers
// ---------------------------------------------------------------------------

/**
 * Synthetic requestId for mock-layer bodies. The real `x-request-id`
 * header is still attached by `withV1`; this value exists so the body
 * conforms to the ProblemDetails contract even when the mock is invoked
 * outside of a route handler (e.g. from a test).
 */
const mockRequestId = (): string => randomUUID();

interface GuideContentInvalidDetails {
  ko?: ValidationError[];
  en?: ValidationError[];
}

const problemResponseWithDetails = (
  code: 'GUIDE_CONTENT_INVALID',
  detail: string,
  requestId: string,
  errors: GuideContentInvalidDetails,
): NextResponse => {
  const problem = createProblem(code, detail, requestId);
  return NextResponse.json(
    { ...problem, errors },
    {
      status: problem.status,
      headers: { 'content-type': 'application/problem+json' },
    },
  );
};

// ---------------------------------------------------------------------------
// Namespace
// ---------------------------------------------------------------------------

export const mockGuides = {
  get: async (name: string): Promise<NextResponse> => {
    const requestId = mockRequestId();
    if (!isGuideName(name)) {
      return problemResponse(
        createProblem('GUIDE_NOT_FOUND', `Unknown guide name: ${name}`, requestId),
      );
    }
    ensureSeeded();
    const existing = store.get(name);
    if (existing) return NextResponse.json(existing);

    // Registry ↔ store drift (§4.5): seed an empty shell so the editor
    // can open immediately, and mark it with the epoch timestamp.
    console.warn(`[mockGuides.get] drift: ${name} not in store, seeding empty`);
    const empty: GuideDetail = {
      name,
      contents: { ko: '', en: '' },
      updatedAt: EPOCH_ISO,
    };
    store.set(name, empty);
    return NextResponse.json(empty);
  },

  put: async (name: string, body: unknown): Promise<NextResponse> => {
    const requestId = mockRequestId();
    if (!isGuideName(name)) {
      return problemResponse(
        createProblem('GUIDE_NOT_FOUND', `Unknown guide name: ${name}`, requestId),
      );
    }
    if (!isUpdateBody(body)) {
      return problemResponse(
        createProblem(
          'VALIDATION_FAILED',
          'contents.ko 와 contents.en 이 모두 문자열이어야 합니다',
          requestId,
        ),
      );
    }
    ensureSeeded();

    const koResult = validateGuideHtml(body.contents.ko);
    const enResult = validateGuideHtml(body.contents.en);
    if (!koResult.valid || !enResult.valid) {
      const errors: GuideContentInvalidDetails = {};
      if (!koResult.valid) errors.ko = koResult.errors;
      if (!enResult.valid) errors.en = enResult.errors;
      return problemResponseWithDetails(
        'GUIDE_CONTENT_INVALID',
        'ko, en 모두 작성되어야 하며 허용된 HTML 태그만 사용할 수 있습니다.',
        requestId,
        errors,
      );
    }

    const detail: GuideDetail = {
      name,
      contents: { ko: body.contents.ko, en: body.contents.en },
      updatedAt: new Date().toISOString(),
    };
    store.set(name, detail);
    return NextResponse.json(detail);
  },
};

// ---------------------------------------------------------------------------
// Test infra
// ---------------------------------------------------------------------------

/** Clears the in-memory store and reseeding flag — use in `beforeEach`. */
export const __resetMockGuideStore = (): void => {
  store.clear();
  seeded = false;
};
