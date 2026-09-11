// ドア番号の反転表示・先頭車の向きを導出する純関数（DB非依存）。
// docs/domain/platform-coordinate-system.md「号車の向き」:
// 「向きを表すカラムは持たない。cars を carNumber 昇順に並べたときの startMeters が
// 減少していれば反転、として導出する」

export type CarPosition = { carNumber: number; startMeters: number };

/**
 * carNumber 昇順に並べたとき、startMeters が減少していれば true（ドア番号・号車の並びが反転）。
 * 号車が1件以下の場合は反転の概念が無いため false を返す。
 */
export function isDoorOrderReversed(cars: CarPosition[]): boolean {
  if (cars.length < 2) return false;
  const sorted = [...cars].sort((a, b) => a.carNumber - b.carNumber);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return last.startMeters < first.startMeters;
}
