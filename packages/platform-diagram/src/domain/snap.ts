import type { Bounds } from './geometry';
import { doorCentersX } from './consist';
import type { StopPatternCarDTO } from './types';

// 図上編集（admin の DiagramEditLayer）が使う px↔m 変換とスナップの純関数。
// ドラッグstate・Alt検出・bounds凍結はここに置かない（admin側の責務。ADR-0010参照）。

/** ドラッグを丸めるグリッド幅（メートル）。候補に吸着しない場合はこの倍数に丸める */
export const SNAP_GRID_METERS = 0.5;

/** 候補（号車境界・ドア中心・0・physicalLength）に吸着する許容距離（メートル）。5px/m での2px相当 */
export const SNAP_TOLERANCE_METERS = 0.4;

/**
 * decimal(6,2) の精度に丸める（四捨五入。負値は絶対値方向へ）。
 * DBに保存する直前・draft の表示直前の両方で使う。
 *
 * `x * 100` は二進浮動小数点の丸め誤差で `.5` ちょうどのつもりの値が
 * わずかに小さく（例: 1.005 → 100.49999999999999）表現されることがあり、
 * 素の Math.round だとその誤差ぶん切り捨て側にずれる。極小のイプシロンを
 * 0.5 側へ加えて吸収する。
 */
export function roundToDecimal2(x: number): number {
  const scaled = x * 100;
  const rounded = x >= 0
    ? Math.floor(scaled + 0.5 + 1e-9)
    : Math.ceil(scaled - 0.5 - 1e-9);
  return rounded / 100;
}

/**
 * キャンバス上のピクセルオフセットをホーム座標（メートル）に変換する。
 *
 * xFraction(x, bounds) * canvasWidthPx の厳密な逆関数。canvasWidthPx はキャンバスの
 * min-width ではなく実測幅（getBoundingClientRect().width）を渡すこと
 * （コンテナが広ければキャンバスは min-width を超えて伸びるため）。
 *
 * canvasWidthPx が 0 以下（未計測・縮退ケース）では bounds.minX を返す。
 */
export function pxToMeters(px: number, bounds: Bounds, canvasWidthPx: number): number {
  if (canvasWidthPx <= 0) return bounds.minX;
  const width = bounds.maxX - bounds.minX;
  return bounds.minX + (px / canvasWidthPx) * width;
}

/**
 * ドラッグ中の生座標を、号車境界・ドア中心などの候補にスナップするか
 * 0.5m グリッドへ丸める（純関数）。
 *
 * 候補のうち許容範囲（toleranceMeters）内で最も近いものがあればそこへ吸着する。
 * 同着（等距離）の場合は値の小さい候補を選ぶ（決定性のため）。
 * 候補が無い・範囲内に無い場合は gridMeters の倍数へ丸める。
 *
 * [0, physicalLength] の範囲外・負の座標も候補やグリッドの対象として扱い、
 * クランプは一切行わない（docs/domain/platform-coordinate-system.md「座標の範囲」）。
 */
export function snapMeters(
  raw: number,
  candidates: number[],
  opts: { gridMeters: number; toleranceMeters: number },
): number {
  let nearest: number | undefined;
  let nearestDistance = Infinity;

  for (const candidate of candidates) {
    const distance = Math.abs(raw - candidate);
    if (distance > opts.toleranceMeters) continue;
    if (
      distance < nearestDistance
      || (distance === nearestDistance && nearest !== undefined && candidate < nearest)
    ) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  if (nearest !== undefined) return nearest;

  return Math.round(raw / opts.gridMeters) * opts.gridMeters;
}

/**
 * スナップ候補（号車境界・全ドア中心・0・physicalLength）を算出する（純関数）。
 *
 * exclude は自己吸着防止のために渡す。号車境界をドラッグするとき、その境界自身
 * （と連動して動く隣接号車側の座標）を候補から除かないと、必ず元の位置に
 * 吸い付いて動かせなくなる。
 */
export function snapCandidates(
  cars: Pick<StopPatternCarDTO, 'startMeters' | 'endMeters' | 'doorCount'>[],
  physicalLength: number,
  options: { exclude?: number[] } = {},
): number[] {
  const exclude = new Set(options.exclude ?? []);
  const raw = [0, physicalLength];

  for (const car of cars) {
    raw.push(car.startMeters, car.endMeters, ...doorCentersX(car));
  }

  return [...new Set(raw.filter((x) => !exclude.has(x)))].sort((a, b) => a - b);
}
