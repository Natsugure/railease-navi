import { describe, it, expect } from 'vitest';
import {
  createConcourseDraft, createPatternDraft, moveCell, moveCarBoundary, moveCarEdge,
  isConcourseDirty, isPatternDirty, toPlatformLocationPayload, toStopPatternPayload,
} from './editDraft';
import type { LayoutConcourseDTO, LayoutStopPatternDTO } from '@/features/station-layout/ports';

const MIN_CAR_METERS = 0.5;

// 3号車編成。境界は 20 と 40（1-2号車間、2-3号車間）
const pattern: LayoutStopPatternDTO = {
  patternId: 'pattern-1',
  trainId: 'train-1',
  trainLabel: '東京メトロ銀座線',
  carCount: 3,
  cars: [
    { carNumber: 1, startMeters: 0, endMeters: 20, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
    { carNumber: 2, startMeters: 20, endMeters: 40, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
    { carNumber: 3, startMeters: 40, endMeters: 60, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
  ],
};

// 2アクセス点・1設備・1乗換を持つコンコース
const concourse: LayoutConcourseDTO = {
  id: 'concourse-1',
  exits: 'A3出口',
  notes: '仮設階段あり',
  cells: [
    {
      id: 'cell-1',
      xPositionMeters: 10,
      facilities: [
        {
          id: 'facility-1', typeCode: 'elevator', typeName: 'エレベーター',
          isWheelchairAccessible: true, isStrollerAccessible: null, notes: '朝は使用不可',
        },
      ],
    },
    { id: 'cell-2', xPositionMeters: null, facilities: [] },
  ],
  connections: [
    {
      stationName: '渋谷', connectedStationId: 'station-shibuya', connectedPlatformId: 'platform-shibuya-1',
      directionId: 'direction-1', lineNames: ['田園都市線'], lineColors: ['#00A650'],
      directionName: '渋谷方面', exitLabel: 'A3', xRangeStart: 5, xRangeEnd: 15,
    },
  ],
};

describe('createConcourseDraft', () => {
  it('server DTOのcellをid/xPositionMetersだけのdraftに変換する', () => {
    expect(createConcourseDraft(concourse)).toEqual({
      cells: [
        { id: 'cell-1', xPositionMeters: 10 },
        { id: 'cell-2', xPositionMeters: null },
      ],
    });
  });
});

describe('createPatternDraft', () => {
  it('server DTOのcarsをcarNumber昇順のdraftに変換する', () => {
    expect(createPatternDraft(pattern)).toEqual({
      cars: [
        { carNumber: 1, startMeters: 0, endMeters: 20 },
        { carNumber: 2, startMeters: 20, endMeters: 40 },
        { carNumber: 3, startMeters: 40, endMeters: 60 },
      ],
    });
  });
});

describe('moveCell', () => {
  it('指定したcellのxPositionMetersだけを更新する', () => {
    const draft = createConcourseDraft(concourse);
    const next = moveCell(draft, 'cell-1', 12.5);

    expect(next.cells.find((c) => c.id === 'cell-1')?.xPositionMeters).toBe(12.5);
    expect(next.cells.find((c) => c.id === 'cell-2')?.xPositionMeters).toBeNull();
  });

  it('存在しないcellIdを渡しても無変更で返す', () => {
    const draft = createConcourseDraft(concourse);
    expect(moveCell(draft, 'not-exist', 1)).toEqual(draft);
  });
});

describe('moveCarBoundary', () => {
  it('境界を動かすと隣接号車のend/startが同値で連動する', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarBoundary(draft, 0, 22, { minCarMeters: MIN_CAR_METERS });

    const car1 = next.cars.find((c) => c.carNumber === 1)!;
    const car2 = next.cars.find((c) => c.carNumber === 2)!;
    expect(car1.endMeters).toBe(22);
    expect(car2.startMeters).toBe(22);
    expect(car1.endMeters).toBe(car2.startMeters); // 不変条件そのもの
  });

  it('他の号車には影響しない', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarBoundary(draft, 0, 22, { minCarMeters: MIN_CAR_METERS });
    const car3 = next.cars.find((c) => c.carNumber === 3)!;
    expect(car3).toEqual({ carNumber: 3, startMeters: 40, endMeters: 60 });
  });

  it('右の号車をminCarMeters未満に潰す位置へはクランプされる', () => {
    const draft = createPatternDraft(pattern);
    // 2-3号車境界(40)を59.8へ動かそうとすると3号車が0.2mになってしまう
    const next = moveCarBoundary(draft, 1, 59.8, { minCarMeters: MIN_CAR_METERS });
    const car2 = next.cars.find((c) => c.carNumber === 2)!;
    const car3 = next.cars.find((c) => c.carNumber === 3)!;
    expect(car2.endMeters).toBe(60 - MIN_CAR_METERS);
    expect(car3.startMeters).toBe(60 - MIN_CAR_METERS);
  });

  it('左の号車をminCarMeters未満に潰す位置へはクランプされる', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarBoundary(draft, 0, 0.2, { minCarMeters: MIN_CAR_METERS });
    const car1 = next.cars.find((c) => c.carNumber === 1)!;
    expect(car1.endMeters).toBe(MIN_CAR_METERS);
  });

  it('範囲外のboundaryIndexは無変更で返す（両端は moveCarEdge を使う）', () => {
    const draft = createPatternDraft(pattern);
    expect(moveCarBoundary(draft, -1, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
    expect(moveCarBoundary(draft, 2, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
  });

  it('重なりを許容しない: どの入力でも隣接ペアのend===startが崩れない', () => {
    const draft = createPatternDraft(pattern);
    for (const x of [-100, 0, 19.9, 20, 20.1, 100]) {
      const next = moveCarBoundary(draft, 0, x, { minCarMeters: MIN_CAR_METERS });
      const car1 = next.cars.find((c) => c.carNumber === 1)!;
      const car2 = next.cars.find((c) => c.carNumber === 2)!;
      expect(car1.endMeters).toBe(car2.startMeters);
    }
  });
});

describe('moveCarEdge', () => {
  it('1号車のstart（編成の左端）を単独で動かせる', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarEdge(draft, { carNumber: 1, side: 'start' }, -5, { minCarMeters: MIN_CAR_METERS });
    const car1 = next.cars.find((c) => c.carNumber === 1)!;
    expect(car1.startMeters).toBe(-5);
    expect(car1.endMeters).toBe(20); // end は動かない
  });

  it('最終号車のend（編成の右端）を単独で動かせる', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarEdge(draft, { carNumber: 3, side: 'end' }, 65, { minCarMeters: MIN_CAR_METERS });
    const car3 = next.cars.find((c) => c.carNumber === 3)!;
    expect(car3.endMeters).toBe(65);
    expect(car3.startMeters).toBe(40);
  });

  it('内側の号車の境界を指定すると無変更で返す', () => {
    const draft = createPatternDraft(pattern);
    expect(moveCarEdge(draft, { carNumber: 2, side: 'start' }, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
    expect(moveCarEdge(draft, { carNumber: 1, side: 'end' }, 10, { minCarMeters: MIN_CAR_METERS })).toEqual(draft);
  });

  it('号車を潰す位置へはクランプされる', () => {
    const draft = createPatternDraft(pattern);
    const next = moveCarEdge(draft, { carNumber: 1, side: 'start' }, 19.9, { minCarMeters: MIN_CAR_METERS });
    expect(next.cars.find((c) => c.carNumber === 1)!.startMeters).toBe(20 - MIN_CAR_METERS);
  });
});

describe('isConcourseDirty', () => {
  it('未変更のdraftはdirtyでない', () => {
    expect(isConcourseDirty(concourse, createConcourseDraft(concourse))).toBe(false);
  });

  it('xPositionMetersを変更するとdirtyになる', () => {
    const draft = moveCell(createConcourseDraft(concourse), 'cell-1', 11);
    expect(isConcourseDirty(concourse, draft)).toBe(true);
  });

  it('cell件数が変わるとdirtyになる', () => {
    const draft = createConcourseDraft(concourse);
    expect(isConcourseDirty(concourse, { cells: draft.cells.slice(0, 1) })).toBe(true);
  });
});

describe('isPatternDirty', () => {
  it('未変更のdraftはdirtyでない', () => {
    expect(isPatternDirty(pattern, createPatternDraft(pattern))).toBe(false);
  });

  it('境界を動かすとdirtyになる', () => {
    const draft = moveCarBoundary(createPatternDraft(pattern), 0, 22, { minCarMeters: MIN_CAR_METERS });
    expect(isPatternDirty(pattern, draft)).toBe(true);
  });
});

describe('toPlatformLocationPayload', () => {
  it('draftのxPositionMetersとserver DTOの他フィールドが両方とも往復する（最重要）', () => {
    const draft = moveCell(createConcourseDraft(concourse), 'cell-1', 12.5);
    const payload = toPlatformLocationPayload('platform-1', concourse, draft);

    expect(payload).toEqual({
      platformId: 'platform-1',
      exits: 'A3出口',
      notes: '仮設階段あり',
      cells: [
        {
          xPositionMeters: 12.5,
          facilities: [
            {
              typeCode: 'elevator',
              isWheelchairAccessible: true,
              isStrollerAccessible: null, // null が true に化けない（D6）
              notes: '朝は使用不可',
            },
          ],
        },
        { xPositionMeters: null, facilities: [] },
      ],
      connections: [
        {
          stationId: 'station-shibuya',
          connectedPlatformId: 'platform-shibuya-1',
          directionId: 'direction-1',
          exitLabel: 'A3',
          xRangeStart: 5,
          xRangeEnd: 15,
        },
      ],
    });
  });

  it('未変更のdraftを渡すとxPositionMetersがserver DTOのまま往復する', () => {
    const draft = createConcourseDraft(concourse);
    const payload = toPlatformLocationPayload('platform-1', concourse, draft);
    expect(payload.cells.map((c) => c.xPositionMeters)).toEqual([10, null]);
  });
});

describe('toStopPatternPayload', () => {
  it('platformId・trainId・全号車のcarNumber順ペイロードを組み立てる', () => {
    const draft = moveCarBoundary(createPatternDraft(pattern), 0, 22, { minCarMeters: MIN_CAR_METERS });
    const payload = toStopPatternPayload('platform-1', pattern, draft);

    expect(payload).toEqual({
      platformId: 'platform-1',
      trainId: 'train-1',
      cars: [
        { carNumber: 1, startMeters: 0, endMeters: 22 },
        { carNumber: 2, startMeters: 22, endMeters: 40 },
        { carNumber: 3, startMeters: 40, endMeters: 60 },
      ],
    });
  });
});
