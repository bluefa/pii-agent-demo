import { describe, expect, it } from 'vitest';
import { schemas } from '@/lib/generated/install-v1';

// `npm run gen:api` post-processes the generated zod into a LOOSE form: only basic-type
// mismatches fail; null / datetime-format / missing / extra fields all pass. This guards the
// transform against regressing when the schemas are regenerated.
describe('generated install-v1 schemas tolerate BFF/swagger drift', () => {
  it('accepts null where string / number / array / boolean are declared', () => {
    const parsed = schemas.IdcResourceInput.parse({
      host: null, // declared string
      port: null, // declared number
      ips: null, // declared array
      selected: null, // declared boolean
    });
    expect(parsed).toMatchObject({ host: null, port: null, ips: null, selected: null });
  });

  it('accepts datetime strings without a Z/offset (strict .datetime() removed)', () => {
    const parsed = schemas.ApprovalRequestSummaryDto.parse({
      requested_at: '2026-05-06T04:36:31.661958',
    });
    expect(parsed.requested_at).toBe('2026-05-06T04:36:31.661958');
  });

  it('ignores missing fields (partial) and extra fields (passthrough)', () => {
    const parsed = schemas.IdcResourceInput.parse({
      host: 'db.internal',
      private_domain_name_list: null, // not in schema → passthrough keeps it
    }) as Record<string, unknown>;
    expect(parsed.host).toBe('db.internal');
    expect(parsed.private_domain_name_list).toBeNull();
  });

  it('turns former empty `{}` objects into indexable records', () => {
    const parsed = schemas.GuideContentRequest.parse({ ko: { title: 'x' }, en: null });
    expect((parsed.ko as Record<string, unknown>).title).toBe('x');
  });

  it('STILL rejects a genuine basic-type mismatch (string given for a number)', () => {
    expect(() => schemas.IdcResourceInput.parse({ port: 'not-a-number' })).toThrow();
  });
});
