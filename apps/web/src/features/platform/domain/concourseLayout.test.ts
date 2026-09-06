import { describe, it, expect } from 'vitest';
import {
  PLATE_GAP_PX,
  PLATE_MAX_WIDTH_PX,
  PLATE_MIN_WIDTH_PX,
  estimateTextWidth,
  layoutConcoursePlates,
  layoutFacingBanners,
  transferNote,
} from './concourseLayout';
import { DEFAULT_LINE_COLOR } from './concourse';
import { PX_PER_METER, type Bounds } from './geometry';
import type { ConcourseDTO, FacilityConnectionDTO } from './types';

const BOUNDS: Bounds = { minX: -20, maxX: 320 };
const CANVAS_PX = (BOUNDS.maxX - BOUNDS.minX) * PX_PER_METER;

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

function concourse(id: string, overrides: Partial<ConcourseDTO> = {}): ConcourseDTO {
  return { id, exits: '南口', cells: [], connections: [], ...overrides };
}

function cellsAt(...xs: (number | null)[]) {
  return xs.map((x) => ({ xPositionMeters: x, facilities: [] }));
}

describe('estimateTextWidth', () => {
  it('全角文字を1em、半角文字を0.5emとして数える', () => {
    expect(estimateTextWidth('南口', 2)).toBeCloseTo(4);
    expect(estimateTextWidth('AB', 2)).toBeCloseTo(2);
    expect(estimateTextWidth('南口A', 2)).toBeCloseTo(5);
  });

  it('空文字は幅0', () => {
    expect(estimateTextWidth('', 2)).toBe(0);
  });

  it('半角カナを半角として数える', () => {
    expect(estimateTextWidth('ﾐﾅﾐ', 2)).toBeCloseTo(3);
  });
});

describe('transferNote', () => {
  it('路線が引ける場合は駅名を省き方面と備考だけを添える', () => {
    expect(
      transferNote({
        lines: [{ name: '丸ノ内線', color: '#F62E36' }],
        stationName: '新宿三丁目',
        directionName: '池袋',
        exitLabel: 'A3出口',
      }),
    ).toBe('池袋方面・A3出口');
  });

  it('方面名がすでに「方面」で終わっていても重ねない', () => {
    expect(
      transferNote({
        lines: [{ name: '丸ノ内線', color: '#F62E36' }],
        stationName: '赤坂見附',
        directionName: '東京・池袋方面',
        exitLabel: null,
      }),
    ).toBe('東京・池袋方面');
  });

  it('路線が引けない場合は駅名を出す', () => {
    expect(
      transferNote({ lines: [], stationName: '赤坂見附', directionName: null, exitLabel: null }),
    ).toBe('赤坂見附');
  });

  it('添えるものが何も無ければ null', () => {
    expect(
      transferNote({
        lines: [{ name: '小田急線', color: '#0072BC' }],
        stationName: '新宿',
        directionName: null,
        exitLabel: null,
      }),
    ).toBeNull();
  });
});

describe('layoutConcoursePlates', () => {
  describe('対象の絞り込み', () => {
    it('座標を持つアクセス点が無いコンコースは除外する', () => {
      const { groups } = layoutConcoursePlates([concourse('c1', { cells: cellsAt(null) })], BOUNDS);
      expect(groups).toEqual([]);
    });

    it('アクセス点が1件も無いコンコースは除外する', () => {
      const { groups } = layoutConcoursePlates([concourse('c1')], BOUNDS);
      expect(groups).toEqual([]);
    });

    it('出口名も乗換先も無いコンコースは除外する', () => {
      const { groups } = layoutConcoursePlates(
        [concourse('c1', { exits: null, cells: cellsAt(50) })],
        BOUNDS,
      );
      expect(groups).toEqual([]);
    });

    it('出口名だけでも対象になる', () => {
      const { groups } = layoutConcoursePlates(
        [concourse('c1', { exits: '南口', cells: cellsAt(50) })],
        BOUNDS,
      );
      expect(groups).toHaveLength(1);
    });

    it('乗換先だけでも対象になる', () => {
      const { groups } = layoutConcoursePlates(
        [concourse('c1', { exits: null, cells: cellsAt(50), connections: [connection()] })],
        BOUNDS,
      );
      expect(groups).toHaveLength(1);
    });
  });

  describe('束ね線のアンカー', () => {
    it('アクセス点の範囲を束ね線にし、その中点をアンカーにする', () => {
      const { groups } = layoutConcoursePlates(
        [concourse('c1', { cells: cellsAt(40, 100, 70) })],
        BOUNDS,
      );

      expect(groups[0]!.bracketStartX).toBe(40);
      expect(groups[0]!.bracketEndX).toBe(100);
      expect(groups[0]!.anchorX).toBe(70);
    });

    it('縦ヒゲのxを昇順・重複除去で返す', () => {
      const { groups } = layoutConcoursePlates(
        [concourse('c1', { cells: cellsAt(100, 40, 100, 70) })],
        BOUNDS,
      );

      expect(groups[0]!.tickXs).toEqual([40, 70, 100]);
    });

    it('アクセス点が1件なら束ね線の両端が一致する', () => {
      const { groups } = layoutConcoursePlates([concourse('c1', { cells: cellsAt(50) })], BOUNDS);

      expect(groups[0]!.bracketStartX).toBe(groups[0]!.bracketEndX);
      expect(groups[0]!.anchorX).toBe(50);
    });

    // 旧実装は labelX を viewBox 内へクランプしていたが、プレートがHTMLになり
    // 実幅がサーバ側で分からなくなったため、アンカーは動かさず align ヒントで寄せる
    it('端に寄せる場合でもアンカーは動かさない', () => {
      const { groups } = layoutConcoursePlates([concourse('c1', { cells: cellsAt(-20) })], BOUNDS);

      expect(groups[0]!.anchorX).toBe(-20);
      expect(groups[0]!.align).toBe('start');
    });

    it('anchorX 昇順で返す', () => {
      const { groups } = layoutConcoursePlates(
        [
          concourse('right', { cells: cellsAt(300) }),
          concourse('left', { cells: cellsAt(10) }),
          concourse('mid', { cells: cellsAt(150) }),
        ],
        BOUNDS,
      );

      expect(groups.map((g) => g.concourseId)).toEqual(['left', 'mid', 'right']);
    });
  });

  describe('プレートの中身（省略しない）', () => {
    it('出口名を全文そのまま持つ', () => {
      const exits = '中央西改札（京王口）・小田急線のりかえ口・ミライナタワー改札';
      const { groups } = layoutConcoursePlates(
        [concourse('c1', { exits, cells: cellsAt(50) })],
        BOUNDS,
      );

      expect(groups[0]!.exit).toBe(exits);
    });

    it('乗換先の路線を1件も畳まない', () => {
      const lineNames = ['JR山手線', 'JR中央線', 'JR埼京線', 'JR湘南新宿ライン', '小田急線', '京王線'];
      const { groups } = layoutConcoursePlates(
        [
          concourse('c1', {
            cells: cellsAt(50),
            connections: [connection({ lineNames, lineColors: lineNames.map(() => null) })],
          }),
        ],
        BOUNDS,
      );

      expect(groups[0]!.transfers[0]!.lines.map((l) => l.name)).toEqual(lineNames);
      expect(groups[0]!.transfers[0]!.lines.every((l) => l.color === DEFAULT_LINE_COLOR)).toBe(true);
    });

    it('複数の接続をすべて持つ', () => {
      const { groups } = layoutConcoursePlates(
        [
          concourse('c1', {
            cells: cellsAt(50),
            connections: [connection(), connection({ stationName: '代々木' })],
          }),
        ],
        BOUNDS,
      );

      expect(groups[0]!.transfers).toHaveLength(2);
    });

    it('設備の種別名を重複なく持つ（束ね線との対応を文章で示すため）', () => {
      const facility = (typeCode: string, typeName: string) => ({
        id: typeCode,
        typeCode,
        typeName,
        isWheelchairAccessible: true,
        isStrollerAccessible: true,
      });
      const { groups } = layoutConcoursePlates(
        [
          concourse('c1', {
            cells: [
              { xPositionMeters: 40, facilities: [facility('elevator', 'エレベーター')] },
              { xPositionMeters: 80, facilities: [facility('elevator', 'エレベーター'), facility('stairs', '階段')] },
            ],
          }),
        ],
        BOUNDS,
      );

      expect(groups[0]!.facilityTypeNames).toEqual(['エレベーター', '階段']);
    });
  });

  describe('段の割り当て', () => {
    it('離れたコンコースは同じ段に並ぶ', () => {
      const { groups, laneCount } = layoutConcoursePlates(
        [concourse('a', { cells: cellsAt(10) }), concourse('b', { cells: cellsAt(280) })],
        BOUNDS,
      );

      expect(groups.map((g) => g.lane)).toEqual([0, 0]);
      expect(laneCount).toBe(1);
    });

    it('近接したコンコースは段を分ける', () => {
      const { groups, laneCount } = layoutConcoursePlates(
        [concourse('a', { cells: cellsAt(100) }), concourse('b', { cells: cellsAt(104) })],
        BOUNDS,
      );

      expect(groups.map((g) => g.lane)).toEqual([0, 1]);
      expect(laneCount).toBe(2);
    });

    it('対象が無ければ段数0', () => {
      expect(layoutConcoursePlates([], BOUNDS).laneCount).toBe(0);
    });
  });

  describe('端寄せ', () => {
    it('描画範囲の中ほどでは中央寄せ', () => {
      const { groups } = layoutConcoursePlates([concourse('c1', { cells: cellsAt(150) })], BOUNDS);
      expect(groups[0]!.align).toBe('center');
    });

    it('左端にはみ出すなら start に寄せる', () => {
      const { groups } = layoutConcoursePlates([concourse('c1', { cells: cellsAt(-18) })], BOUNDS);
      expect(groups[0]!.align).toBe('start');
    });

    it('右端にはみ出すなら end に寄せる', () => {
      const { groups } = layoutConcoursePlates([concourse('c1', { cells: cellsAt(318) })], BOUNDS);
      expect(groups[0]!.align).toBe('end');
    });
  });
});

describe('layoutFacingBanners', () => {
  const facing = (overrides: Partial<FacilityConnectionDTO> = {}) =>
    connection({ xRangeStart: 40, xRangeEnd: 120, ...overrides });

  it('座標範囲が両端とも揃った接続だけを対象にする', () => {
    const { banners } = layoutFacingBanners(
      [
        concourse('c1', {
          connections: [
            facing(),
            connection({ xRangeStart: 40, xRangeEnd: null }),
            connection({ xRangeStart: null, xRangeEnd: 120 }),
            connection(),
          ],
        }),
      ],
      BOUNDS,
    );

    expect(banners).toHaveLength(1);
  });

  it('案内文と代表色を持つ', () => {
    const { banners } = layoutFacingBanners(
      [
        concourse('c1', {
          connections: [facing({ lineNames: ['丸ノ内線'], lineColors: ['#F62E36'], directionName: '池袋' })],
        }),
      ],
      BOUNDS,
    );

    expect(banners[0]!.text).toBe('丸ノ内線（池袋方面）は同じホームの向かい側に到着');
    expect(banners[0]!.color).toBe('#F62E36');
  });

  it('範囲が逆順に登録されていても正規化する', () => {
    const { banners } = layoutFacingBanners(
      [concourse('c1', { connections: [facing({ xRangeStart: 120, xRangeEnd: 40 })] })],
      BOUNDS,
    );

    expect(banners[0]!.startX).toBe(40);
    expect(banners[0]!.endX).toBe(120);
  });

  it('範囲が重なるバナーは段を分ける', () => {
    const { banners, laneCount } = layoutFacingBanners(
      [
        concourse('c1', {
          connections: [facing(), facing({ stationName: '代々木', xRangeStart: 60, xRangeEnd: 200 })],
        }),
      ],
      BOUNDS,
    );

    expect(banners.map((b) => b.lane)).toEqual([0, 1]);
    expect(laneCount).toBe(2);
  });

  it('startX 昇順で返す', () => {
    const { banners } = layoutFacingBanners(
      [
        concourse('c1', {
          connections: [
            facing({ xRangeStart: 200, xRangeEnd: 260 }),
            facing({ stationName: '代々木', xRangeStart: 10, xRangeEnd: 60 }),
          ],
        }),
      ],
      BOUNDS,
    );

    expect(banners.map((b) => b.startX)).toEqual([10, 200]);
  });

  it('対象が無ければ段数0', () => {
    expect(layoutFacingBanners([concourse('c1')], BOUNDS).laneCount).toBe(0);
  });
});

describe('レイアウト定数', () => {
  it('プレート幅の下限が上限を超えない', () => {
    expect(PLATE_MIN_WIDTH_PX).toBeLessThan(PLATE_MAX_WIDTH_PX);
  });

  it('プレートの最大幅がキャンバス幅に収まる', () => {
    expect(PLATE_MAX_WIDTH_PX).toBeLessThan(CANVAS_PX);
  });

  it('段の間隔が正の値である', () => {
    expect(PLATE_GAP_PX).toBeGreaterThan(0);
  });
});
