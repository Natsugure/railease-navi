import { describe, it, expect } from 'vitest';
import { parseListParams, escapeLikePattern, parseUuidParam } from './params';

const SPEC = { sortKeys: ['line', 'name'] as const, defaultSort: 'line' as const, perPage: 50 };

describe('parseListParams', () => {
  it('パラメータが無ければ既定値になる', () => {
    const result = parseListParams({}, SPEC);
    expect(result).toEqual({ q: null, sort: 'line', order: 'asc', page: 1, perPage: 50 });
  });

  it('正常な値をそのまま反映する', () => {
    const result = parseListParams({ q: '東京', sort: 'name', order: 'desc', page: '3' }, SPEC);
    expect(result).toEqual({ q: '東京', sort: 'name', order: 'desc', page: 3, perPage: 50 });
  });

  it('未知の sort は defaultSort にフォールバックする', () => {
    const result = parseListParams({ sort: 'bogus' }, SPEC);
    expect(result.sort).toBe('line');
  });

  it('order が asc/desc 以外なら asc にフォールバックする', () => {
    const result = parseListParams({ order: 'up' }, SPEC);
    expect(result.order).toBe('asc');
  });

  it('page が数値でない・0以下・小数なら1にフォールバックする', () => {
    expect(parseListParams({ page: 'abc' }, SPEC).page).toBe(1);
    expect(parseListParams({ page: '0' }, SPEC).page).toBe(1);
    expect(parseListParams({ page: '-1' }, SPEC).page).toBe(1);
    expect(parseListParams({ page: '1.5' }, SPEC).page).toBe(1);
  });

  it('q が空白のみなら null になる', () => {
    expect(parseListParams({ q: '   ' }, SPEC).q).toBeNull();
  });

  it('q の前後の空白は削る', () => {
    expect(parseListParams({ q: '  東京  ' }, SPEC).q).toBe('東京');
  });

  it('配列で来た値は先頭のみ使う', () => {
    const result = parseListParams({ q: ['東京', '大阪'] }, SPEC);
    expect(result.q).toBe('東京');
  });
});

describe('parseUuidParam', () => {
  it('正しいUUIDはそのまま返す', () => {
    expect(parseUuidParam('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('不正な形式は undefined にフォールバックする（500を防ぐ）', () => {
    expect(parseUuidParam('not-a-uuid')).toBeUndefined();
  });

  it('未指定は undefined', () => {
    expect(parseUuidParam(undefined)).toBeUndefined();
  });

  it('配列で来た値は先頭のみ検証する', () => {
    expect(parseUuidParam(['550e8400-e29b-41d4-a716-446655440000', 'x'])).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('escapeLikePattern', () => {
  it('% をエスケープする', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
  });

  it('_ をエスケープする', () => {
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  it('\\ 自身もエスケープする', () => {
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  it('通常の文字列はそのまま返す', () => {
    expect(escapeLikePattern('東京')).toBe('東京');
  });
});
