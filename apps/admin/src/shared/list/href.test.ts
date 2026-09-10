import { describe, it, expect } from 'vitest';
import { buildListHref } from './href';

describe('buildListHref', () => {
  it('パッチが空なら現在の状態をそのままクエリにする', () => {
    const href = buildListHref('/stations', { operatorId: 'X' }, {});
    expect(href).toBe('/stations?operatorId=X');
  });

  it('パッチの値で上書きする', () => {
    const href = buildListHref('/stations', { operatorId: 'X' }, { lineId: 'Y' });
    expect(href).toBe('/stations?operatorId=X&lineId=Y');
  });

  it('パッチの値が null ならキーを落とす', () => {
    const href = buildListHref('/stations', { operatorId: 'X', lineId: 'Y' }, { lineId: null });
    expect(href).toBe('/stations?operatorId=X');
  });

  it('既定値と一致する値は出力しない', () => {
    const href = buildListHref(
      '/stations',
      { operatorId: 'X' },
      { sort: 'line', order: 'asc' },
      { defaults: { sort: 'line', order: 'asc' } },
    );
    expect(href).toBe('/stations?operatorId=X');
  });

  it('resetPageOn に含まれるキーが変化したら page を落とす', () => {
    const href = buildListHref(
      '/stations',
      { operatorId: 'X', page: 3 },
      { operatorId: 'Y' },
      { resetPageOn: ['operatorId', 'lineId', 'q'] },
    );
    expect(href).toBe('/stations?operatorId=Y');
  });

  it('resetPageOn のキーが変化しなければ page を保持する', () => {
    const href = buildListHref(
      '/stations',
      { operatorId: 'X', page: 3 },
      { operatorId: 'X', sort: 'name' },
      { resetPageOn: ['operatorId', 'lineId', 'q'] },
    );
    expect(href).toBe('/stations?operatorId=X&page=3&sort=name');
  });

  it('何も残らなければベースパスのみを返す', () => {
    const href = buildListHref('/stations', {}, {});
    expect(href).toBe('/stations');
  });

  it('空文字の値はキーごと落とす', () => {
    const href = buildListHref('/stations', { q: '東京' }, { q: '' });
    expect(href).toBe('/stations');
  });
});
