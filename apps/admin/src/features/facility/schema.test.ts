import { describe, it, expect } from 'vitest';
import { platformLocationSchema } from './schema';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('platformLocationSchema', () => {
  it('platformIdとcellsがあれば正常にパースされる', () => {
    const result = platformLocationSchema.safeParse({
      platformId: VALID_UUID,
      cells: [{ xPositionMeters: 10.5, facilities: [{ typeCode: 'elevator' }] }],
    });
    expect(result.success).toBe(true);
  });

  it('platformIdがUUIDでない場合は失敗する', () => {
    const result = platformLocationSchema.safeParse({
      platformId: 'not-uuid',
      cells: [{ facilities: [{ typeCode: 'elevator' }] }],
    });
    expect(result.success).toBe(false);
  });

  it('platformIdがない場合は失敗する', () => {
    const result = platformLocationSchema.safeParse({
      cells: [{ facilities: [{ typeCode: 'elevator' }] }],
    });
    expect(result.success).toBe(false);
  });

  it('cellsがない場合は失敗する（1件以上必須）', () => {
    const result = platformLocationSchema.safeParse({ platformId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('xPositionMetersがnullのセル（コンコース全体）でも正常にパースされる', () => {
    const result = platformLocationSchema.safeParse({
      platformId: VALID_UUID,
      cells: [{ xPositionMeters: null, facilities: [{ typeCode: 'elevator' }] }],
    });
    expect(result.success).toBe(true);
  });

  it('対面乗り換え帯のxRangeStartがxRangeEnd以上の場合は失敗する', () => {
    const result = platformLocationSchema.safeParse({
      platformId: VALID_UUID,
      cells: [{ facilities: [{ typeCode: 'elevator' }] }],
      connections: [{ stationId: VALID_UUID, xRangeStart: 20, xRangeEnd: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it('isWheelchairAccessible/isStrollerAccessibleがnullでも正常にパースされる', () => {
    // Issue #95 の図上編集はコンコース全体を再送する全置換PUTのため、未設定(null)を
    // そのまま送れる必要がある（true に丸められるとアクセシビリティ属性が黙って変わる）
    const result = platformLocationSchema.safeParse({
      platformId: VALID_UUID,
      cells: [{
        facilities: [{ typeCode: 'elevator', isWheelchairAccessible: null, isStrollerAccessible: null }],
      }],
    });
    expect(result.success).toBe(true);
  });

  it('対面乗り換え帯のxRangeStart/xRangeEndが正しい順序なら正常にパースされる', () => {
    const result = platformLocationSchema.safeParse({
      platformId: VALID_UUID,
      cells: [{ facilities: [{ typeCode: 'elevator' }] }],
      connections: [{ stationId: VALID_UUID, connectedPlatformId: VALID_UUID, xRangeStart: 10, xRangeEnd: 20 }],
    });
    expect(result.success).toBe(true);
  });
});
