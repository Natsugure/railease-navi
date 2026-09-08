import { describe, it, expect } from 'vitest';
import { lineCreateSchema } from './schema';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('lineCreateSchema', () => {
  it('必須フィールドのみで正常にパースされる', () => {
    const result = lineCreateSchema.safeParse({
      name: '銀座線',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('任意フィールドを含めてもパースされる', () => {
    const result = lineCreateSchema.safeParse({
      name: '銀座線',
      operatorId: VALID_UUID,
      nameKana: 'ぎんざせん',
      nameEn: 'Ginza Line',
      lineCode: 'G',
      color: '#FF9500',
      displayOrder: 3,
    });
    expect(result.success).toBe(true);
  });

  it('nameが空の場合は失敗する', () => {
    const result = lineCreateSchema.safeParse({
      name: '',
      operatorId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it('operatorIdがUUIDでない場合は失敗する', () => {
    const result = lineCreateSchema.safeParse({
      name: '銀座線',
      operatorId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('operatorIdが欠けている場合は失敗する', () => {
    const result = lineCreateSchema.safeParse({ name: '銀座線' });
    expect(result.success).toBe(false);
  });

  it('displayOrderが小数の場合は失敗する', () => {
    const result = lineCreateSchema.safeParse({
      name: '銀座線',
      operatorId: VALID_UUID,
      displayOrder: 1.5,
    });
    expect(result.success).toBe(false);
  });
});
