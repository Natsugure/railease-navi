import { describe, it, expect } from 'vitest';
import { stationCreateSchema } from './schema';

const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

describe('stationCreateSchema', () => {
  it('必須フィールドのみで正常にパースされる', () => {
    const result = stationCreateSchema.safeParse({
      name: '銀座',
      operatorId: UUID_A,
      lineId: UUID_B,
    });
    expect(result.success).toBe(true);
  });

  it('任意フィールドを含めてもパースされる', () => {
    const result = stationCreateSchema.safeParse({
      name: '銀座',
      operatorId: UUID_A,
      lineId: UUID_B,
      nameKana: 'ぎんざ',
      nameEn: 'Ginza',
      code: 'G09',
      lat: '35.671989',
      lon: '139.763965',
      prefCode: 13,
      stationOrder: 9,
    });
    expect(result.success).toBe(true);
  });

  it('name が空の場合は失敗する', () => {
    const result = stationCreateSchema.safeParse({
      name: '',
      operatorId: UUID_A,
      lineId: UUID_B,
    });
    expect(result.success).toBe(false);
  });

  it('lineId が欠けている場合は失敗する', () => {
    const result = stationCreateSchema.safeParse({ name: '銀座', operatorId: UUID_A });
    expect(result.success).toBe(false);
  });

  it('operatorId が UUID でない場合は失敗する', () => {
    const result = stationCreateSchema.safeParse({
      name: '銀座',
      operatorId: 'not-uuid',
      lineId: UUID_B,
    });
    expect(result.success).toBe(false);
  });

  it('slug は受け付けない（余剰キーは無視され値は保持されない）', () => {
    const result = stationCreateSchema.safeParse({
      name: '銀座',
      operatorId: UUID_A,
      lineId: UUID_B,
      slug: 'ginza',
    });
    expect(result.success).toBe(true);
    expect(result.success && 'slug' in result.data).toBe(false);
  });
});
