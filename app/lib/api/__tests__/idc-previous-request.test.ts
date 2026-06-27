import { describe, it, expect } from 'vitest';
import { toIdcResourceView } from '@/app/lib/api/idc';

// The previous-request load maps each contract `IdcResourceInput` to an
// IdcResourceView whose `excluded` flag drives the Step-1 selection state.
// `selected` is the contract source of truth: selected=false → 제외 대상.
describe('toIdcResourceView — selected → excluded mapping', () => {
  const base = { input_format: 'IP' as const, ips: ['10.0.0.1'], port: 3306, database_type: 'MYSQL' };

  it('selected=true → 선택 대상 (excluded=false)', () => {
    expect(toIdcResourceView({ ...base, selected: true }).excluded).toBe(false);
  });

  it('selected=false without a reason → 제외 대상 (excluded=true)', () => {
    // Regression: previously excluded was derived from exclusion_reason only, so a
    // reason-less selected=false row was wrongly shown as a selected target.
    expect(toIdcResourceView({ ...base, selected: false }).excluded).toBe(true);
  });

  it('selected=false with a reason → 제외 대상 + reason preserved', () => {
    const view = toIdcResourceView({ ...base, selected: false, exclusion_reason: 'StageDB' });
    expect(view.excluded).toBe(true);
    expect(view.exclusionReason).toBe('StageDB');
  });

  it('selected absent + reason → excluded=true (legacy payload fallback)', () => {
    expect(toIdcResourceView({ ...base, exclusion_reason: 'StageDB' }).excluded).toBe(true);
  });

  it('selected absent + no reason → excluded=false', () => {
    expect(toIdcResourceView({ ...base }).excluded).toBe(false);
  });
});
