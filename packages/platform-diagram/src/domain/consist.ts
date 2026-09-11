import type { StopPatternCarDTO } from './types';

// 編成の中の「ドア1枚ぶんの位置」をホーム座標（メートル）で求める。
// 乗車位置目標をドアの真上に打つために要る。

/**
 * ドア番号（1始まり）から、そのドアの**中心**のホーム座標を求める（純関数）。
 *
 * 号車をドア数で等分したスロットの中心を返す。ドアの実寸位置は持っていないので、
 * 等間隔と見なした近似である。
 *
 * @param reversed 号車が x 降順に並んでいるか（isDoorOrderReversed() の結果）。
 *   ドア番号は進行方向を基準に振られるため、編成が反転していれば
 *   1番ドアは号車の右端側に来る。
 */
export function doorCenterX(
  car: Pick<StopPatternCarDTO, 'startMeters' | 'endMeters' | 'doorCount'>,
  doorNumber: number,
  reversed: boolean,
): number {
  const width = car.endMeters - car.startMeters;
  // 左→右のスロット index。reversed のときドア番号が右から振られる
  const slot = reversed ? car.doorCount - doorNumber : doorNumber - 1;
  return car.startMeters + ((slot + 0.5) / car.doorCount) * width;
}

/**
 * フリースペースのあるドアの中心座標を、号車内で昇順に返す。
 *
 * 同じドアに全編成ぶんと一部編成ぶんの両方が登録されうるので、
 * ドア番号で重複を除き、1つでも「全編成」があればそちらを優先する
 * （利用者にとっては「確実にある」ほうが強い情報）。
 */
export function freeSpaceMarks(
  car: Pick<StopPatternCarDTO, 'startMeters' | 'endMeters' | 'doorCount' | 'freeSpaceDoors'>,
  reversed: boolean,
): { doorNumber: number; x: number; isStandard: boolean }[] {
  const byDoor = new Map<number, boolean>();
  for (const door of car.freeSpaceDoors) {
    byDoor.set(door.nearDoor, (byDoor.get(door.nearDoor) ?? false) || door.isStandard);
  }

  return [...byDoor.entries()]
    .map(([doorNumber, isStandard]) => ({
      doorNumber,
      x: doorCenterX(car, doorNumber, reversed),
      isStandard,
    }))
    .sort((a, b) => a.x - b.x);
}

/** 号車内の全ドアの中心座標を、左から順に返す（乗車位置目標の下地） */
export function doorCentersX(
  car: Pick<StopPatternCarDTO, 'startMeters' | 'endMeters' | 'doorCount'>,
): number[] {
  const width = car.endMeters - car.startMeters;
  return Array.from(
    { length: car.doorCount },
    (_, slot) => car.startMeters + ((slot + 0.5) / car.doorCount) * width,
  );
}
