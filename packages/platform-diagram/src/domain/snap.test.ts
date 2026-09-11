import { describe, it, expect } from 'vitest';
import {
  roundToDecimal2, pxToMeters, snapMeters, snapCandidates, SNAP_GRID_METERS, SNAP_TOLERANCE_METERS,
} from './snap';
import { xFraction, PX_PER_METER, type Bounds } from './geometry';

const BOUNDS: Bounds = { minX: -5, maxX: 45 };

describe('roundToDecimal2', () => {
  it('小数第3位を四捨五入する', () => {
    expect(roundToDecimal2(1.005)).toBeCloseTo(1.01);
    expect(roundToDecimal2(1.234)).toBeCloseTo(1.23);
    expect(roundToDecimal2(1.235)).toBeCloseTo(1.24);
  });

  it('負の値でも絶対値方向に丸まる', () => {
    expect(roundToDecimal2(-1.235)).toBeCloseTo(-1.24);
  });

  it('浮動小数点の誤差を含む値が期待どおりに丸まる', () => {
    // 0.1 + 0.2 は素の JS では 0.30000000000000004 になる
    expect(roundToDecimal2(0.1 + 0.2)).toBe(0.3);
  });

  it('既に2桁の値は変化しない', () => {
    expect(roundToDecimal2(12.5)).toBe(12.5);
  });
});

describe('pxToMeters', () => {
  it('xFraction で求めた割合に戻すと元のメートル値に一致する', () => {
    const canvasWidthPx = (BOUNDS.maxX - BOUNDS.minX) * PX_PER_METER;
    for (const x of [-5, 0, 12.5, 40, 45]) {
      const px = xFraction(x, BOUNDS) * canvasWidthPx;
      expect(pxToMeters(px, BOUNDS, canvasWidthPx)).toBeCloseTo(x);
    }
  });

  it('左端0pxは bounds.minX を返す', () => {
    const canvasWidthPx = (BOUNDS.maxX - BOUNDS.minX) * PX_PER_METER;
    expect(pxToMeters(0, BOUNDS, canvasWidthPx)).toBeCloseTo(BOUNDS.minX);
  });

  it('右端はbounds.maxXを返す', () => {
    const canvasWidthPx = (BOUNDS.maxX - BOUNDS.minX) * PX_PER_METER;
    expect(pxToMeters(canvasWidthPx, BOUNDS, canvasWidthPx)).toBeCloseTo(BOUNDS.maxX);
  });

  it('キャンバス幅が0のときは bounds.minX を返す', () => {
    // jsdom で getBoundingClientRect() が未計測のまま0を返す縮退ケース
    expect(pxToMeters(100, BOUNDS, 0)).toBe(BOUNDS.minX);
  });

  it('描画範囲の幅が0のときは bounds.minX を返す', () => {
    const zeroWidth: Bounds = { minX: 10, maxX: 10 };
    expect(pxToMeters(50, zeroWidth, 200)).toBe(10);
  });

  it('キャンバス幅が width * PX_PER_METER のとき1pxが 1/PX_PER_METER メートルに対応する', () => {
    const canvasWidthPx = (BOUNDS.maxX - BOUNDS.minX) * PX_PER_METER;
    const a = pxToMeters(100, BOUNDS, canvasWidthPx);
    const b = pxToMeters(101, BOUNDS, canvasWidthPx);
    expect(b - a).toBeCloseTo(1 / PX_PER_METER);
  });
});

describe('snapMeters', () => {
  const opts = { gridMeters: SNAP_GRID_METERS, toleranceMeters: SNAP_TOLERANCE_METERS };

  it('どの候補からも離れた値はグリッドの倍数へ丸まる', () => {
    expect(snapMeters(10.2, [], opts)).toBe(10);
    expect(snapMeters(10.3, [], opts)).toBeCloseTo(10.5);
  });

  it('許容範囲内の号車境界に吸着する', () => {
    // 号車境界 20m のすぐ近く。20.5m グリッドより境界20mのほうが近い
    expect(snapMeters(20.1, [20], opts)).toBe(20);
  });

  it('許容範囲内のドア中心に吸着する', () => {
    expect(snapMeters(2.6, [2.5, 7.5, 12.5, 17.5], opts)).toBe(2.5);
  });

  it('許容範囲外の候補には吸着せずグリッドへ丸まる', () => {
    // 候補20mまでの距離は0.5m > SNAP_TOLERANCE_METERS(0.4m)
    const raw = 20.5;
    expect(snapMeters(raw, [20], opts)).toBeCloseTo(Math.round(raw / SNAP_GRID_METERS) * SNAP_GRID_METERS);
    expect(snapMeters(raw, [20], opts)).not.toBe(20);
  });

  it('許容範囲ちょうどの距離では候補に吸着する', () => {
    expect(snapMeters(20 + SNAP_TOLERANCE_METERS, [20], opts)).toBe(20);
  });

  it('複数候補が許容範囲内にあるとき最も近い候補を選ぶ', () => {
    expect(snapMeters(20.35, [20, 20.6], opts)).toBe(20.6);
  });

  it('等距離の候補が2つあるとき小さい側を選ぶ', () => {
    expect(snapMeters(20, [20 - 0.2, 20 + 0.2], opts)).toBe(19.8);
  });

  it('候補が空配列ならスナップ無効化と同じ挙動（グリッド丸めのみ）になる', () => {
    // Alt押下相当。DiagramEditLayer は Alt 押下時に候補を渡さない設計にする
    expect(snapMeters(20.1, [], opts)).toBe(20);
  });

  it('許容距離0を渡すとどの候補にも吸着しない', () => {
    // raw=20.1 はグリッド丸め自体が20になってしまい候補吸着の有無を区別できないため、
    // グリッド丸めた結果が20と異なる値（20.5）になる raw を使う
    expect(snapMeters(20.3, [20], { gridMeters: SNAP_GRID_METERS, toleranceMeters: 0 })).toBeCloseTo(20.5);
  });

  it('負座標でもグリッド丸め・候補吸着が対称に働く', () => {
    expect(snapMeters(-10.2, [], opts)).toBe(-10);
    expect(snapMeters(-4.9, [-5], opts)).toBe(-5);
  });

  it('physicalLengthを超える値でも丸めるだけでクランプしない', () => {
    expect(snapMeters(250.2, [], opts)).toBe(250);
  });

  it('候補 0 と physicalLength に吸着する', () => {
    expect(snapMeters(0.1, [0, 40], opts)).toBe(0);
    expect(snapMeters(39.9, [0, 40], opts)).toBe(40);
  });
});

describe('snapCandidates', () => {
  const cars = [
    { startMeters: 0, endMeters: 20, doorCount: 4 },
    { startMeters: 20, endMeters: 40, doorCount: 4 },
  ];

  it('全号車の境界・全ドア中心・0・physicalLength を含む', () => {
    const candidates = snapCandidates(cars, 40);

    expect(candidates).toContain(0);
    expect(candidates).toContain(20);
    expect(candidates).toContain(40);
    expect(candidates).toContain(2.5); // 1号車 1番ドア中心
    expect(candidates).toContain(37.5); // 2号車 4番ドア中心
  });

  it('exclude に渡した座標を含まない', () => {
    const candidates = snapCandidates(cars, 40, { exclude: [20] });
    expect(candidates).not.toContain(20);
  });

  it('重複を除去して昇順で返す', () => {
    // 1号車の endMeters と 2号車の startMeters がどちらも20で重複する
    const candidates = snapCandidates(cars, 40);
    expect(candidates.filter((x) => x === 20)).toHaveLength(1);
    expect(candidates).toEqual([...candidates].sort((a, b) => a - b));
  });

  it('号車が1件も無くても 0 と physicalLength を返す', () => {
    expect(snapCandidates([], 40)).toEqual([0, 40]);
  });
});
