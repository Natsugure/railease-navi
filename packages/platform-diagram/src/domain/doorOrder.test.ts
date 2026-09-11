import { describe, it, expect } from 'vitest';
import { isDoorOrderReversed } from './doorOrder';

describe('isDoorOrderReversed', () => {
  it('carNumber昇順でstartMetersも増加していれば反転しない', () => {
    expect(isDoorOrderReversed([
      { carNumber: 1, startMeters: 0 },
      { carNumber: 2, startMeters: 20 },
      { carNumber: 3, startMeters: 40 },
    ])).toBe(false);
  });

  it('carNumber昇順でstartMetersが減少していれば反転する', () => {
    expect(isDoorOrderReversed([
      { carNumber: 1, startMeters: 40 },
      { carNumber: 2, startMeters: 20 },
      { carNumber: 3, startMeters: 0 },
    ])).toBe(true);
  });

  it('入力の並び順によらず carNumber でソートしてから判定する', () => {
    expect(isDoorOrderReversed([
      { carNumber: 3, startMeters: 0 },
      { carNumber: 1, startMeters: 40 },
      { carNumber: 2, startMeters: 20 },
    ])).toBe(true);
  });

  it('号車が1件以下の場合は反転しない', () => {
    expect(isDoorOrderReversed([{ carNumber: 1, startMeters: 0 }])).toBe(false);
    expect(isDoorOrderReversed([])).toBe(false);
  });
});
