import type { PlatformLocationInput } from '@/features/facility/schema';
import type { TrainStopPatternInput } from '@/features/stop-pattern/schema';
import type {
  LayoutConcourseDTO, LayoutStopPatternDTO,
} from '@/features/station-layout/ports';

// 図上編集（StationLayoutEditor）が保持する未保存stateの純関数。
// Next.js非依存（'use client' に依存しない）なので node 環境でテストできる。
// この計画で確定した唯一の恒久ドメインルール: 号車境界は隣接号車が共有する
// （cars[i].endMeters === cars[i+1].startMeters）。この不変条件は moveCarBoundary
// 以外の経路で startMeters/endMeters を書き換えてはならない
// （docs/domain/train-stop-patterns.md）。

export type ConcourseDraft = {
  cells: { id: string; xPositionMeters: number | null }[];
};

export type PatternDraft = {
  cars: { carNumber: number; startMeters: number; endMeters: number }[];
};

export function createConcourseDraft(concourse: Pick<LayoutConcourseDTO, 'cells'>): ConcourseDraft {
  return { cells: concourse.cells.map((c) => ({ id: c.id, xPositionMeters: c.xPositionMeters })) };
}

export function createPatternDraft(pattern: Pick<LayoutStopPatternDTO, 'cars'>): PatternDraft {
  return {
    cars: [...pattern.cars]
      .sort((a, b) => a.carNumber - b.carNumber)
      .map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
  };
}

/** アクセス点（cell）を1つ動かす */
export function moveCell(draft: ConcourseDraft, cellId: string, x: number): ConcourseDraft {
  return {
    cells: draft.cells.map((cell) => (cell.id === cellId ? { ...cell, xPositionMeters: x } : cell)),
  };
}

/**
 * 号車の内側の境界（cars[boundaryIndex] と cars[boundaryIndex+1] の間）を動かす。
 *
 * 重なり・隙間は物理的に起こり得ないため、隣接号車の end/start を常に同値に保つ
 * （このファイル唯一の不変条件）。opts.minCarMeters は号車を潰さない最小幅で、
 * 両側の号車がこれより短くならないようクランプする。
 *
 * boundaryIndex が範囲外（両端の外側の境界）のときは無変更で返す。両端は
 * moveCarEdge を使うこと。
 */
export function moveCarBoundary(
  draft: PatternDraft,
  boundaryIndex: number,
  x: number,
  opts: { minCarMeters: number },
): PatternDraft {
  const cars = [...draft.cars].sort((a, b) => a.carNumber - b.carNumber);
  if (boundaryIndex < 0 || boundaryIndex >= cars.length - 1) return draft;

  const left = cars[boundaryIndex]!;
  const right = cars[boundaryIndex + 1]!;
  const minX = left.startMeters + opts.minCarMeters;
  const maxX = right.endMeters - opts.minCarMeters;
  const clamped = Math.min(Math.max(x, minX), maxX);

  return {
    cars: cars.map((car, i) => {
      if (i === boundaryIndex) return { ...car, endMeters: clamped };
      if (i === boundaryIndex + 1) return { ...car, startMeters: clamped };
      return car;
    }),
  };
}

/**
 * 編成の外端（1号車の start、または最終号車の end）を動かす。
 *
 * 外端には連動する隣接号車が無いので単独で動かせる。内側の境界は
 * moveCarBoundary を使うこと（edge が内側の号車を指す場合は無変更で返す）。
 */
export function moveCarEdge(
  draft: PatternDraft,
  edge: { carNumber: number; side: 'start' | 'end' },
  x: number,
  opts: { minCarMeters: number },
): PatternDraft {
  const cars = [...draft.cars].sort((a, b) => a.carNumber - b.carNumber);
  const index = cars.findIndex((c) => c.carNumber === edge.carNumber);
  if (index === -1) return draft;

  const isLeftEdge = index === 0 && edge.side === 'start';
  const isRightEdge = index === cars.length - 1 && edge.side === 'end';
  if (!isLeftEdge && !isRightEdge) return draft;

  const car = cars[index]!;
  const nextCar = edge.side === 'start'
    ? { ...car, startMeters: Math.min(x, car.endMeters - opts.minCarMeters) }
    : { ...car, endMeters: Math.max(x, car.startMeters + opts.minCarMeters) };

  return { cars: cars.map((c, i) => (i === index ? nextCar : c)) };
}

export function isConcourseDirty(server: Pick<LayoutConcourseDTO, 'cells'>, draft: ConcourseDraft): boolean {
  if (server.cells.length !== draft.cells.length) return true;
  const byId = new Map(server.cells.map((c) => [c.id, c.xPositionMeters]));
  return draft.cells.some((c) => byId.get(c.id) !== c.xPositionMeters);
}

export function isPatternDirty(server: Pick<LayoutStopPatternDTO, 'cars'>, draft: PatternDraft): boolean {
  if (server.cars.length !== draft.cars.length) return true;
  const byNumber = new Map(server.cars.map((c) => [c.carNumber, c]));
  return draft.cars.some((c) => {
    const s = byNumber.get(c.carNumber);
    return !s || s.startMeters !== c.startMeters || s.endMeters !== c.endMeters;
  });
}

/**
 * PUT /api/stations/{sid}/platform-locations/{lid} のペイロードを組み立てる。
 *
 * このPUTはコンコース全体をdelete→insertする全置換なので、draftに無いフィールド
 * （exits/notes/facilities/connections）はすべてserver DTOからそのまま引き継ぐ。
 * このコンコースの往復に必要な全フィールドをここ1箇所に閉じ込めることで、
 * 抜けをeditDraft.test.tsだけで機械的に検出できるようにする。
 */
export function toPlatformLocationPayload(
  platformId: string,
  concourse: LayoutConcourseDTO,
  draft: ConcourseDraft,
): PlatformLocationInput {
  const draftById = new Map(draft.cells.map((c) => [c.id, c.xPositionMeters]));

  return {
    platformId,
    exits: concourse.exits,
    notes: concourse.notes,
    cells: concourse.cells.map((cell) => ({
      xPositionMeters: draftById.has(cell.id) ? draftById.get(cell.id)! : cell.xPositionMeters,
      facilities: cell.facilities.map((f) => ({
        typeCode: f.typeCode,
        isWheelchairAccessible: f.isWheelchairAccessible,
        isStrollerAccessible: f.isStrollerAccessible,
        notes: f.notes,
      })),
    })),
    connections: concourse.connections.map((c) => ({
      stationId: c.connectedStationId,
      connectedPlatformId: c.connectedPlatformId,
      directionId: c.directionId,
      exitLabel: c.exitLabel,
      xRangeStart: c.xRangeStart,
      xRangeEnd: c.xRangeEnd,
    })),
  };
}

/**
 * PUT /api/stations/{sid}/train-stop-patterns/{pid} のペイロードを組み立てる。
 * cars は全置換なので draft の全号車を送る（doorCount 等の列車由来の値は
 * この PUT では扱わないので失われない）。
 */
export function toStopPatternPayload(
  platformId: string,
  pattern: LayoutStopPatternDTO,
  draft: PatternDraft,
): TrainStopPatternInput {
  return {
    platformId,
    trainId: pattern.trainId,
    cars: [...draft.cars]
      .sort((a, b) => a.carNumber - b.carNumber)
      .map((c) => ({ carNumber: c.carNumber, startMeters: c.startMeters, endMeters: c.endMeters })),
  };
}
