import { describe, it, expect } from 'vitest';
import { doorCenterX, doorCentersX, freeSpaceMarks } from './consist';
import { isDoorOrderReversed } from './doorOrder';

// 20m・4ドアの標準的な号車。スロット幅5m、中心は 2.5 / 7.5 / 12.5 / 17.5
const car = { startMeters: 0, endMeters: 20, doorCount: 4 };

describe('doorCenterX', () => {
  it('スロットの左端ではなく中心を返す', () => {
    // 旧実装は start + (d / doorCount) * width でスロット左端（0, 5, 10, 15）を返していた
    expect(doorCenterX(car, 1, false)).toBe(2.5);
    expect(doorCenterX(car, 4, false)).toBe(17.5);
  });

  it('正順ではドア番号が左から振られる', () => {
    expect([1, 2, 3, 4].map((n) => doorCenterX(car, n, false))).toEqual([2.5, 7.5, 12.5, 17.5]);
  });

  it('反転編成ではドア番号が右から振られる', () => {
    expect([1, 2, 3, 4].map((n) => doorCenterX(car, n, true))).toEqual([17.5, 12.5, 7.5, 2.5]);
  });

  it.each([3, 4, 6])('ドア数%iでも号車の内側に収まり左右対称になる', (doorCount) => {
    const c = { startMeters: 100, endMeters: 120, doorCount };
    const centers = Array.from({ length: doorCount }, (_, i) => doorCenterX(c, i + 1, false));

    expect(Math.min(...centers)).toBeGreaterThan(c.startMeters);
    expect(Math.max(...centers)).toBeLessThan(c.endMeters);
    // 先頭と末尾が号車の中心から等距離
    const mid = (c.startMeters + c.endMeters) / 2;
    expect(mid - centers[0]!).toBeCloseTo(centers[centers.length - 1]! - mid);
  });

  it('正順と反転はドア番号を反転させた関係になる', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(doorCenterX(car, n, true)).toBeCloseTo(doorCenterX(car, car.doorCount + 1 - n, false));
    }
  });

  it('号車の開始位置が0でなくても正しく写る', () => {
    expect(doorCenterX({ startMeters: 40, endMeters: 60, doorCount: 4 }, 1, false)).toBe(42.5);
  });

  it('isDoorOrderReversed の結果をそのまま渡せる', () => {
    const cars = [
      { carNumber: 1, startMeters: 80 },
      { carNumber: 2, startMeters: 60 },
      { carNumber: 3, startMeters: 40 },
    ];
    const reversed = isDoorOrderReversed(cars);

    expect(reversed).toBe(true);
    expect(doorCenterX({ startMeters: 80, endMeters: 100, doorCount: 4 }, 1, reversed)).toBe(97.5);
  });
});

describe('doorCentersX', () => {
  it('左から順に全ドアの中心を返す', () => {
    expect(doorCentersX(car)).toEqual([2.5, 7.5, 12.5, 17.5]);
  });

  it('ドア数ぶんの要素を返す', () => {
    expect(doorCentersX({ startMeters: 0, endMeters: 20, doorCount: 6 })).toHaveLength(6);
  });
});

describe('freeSpaceMarks', () => {
  it('フリースペースのあるドアだけを x 昇順で返す', () => {
    const marks = freeSpaceMarks(
      { ...car, freeSpaceDoors: [{ nearDoor: 3, isStandard: true }, { nearDoor: 1, isStandard: true }] },
      false,
    );

    expect(marks.map((m) => m.x)).toEqual([2.5, 12.5]);
  });

  it('同じドアに全編成と一部編成が登録されていたら全編成を優先する', () => {
    const marks = freeSpaceMarks(
      {
        ...car,
        freeSpaceDoors: [
          { nearDoor: 2, isStandard: false },
          { nearDoor: 2, isStandard: true },
        ],
      },
      false,
    );

    expect(marks).toEqual([{ doorNumber: 2, x: 7.5, isStandard: true }]);
  });

  it('一部編成だけのドアは isStandard: false のまま残る', () => {
    const marks = freeSpaceMarks({ ...car, freeSpaceDoors: [{ nearDoor: 2, isStandard: false }] }, false);

    expect(marks).toEqual([{ doorNumber: 2, x: 7.5, isStandard: false }]);
  });

  it('反転編成でも x 昇順で返す', () => {
    const marks = freeSpaceMarks(
      { ...car, freeSpaceDoors: [{ nearDoor: 1, isStandard: true }, { nearDoor: 4, isStandard: true }] },
      true,
    );

    expect(marks.map((m) => m.x)).toEqual([2.5, 17.5]);
    expect(marks.map((m) => m.doorNumber)).toEqual([4, 1]);
  });

  it('フリースペースが無ければ空配列を返す', () => {
    expect(freeSpaceMarks({ ...car, freeSpaceDoors: [] }, false)).toEqual([]);
  });
});
