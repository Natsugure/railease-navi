import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LINE_COLOR,
  connectionLabels,
  directionPhrase,
  exitsLabel,
  facingTransferText,
  hasDisplayableInfo,
  primaryLineColor,
  transferEntries,
} from './concourse';
import type { ConcourseDTO, FacilityConnectionDTO } from './types';

function connection(overrides: Partial<FacilityConnectionDTO> = {}): FacilityConnectionDTO {
  return {
    stationName: '新宿',
    lineNames: ['小田急線'],
    lineColors: ['#0072BC'],
    directionName: null,
    exitLabel: null,
    xRangeStart: null,
    xRangeEnd: null,
    ...overrides,
  };
}

function concourse(overrides: Partial<ConcourseDTO> = {}): ConcourseDTO {
  return { id: 'c1', exits: null, cells: [], connections: [], ...overrides };
}

describe('exitsLabel', () => {
  it('出口名をそのまま返す', () => {
    expect(exitsLabel(concourse({ exits: '南口・新南口' }))).toBe('南口・新南口');
  });

  it('前後の空白を取り除く', () => {
    expect(exitsLabel(concourse({ exits: '  南口  ' }))).toBe('南口');
  });

  it('null・空文字・空白のみは未入力として null を返す', () => {
    expect(exitsLabel(concourse({ exits: null }))).toBeNull();
    expect(exitsLabel(concourse({ exits: '' }))).toBeNull();
    expect(exitsLabel(concourse({ exits: '   ' }))).toBeNull();
  });
});

describe('hasDisplayableInfo', () => {
  it('設備も出口名も乗換先も無ければ表示しない', () => {
    expect(hasDisplayableInfo(concourse())).toBe(false);
  });

  it('乗換先が未設定でも出口名だけで表示する', () => {
    expect(hasDisplayableInfo(concourse({ exits: '南口' }))).toBe(true);
  });

  it('出口名が未設定でも乗換先だけで表示する', () => {
    expect(hasDisplayableInfo(concourse({ connections: [connection()] }))).toBe(true);
  });

  it('出口名も乗換先も未設定でも設備があれば表示する', () => {
    expect(
      hasDisplayableInfo(concourse({ cells: [{ xPositionMeters: 10, facilities: [] }] })),
    ).toBe(true);
  });

  it('空白のみの出口名は表示のきっかけにしない', () => {
    expect(hasDisplayableInfo(concourse({ exits: '   ' }))).toBe(false);
  });
});

describe('connectionLabels', () => {
  it('接続が無ければ空配列を返す', () => {
    expect(connectionLabels(concourse())).toEqual([]);
  });

  it('路線名を連結する', () => {
    const labels = connectionLabels(
      concourse({ connections: [connection({ lineNames: ['小田急線', '京王線'] })] }),
    );
    expect(labels).toEqual(['小田急線・京王線']);
  });

  it('方面名があれば併記する', () => {
    const labels = connectionLabels(
      concourse({ connections: [connection({ directionName: '藤沢' })] }),
    );
    expect(labels).toEqual(['小田急線（藤沢方面）']);
  });

  it('exitLabel（管理画面の備考）があれば末尾に添える', () => {
    const labels = connectionLabels(
      concourse({ connections: [connection({ exitLabel: '西口地下' })] }),
    );
    expect(labels).toEqual(['小田急線［西口地下］']);
  });

  it('路線が引けない接続は駅名で代替し、空ラベルにしない', () => {
    const labels = connectionLabels(
      concourse({ connections: [connection({ lineNames: [], stationName: '新宿三丁目' })] }),
    );
    expect(labels).toEqual(['新宿三丁目']);
  });

  it('複数の接続をそれぞれ1要素として返す', () => {
    const labels = connectionLabels(
      concourse({
        connections: [
          connection({ lineNames: ['小田急線'], directionName: '藤沢' }),
          connection({ lineNames: ['京王線'], exitLabel: '中央口' }),
        ],
      }),
    );
    expect(labels).toEqual(['小田急線（藤沢方面）', '京王線［中央口］']);
  });
});

describe('directionPhrase', () => {
  it('「方面」で終わっていなければ添える', () => {
    expect(directionPhrase('池袋')).toBe('池袋方面');
  });

  // lineDirections.displayName は「新宿・荻窪・方南町方面」のように
  // すでに「方面」を含んでいることがある。無条件に足すと「方面方面」になる
  it('すでに「方面」で終わっていれば重ねない', () => {
    expect(directionPhrase('新宿・荻窪・方南町方面')).toBe('新宿・荻窪・方南町方面');
  });

  it('前後の空白を取り除く', () => {
    expect(directionPhrase('  渋谷  ')).toBe('渋谷方面');
  });
});

describe('transferEntries', () => {
  it('接続が無ければ空配列を返す', () => {
    expect(transferEntries(concourse())).toEqual([]);
  });

  it('路線を1件も畳まずに全件返す', () => {
    // 新宿級では接続先駅に乗り入れる全路線が入る。図でも省略しないのが本機能の要件
    const lineNames = ['JR山手線', 'JR中央線', 'JR埼京線', 'JR湘南新宿ライン', '小田急線', '京王線'];
    const entries = transferEntries(
      concourse({ connections: [connection({ lineNames, lineColors: lineNames.map(() => null) })] }),
    );

    expect(entries[0]!.lines.map((l) => l.name)).toEqual(lineNames);
  });

  it('路線名と路線カラーを同じ並びで組にする', () => {
    const entries = transferEntries(
      concourse({
        connections: [connection({ lineNames: ['丸ノ内線', '副都心線'], lineColors: ['#F62E36', '#9C5E31'] })],
      }),
    );

    expect(entries[0]!.lines).toEqual([
      { name: '丸ノ内線', color: '#F62E36' },
      { name: '副都心線', color: '#9C5E31' },
    ]);
  });

  it('路線カラーが未設定なら既定色に置き換える', () => {
    const entries = transferEntries(
      concourse({ connections: [connection({ lineNames: ['都営新宿線'], lineColors: [null] })] }),
    );

    expect(entries[0]!.lines[0]!.color).toBe(DEFAULT_LINE_COLOR);
  });

  it('路線カラーが足りなくても路線名を落とさない', () => {
    const entries = transferEntries(
      concourse({ connections: [connection({ lineNames: ['A線', 'B線'], lineColors: ['#111111'] })] }),
    );

    expect(entries[0]!.lines).toEqual([
      { name: 'A線', color: '#111111' },
      { name: 'B線', color: DEFAULT_LINE_COLOR },
    ]);
  });

  it('方面名・備考・駅名を保持する', () => {
    const entries = transferEntries(
      concourse({
        connections: [connection({ stationName: '新宿三丁目', directionName: '池袋', exitLabel: 'A3出口' })],
      }),
    );

    expect(entries[0]).toMatchObject({
      stationName: '新宿三丁目',
      directionName: '池袋',
      exitLabel: 'A3出口',
    });
  });

  it('接続1件につき1要素を返す', () => {
    const entries = transferEntries(
      concourse({ connections: [connection(), connection({ stationName: '代々木' })] }),
    );

    expect(entries).toHaveLength(2);
  });
});

describe('primaryLineColor', () => {
  it('先頭の路線カラーを代表色にする', () => {
    expect(primaryLineColor(connection({ lineColors: ['#F62E36', '#9C5E31'] }))).toBe('#F62E36');
  });

  it('先頭が未設定なら既定色を返す', () => {
    expect(primaryLineColor(connection({ lineColors: [null] }))).toBe(DEFAULT_LINE_COLOR);
  });

  it('路線カラーが1件も無ければ既定色を返す', () => {
    expect(primaryLineColor(connection({ lineColors: [] }))).toBe(DEFAULT_LINE_COLOR);
  });
});

describe('facingTransferText', () => {
  it('方面名があれば括弧で添える', () => {
    expect(facingTransferText(connection({ lineNames: ['丸ノ内線'], directionName: '池袋' }))).toBe(
      '丸ノ内線（池袋方面）は同じホームの向かい側に到着',
    );
  });

  it('方面名がすでに「方面」で終わっていても重ねない', () => {
    expect(
      facingTransferText(connection({ lineNames: ['丸ノ内線'], directionName: '新宿・荻窪・方南町方面' })),
    ).toBe('丸ノ内線（新宿・荻窪・方南町方面）は同じホームの向かい側に到着');
  });

  it('方面名が無ければ路線名だけで組み立てる', () => {
    expect(facingTransferText(connection({ lineNames: ['丸ノ内線'] }))).toBe(
      '丸ノ内線は同じホームの向かい側に到着',
    );
  });

  it('複数路線は「・」で連ねる', () => {
    expect(facingTransferText(connection({ lineNames: ['有楽町線', '南北線'] }))).toBe(
      '有楽町線・南北線は同じホームの向かい側に到着',
    );
  });

  it('路線が引けなければ駅名で代替する', () => {
    expect(facingTransferText(connection({ lineNames: [], stationName: '赤坂見附' }))).toBe(
      '赤坂見附は同じホームの向かい側に到着',
    );
  });
});
