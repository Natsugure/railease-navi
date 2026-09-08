import { describe, it, expect } from 'vitest';
import { normalizeAdjacencyEndpoints } from './normalize';

const LOW = '00000000-0000-0000-0000-000000000001';
const HIGH = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

describe('normalizeAdjacencyEndpoints', () => {
  it('昇順で渡すとそのまま返る', () => {
    expect(normalizeAdjacencyEndpoints(LOW, HIGH)).toEqual({
      stationAId: LOW,
      stationBId: HIGH,
    });
  });

  it('逆順で渡しても昇順に正規化される', () => {
    expect(normalizeAdjacencyEndpoints(HIGH, LOW)).toEqual({
      stationAId: LOW,
      stationBId: HIGH,
    });
  });

  it('(a,b) と (b,a) は同じ結果になる', () => {
    expect(normalizeAdjacencyEndpoints(LOW, HIGH)).toEqual(
      normalizeAdjacencyEndpoints(HIGH, LOW),
    );
  });

  it('等値端点はそのまま返る（自己隣接の排除は schema の責務）', () => {
    expect(normalizeAdjacencyEndpoints(LOW, LOW)).toEqual({
      stationAId: LOW,
      stationBId: LOW,
    });
  });

  it('大文字小文字を含む UUID でも辞書順で安定する', () => {
    const a = '0a000000-0000-0000-0000-000000000000';
    const b = '0b000000-0000-0000-0000-000000000000';
    expect(normalizeAdjacencyEndpoints(b, a)).toEqual({ stationAId: a, stationBId: b });
    expect(normalizeAdjacencyEndpoints(a, b)).toEqual({ stationAId: a, stationBId: b });
  });
});
