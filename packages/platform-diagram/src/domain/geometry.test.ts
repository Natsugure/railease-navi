import { describe, it, expect } from 'vitest';
import {
  computeBounds,
  layoutRows,
  xFraction,
  FACILITY_ROW_HEIGHT,
  GAP_Y,
  MARGIN_METERS,
  PLATFORM_BAR_HEIGHT,
  PLATFORM_LABEL_FONT_SIZE,
  TRAIN_ROW_HEIGHT,
  CONCOURSE_TICK_HEIGHT,
} from './geometry';
import type { TrainStopPatternDTO, ConcourseDTO } from './types';

function pattern(cars: { carNumber: number; startMeters: number; endMeters: number }[]): Pick<TrainStopPatternDTO, 'cars'> {
  return {
    cars: cars.map((c) => ({
      ...c,
      doorCount: 4,
      freeSpaceDoors: [],
      prioritySeatDoors: [],
    })),
  };
}

function concourse(
  cells: { xPositionMeters: number | null }[],
  connections: { xRangeStart: number | null; xRangeEnd: number | null }[] = [],
): Pick<ConcourseDTO, 'cells' | 'connections'> {
  return {
    cells: cells.map((c) => ({ ...c, facilities: [] })),
    connections: connections.map((c) => ({
      ...c,
      stationName: '',
      lineNames: [],
      lineColors: [],
      directionName: null,
      exitLabel: null,
    })),
  };
}

describe('computeBounds', () => {
  it('[0, physicalLength] を常に描画範囲に含める（設備・停車位置パターンが0件でも）', () => {
    const bounds = computeBounds(210, [], []);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 210 + MARGIN_METERS });
  });

  it('停車位置パターンが0件でもホームだけが描画される', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: 50 }])]);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('車両の停車範囲外（physicalLength超過）の設備を範囲に含める', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: 150 }])]);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 150 + MARGIN_METERS });
  });

  it('負座標の設備を範囲に含める', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: -20 }])]);
    expect(bounds).toEqual({ minX: -20 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('xPositionMeters が null（コンコース全体）の設備は範囲計算の対象にしない', () => {
    const bounds = computeBounds(100, [], [concourse([{ xPositionMeters: null }])]);
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('physicalLength を超える停車位置パターンを範囲に含める', () => {
    const bounds = computeBounds(
      100,
      [pattern([{ carNumber: 1, startMeters: 90, endMeters: 130 }])],
      [],
    );
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 130 + MARGIN_METERS });
  });

  it('負のstartMetersを持つ停車位置パターンを範囲に含める（頭端式ホーム等）', () => {
    const bounds = computeBounds(
      100,
      [pattern([{ carNumber: 1, startMeters: -15, endMeters: 5 }])],
      [],
    );
    expect(bounds).toEqual({ minX: -15 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('対面乗換帯（xRangeStart/xRangeEnd）を範囲に含める', () => {
    const bounds = computeBounds(
      100,
      [],
      [concourse([], [{ xRangeStart: -10, xRangeEnd: 20 }])],
    );
    expect(bounds).toEqual({ minX: -10 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('xRangeStart/xRangeEnd が片方でもnullの対面乗換帯は範囲計算の対象にしない', () => {
    const bounds = computeBounds(
      100,
      [],
      [concourse([], [{ xRangeStart: 500, xRangeEnd: null }])],
    );
    expect(bounds).toEqual({ minX: 0 - MARGIN_METERS, maxX: 100 + MARGIN_METERS });
  });

  it('複数の設備・パターンから最小・最大を正しく求める', () => {
    const bounds = computeBounds(
      100,
      [
        pattern([
          { carNumber: 1, startMeters: -5, endMeters: 15 },
          { carNumber: 2, startMeters: 15, endMeters: 35 },
        ]),
      ],
      [concourse([{ xPositionMeters: 120 }, { xPositionMeters: 3 }])],
    );
    expect(bounds).toEqual({ minX: -5 - MARGIN_METERS, maxX: 120 + MARGIN_METERS });
  });
});

describe('layoutRows', () => {
  const sides = [
    { name: "platformSide='top'", side: 'top' as const },
    { name: "platformSide='bottom'", side: 'bottom' as const },
    { name: 'platformSide未設定(null)', side: null },
  ];

  // ラベルの text.y はベースライン。実際の文字の張り出しはフォント依存なので、
  // 一般的な欧文フォントの ascent/descent を上回る値で概算し、安全側に倒す。
  const labelExtent = (platformLabelY: number) => ({
    top: platformLabelY - PLATFORM_LABEL_FONT_SIZE,
    bottom: platformLabelY + PLATFORM_LABEL_FONT_SIZE * 0.3,
  });

  describe.each(sides)('$name', ({ side }) => {
    it('すべての描画要素が viewBox の高さに収まる', () => {
      const { facilityY, trainY, facingBandY, facingBandHeight, platformBarY, platformLabelY, viewHeight } =
        layoutRows(side);
      const label = labelExtent(platformLabelY);

      const spans: [string, number, number][] = [
        ['設備行', facilityY, facilityY + FACILITY_ROW_HEIGHT],
        ['列車行', trainY, trainY + TRAIN_ROW_HEIGHT],
        ['対面乗換ティント', facingBandY, facingBandY + facingBandHeight],
        ['ホーム帯', platformBarY, platformBarY + PLATFORM_BAR_HEIGHT],
        ['両端ラベル', label.top, label.bottom],
      ];

      const outOfView = spans.filter(([, top, bottom]) => top < 0 || bottom > viewHeight).map(([name]) => name);
      expect(outOfView).toEqual([]);
    });

    it('設備行と列車行が重ならない', () => {
      const { facilityY, trainY } = layoutRows(side);
      const facilityIsAbove = facilityY < trainY;
      expect(
        facilityIsAbove
          ? facilityY + FACILITY_ROW_HEIGHT <= trainY
          : trainY + TRAIN_ROW_HEIGHT <= facilityY,
      ).toBe(true);
    });

    it('対面乗換ティントが列車の端から設備行の外端までのホーム側全体を覆う', () => {
      const { facilityY, trainY, facingBandY, facingBandHeight } = layoutRows(side);
      const facilityIsAbove = facilityY < trainY;
      const platformEdge = facilityIsAbove ? trainY : trainY + TRAIN_ROW_HEIGHT;
      const facilityOuterEdge = facilityIsAbove ? facilityY : facilityY + FACILITY_ROW_HEIGHT;

      expect(facingBandY).toBeCloseTo(Math.min(platformEdge, facilityOuterEdge));
      expect(facingBandY + facingBandHeight).toBeCloseTo(Math.max(platformEdge, facilityOuterEdge));
      // 隙間だけでなく設備行ぶんも覆っている
      expect(facingBandHeight).toBeCloseTo(GAP_Y + FACILITY_ROW_HEIGHT);
    });

    it('ホーム帯が対面乗換ティントの範囲に含まれる', () => {
      const { facingBandY, facingBandHeight, platformBarY } = layoutRows(side);

      expect(platformBarY).toBeGreaterThanOrEqual(facingBandY);
      expect(platformBarY + PLATFORM_BAR_HEIGHT).toBeLessThanOrEqual(facingBandY + facingBandHeight);
    });

    it('ホーム帯と両端ラベルが列車行から見て設備行と同じ側にある', () => {
      const { facilityY, trainY, platformBarY, platformLabelY } = layoutRows(side);
      const label = labelExtent(platformLabelY);

      if (facilityY < trainY) {
        // ホームが上側: ホーム帯・ラベルは列車の上端より上
        expect(platformBarY + PLATFORM_BAR_HEIGHT).toBeLessThanOrEqual(trainY);
        expect(label.bottom).toBeLessThanOrEqual(trainY);
      } else {
        // ホームが下側: ホーム帯・ラベルは列車の下端より下
        expect(platformBarY).toBeGreaterThanOrEqual(trainY + TRAIN_ROW_HEIGHT);
        expect(label.top).toBeGreaterThanOrEqual(trainY + TRAIN_ROW_HEIGHT);
      }
    });

    // 文字の張り出しぶんまではフォント依存で厳密に保証できないため、
    // ベースラインがホーム帯の外側にあること（= 文字が帯の上に乗らないこと）を見る。
    it('両端ラベルのベースラインがホーム帯の外側にある', () => {
      const { trainY, facilityY, platformBarY, platformLabelY } = layoutRows(side);

      if (facilityY < trainY) {
        expect(platformLabelY).toBeLessThanOrEqual(platformBarY);
      } else {
        expect(platformLabelY).toBeGreaterThanOrEqual(platformBarY + PLATFORM_BAR_HEIGHT);
      }
    });
  });

  it("platformSide='top' では設備行が列車行より上に来る", () => {
    const { facilityY, trainY } = layoutRows('top');
    expect(facilityY).toBeLessThan(trainY);
  });

  it("platformSide='bottom' では設備行が列車行より下に来る", () => {
    const { facilityY, trainY } = layoutRows('bottom');
    expect(facilityY).toBeGreaterThan(trainY);
  });

  it("platformSide未設定(null)は 'bottom' と同じレイアウトになる", () => {
    expect(layoutRows(null)).toEqual(layoutRows('bottom'));
  });

  it("platformSide の 'top' / 'bottom' で上下が反転する", () => {
    const top = layoutRows('top');
    const bottom = layoutRows('bottom');

    // viewBox の中心線に対して線対称になっている
    const mirror = (y: number, height: number) => top.viewHeight - (y + height);
    expect(mirror(top.facilityY, FACILITY_ROW_HEIGHT)).toBeCloseTo(bottom.facilityY);
    expect(mirror(top.trainY, TRAIN_ROW_HEIGHT)).toBeCloseTo(bottom.trainY);
    expect(mirror(top.facingBandY, top.facingBandHeight)).toBeCloseTo(bottom.facingBandY);
    expect(mirror(top.platformBarY, PLATFORM_BAR_HEIGHT)).toBeCloseTo(bottom.platformBarY);
  });
  describe('コンコース束ね線', () => {
    it('束ね線が無いとき高さは加算されず、束ね線も引かない', () => {
      const layout = layoutRows('top', { hasConcourseLeaders: false });

      expect(layout.concourseBracketY).toBeNull();
      expect(layout.concourseTickStartY).toBeNull();
      // 束ね線導入前の高さ（マージン2 + 設備8 + 隙間2 + 列車10）と一致する
      expect(layout.viewHeight).toBe(2 + FACILITY_ROW_HEIGHT + GAP_Y + TRAIN_ROW_HEIGHT);
    });

    it('オプションを省略した場合は束ね線無しとして扱う', () => {
      expect(layoutRows('top')).toEqual(layoutRows('top', { hasConcourseLeaders: false }));
    });

    it('束ね線があるとき viewHeight はヒゲぶんだけ伸びる', () => {
      const base = layoutRows('top', { hasConcourseLeaders: false }).viewHeight;
      expect(layoutRows('top', { hasConcourseLeaders: true }).viewHeight).toBe(
        base + CONCOURSE_TICK_HEIGHT,
      );
    });

    // ラベルはSVGの外（HTMLオーバーレイ）にあるので、件数がいくら増えても
    // SVGの高さは変わらない。これが段を積んでいた頃との決定的な違い。
    it('viewHeight はコンコースの件数に依存しない', () => {
      const withLeaders = layoutRows('bottom', { hasConcourseLeaders: true });
      expect(withLeaders.viewHeight).toBe(2 + FACILITY_ROW_HEIGHT + GAP_Y + TRAIN_ROW_HEIGHT + CONCOURSE_TICK_HEIGHT);
    });

    describe.each(sides)('$name', ({ side }) => {
      it('束ね線が列車行から見て設備行と同じ側にある', () => {
        const { facilityY, trainY, concourseBracketY } = layoutRows(side, { hasConcourseLeaders: true });
        const facilityIsAbove = facilityY < trainY;

        expect(concourseBracketY).not.toBeNull();
        if (facilityIsAbove) {
          expect(concourseBracketY!).toBeLessThanOrEqual(facilityY);
        } else {
          expect(concourseBracketY!).toBeGreaterThanOrEqual(facilityY + FACILITY_ROW_HEIGHT);
        }
      });

      it('縦ヒゲが設備行の外側の端から束ね線まで伸びる', () => {
        const { facilityY, trainY, concourseBracketY, concourseTickStartY } = layoutRows(side, {
          hasConcourseLeaders: true,
        });
        const facilityIsAbove = facilityY < trainY;

        expect(concourseTickStartY).toBe(facilityIsAbove ? facilityY : facilityY + FACILITY_ROW_HEIGHT);
        expect(Math.abs(concourseBracketY! - concourseTickStartY!)).toBeCloseTo(CONCOURSE_TICK_HEIGHT);
      });

      it('束ね線が viewBox の高さに収まる', () => {
        const { concourseBracketY, viewHeight } = layoutRows(side, { hasConcourseLeaders: true });

        expect(concourseBracketY!).toBeGreaterThanOrEqual(0);
        expect(concourseBracketY!).toBeLessThanOrEqual(viewHeight);
      });
    });

    it('束ね線も top / bottom で上下が反転する', () => {
      const top = layoutRows('top', { hasConcourseLeaders: true });
      const bottom = layoutRows('bottom', { hasConcourseLeaders: true });

      expect(top.viewHeight).toBe(bottom.viewHeight);
      expect(top.viewHeight - top.concourseBracketY!).toBeCloseTo(bottom.concourseBracketY!);
    });
  });

  describe('stripOrder', () => {
    it("platformSide='bottom' ではプレートをSVGの下、対面乗換バナーを上に置く", () => {
      // ホームが列車の下にある ＝ 改札へは下方向に歩く。向かい側のホームは上。
      expect(layoutRows('bottom').stripOrder).toEqual(['facing', 'diagram', 'plates']);
    });

    it("platformSide='top' ではプレートをSVGの上、対面乗換バナーを下に置く", () => {
      expect(layoutRows('top').stripOrder).toEqual(['plates', 'diagram', 'facing']);
    });

    it('未設定(null)は bottom と同じ並びになる', () => {
      expect(layoutRows(null).stripOrder).toEqual(layoutRows('bottom').stripOrder);
    });

    it('プレートは常に設備行と同じ側に来る', () => {
      for (const side of ['top', 'bottom', null] as const) {
        const { facilityY, trainY, stripOrder } = layoutRows(side);
        const facilityIsAbove = facilityY < trainY;
        const platesFirst = stripOrder.indexOf('plates') < stripOrder.indexOf('diagram');

        expect(platesFirst).toBe(facilityIsAbove);
      }
    });

    it('3つの帯が過不足なく並ぶ', () => {
      for (const side of ['top', 'bottom', null] as const) {
        expect([...layoutRows(side).stripOrder].sort()).toEqual(['diagram', 'facing', 'plates']);
      }
    });
  });
});

describe('xFraction', () => {
  const bounds = { minX: -20, maxX: 320 };

  it('描画範囲の両端を0と1に写す', () => {
    expect(xFraction(-20, bounds)).toBe(0);
    expect(xFraction(320, bounds)).toBe(1);
  });

  it('中点を0.5に写す', () => {
    expect(xFraction(150, bounds)).toBeCloseTo(0.5);
  });

  it('範囲外の座標も線形に写す（クランプしない）', () => {
    // 範囲外の設備も描画対象に含める仕様なので、0..1 の外へ出ることを許容する
    expect(xFraction(-360, bounds)).toBeCloseTo(-1);
    expect(xFraction(660, bounds)).toBeCloseTo(2);
  });

  it('幅が0に縮退した場合は0を返す', () => {
    expect(xFraction(5, { minX: 5, maxX: 5 })).toBe(0);
  });
});
