import { db } from '@furatora/database/client';
import {
  stations,
  platforms,
  lines,
  lineDirections,
  trains,
  trainEquipments,
  trainCarStructures,
  trainStopPatterns,
  trainStopPatternCars,
  platformLocations,
  platformLocationCells,
  stationFacilities,
  facilityTypes,
  facilityConnections,
  stationConnections,
  stationLines,
} from '@furatora/database/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import type { StationLayoutPageQuery, LayoutPlatformDTO, LayoutStopPatternDTO } from '@/features/station-layout/ports';
import type { ConcourseDTO, StopPatternCarDTO } from '@furatora/platform-diagram/domain';

// 駅レイアウト統合ページ（Issue #95 PR2）。旧 facilities/page.tsx（312行）が db を
// 直接 import して8箇所のクエリ（うち路線解決はホームの路線数ぶん往復するN+1）を
// 直書きしていたのを、この1本に集約する。
//
// apps/web/src/external/query/stationDetailQuery.ts の組み立てロジックを写経している。
// 差分は3点: (1) publishedStation() を通さない（admin は未公開駅も編集対象）、
// (2) 入口が slug ではなく stationId、(3) 選択中のホーム1件だけを詳細取得する
// （web は駅の全ホーム分を一度に返す）。
// decimal → number の変換はすべてここで完結させる（DTOより上に string を渡さない。
// docs/domain/platform-coordinate-system.md「単位と精度」）。

// connectedStationId ごとの乗換路線名・色（facilityConnections のラベル付けに使う）。
// admin は未公開駅も含めて解決する（apps/web と異なり publishedStation() を通さない）
async function getLinesByConnectedStation(connectedStationIds: string[]) {
  const map = new Map<string, { names: string[]; colors: (string | null)[] }>();
  if (connectedStationIds.length === 0) return map;

  const rows = await db
    .select({
      connectedStationId: stationConnections.connectedStationId,
      lineName: lines.name,
      lineColor: lines.color,
    })
    .from(stationConnections)
    .innerJoin(stationLines, eq(stationLines.stationId, stationConnections.connectedStationId))
    .innerJoin(lines, eq(lines.id, stationLines.lineId))
    .where(inArray(stationConnections.connectedStationId, connectedStationIds));

  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.connectedStationId}:${row.lineName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!map.has(row.connectedStationId)) map.set(row.connectedStationId, { names: [], colors: [] });
    const entry = map.get(row.connectedStationId)!;
    entry.names.push(row.lineName);
    entry.colors.push(row.lineColor);
  }
  return map;
}

// ホームのコンコース（platformLocations → platformLocationCells → stationFacilities /
// facilityConnections）を1ホーム分だけ取得する
async function getConcourses(platformId: string): Promise<ConcourseDTO[]> {
  const locationList = await db
    .select()
    .from(platformLocations)
    .where(eq(platformLocations.platformId, platformId))
    .orderBy(asc(platformLocations.createdAt));

  if (locationList.length === 0) return [];
  const locationIds = locationList.map((l) => l.id);

  const [cellList, connectionRows] = await Promise.all([
    db
      .select()
      .from(platformLocationCells)
      .where(inArray(platformLocationCells.platformLocationId, locationIds))
      .orderBy(asc(platformLocationCells.xPositionMeters)),
    db
      .select({
        platformLocationId: facilityConnections.platformLocationId,
        exitLabel: facilityConnections.exitLabel,
        connectedStationId: facilityConnections.connectedStationId,
        stationName: stations.name,
        directionName: lineDirections.displayName,
        xRangeStart: facilityConnections.xRangeStart,
        xRangeEnd: facilityConnections.xRangeEnd,
      })
      .from(facilityConnections)
      .innerJoin(stations, eq(facilityConnections.connectedStationId, stations.id))
      .leftJoin(lineDirections, eq(facilityConnections.directionId, lineDirections.id))
      .where(inArray(facilityConnections.platformLocationId, locationIds)),
  ]);

  const cellIds = cellList.map((c) => c.id);
  const [facilityList, facilityTypeList, linesByStation] = await Promise.all([
    cellIds.length > 0
      ? db.select().from(stationFacilities).where(inArray(stationFacilities.platformLocationCellId, cellIds))
      : Promise.resolve([]),
    db.select().from(facilityTypes),
    getLinesByConnectedStation([...new Set(connectionRows.map((c) => c.connectedStationId))]),
  ]);

  const facilityTypeMap = Object.fromEntries(facilityTypeList.map((t) => [t.code, t.name]));
  const facilitiesByCell = new Map(cellIds.map((id) => [id, facilityList.filter((f) => f.platformLocationCellId === id)]));
  const cellsByLocation = new Map(locationIds.map((id) => [id, cellList.filter((c) => c.platformLocationId === id)]));
  const connectionsByLocation = new Map<string, typeof connectionRows>();
  for (const row of connectionRows) {
    const existing = connectionsByLocation.get(row.platformLocationId) ?? [];
    connectionsByLocation.set(row.platformLocationId, [...existing, row]);
  }

  return locationList.map((loc) => ({
    id: loc.id,
    exits: loc.exits,
    cells: (cellsByLocation.get(loc.id) ?? []).map((cell) => ({
      xPositionMeters: cell.xPositionMeters !== null ? Number(cell.xPositionMeters) : null,
      facilities: (facilitiesByCell.get(cell.id) ?? []).map((f) => ({
        id: f.id,
        typeCode: f.typeCode,
        typeName: facilityTypeMap[f.typeCode] ?? f.typeCode,
        isWheelchairAccessible: f.isWheelchairAccessible,
        isStrollerAccessible: f.isStrollerAccessible,
      })),
    })),
    connections: (connectionsByLocation.get(loc.id) ?? []).map((c) => ({
      stationName: c.stationName,
      lineNames: linesByStation.get(c.connectedStationId)?.names ?? [],
      lineColors: linesByStation.get(c.connectedStationId)?.colors ?? [],
      directionName: c.directionName ?? null,
      exitLabel: c.exitLabel,
      xRangeStart: c.xRangeStart !== null ? Number(c.xRangeStart) : null,
      xRangeEnd: c.xRangeEnd !== null ? Number(c.xRangeEnd) : null,
    })),
  }));
}

// ホームの停車位置パターン一覧（列車・号車・ドア設備込み）を取得する。
// 並び順は trains.carCount 昇順 → trains.name 昇順 → trainStopPatterns.id 昇順
// （trainStopPatterns に表示順カラムが無いため。決定性を保つため id まで含める）
async function getStopPatterns(platformId: string): Promise<LayoutStopPatternDTO[]> {
  const patternRows = await db
    .select({ id: trainStopPatterns.id, trainId: trainStopPatterns.trainId })
    .from(trainStopPatterns)
    .where(eq(trainStopPatterns.platformId, platformId));

  if (patternRows.length === 0) return [];

  const patternIds = patternRows.map((p) => p.id);
  const trainIds = [...new Set(patternRows.map((p) => p.trainId))];

  const [trainRows, carRows, carStructureRows, equipmentRows] = await Promise.all([
    db.select({ id: trains.id, name: trains.name, carCount: trains.carCount }).from(trains).where(inArray(trains.id, trainIds)),
    db
      .select({
        trainStopPatternId: trainStopPatternCars.trainStopPatternId,
        carNumber: trainStopPatternCars.carNumber,
        startMeters: trainStopPatternCars.startMeters,
        endMeters: trainStopPatternCars.endMeters,
      })
      .from(trainStopPatternCars)
      .where(inArray(trainStopPatternCars.trainStopPatternId, patternIds))
      .orderBy(asc(trainStopPatternCars.carNumber)),
    db
      .select({ trainId: trainCarStructures.trainId, carNumber: trainCarStructures.carNumber, doorCount: trainCarStructures.doorCount })
      .from(trainCarStructures)
      .where(inArray(trainCarStructures.trainId, trainIds)),
    db.select().from(trainEquipments).where(inArray(trainEquipments.trainId, trainIds)),
  ]);

  const trainById = new Map(trainRows.map((t) => [t.id, t]));

  const doorCountByTrainCar = new Map<string, number>();
  for (const row of carStructureRows) {
    doorCountByTrainCar.set(`${row.trainId}:${row.carNumber}`, row.doorCount);
  }

  const equipmentsByTrainCar = new Map<
    string,
    { free: { nearDoor: number; isStandard: boolean }[]; prio: { nearDoor: number; isStandard: boolean }[] }
  >();
  for (const row of equipmentRows) {
    const key = `${row.trainId}:${row.carNumber}`;
    if (!equipmentsByTrainCar.has(key)) equipmentsByTrainCar.set(key, { free: [], prio: [] });
    const entry = equipmentsByTrainCar.get(key)!;
    const item = { nearDoor: row.nearDoor, isStandard: row.isStandard };
    if (row.type === 'free_space') entry.free.push(item);
    else entry.prio.push(item);
  }

  const dtos: LayoutStopPatternDTO[] = [];
  for (const pattern of patternRows) {
    const train = trainById.get(pattern.trainId);
    if (!train) continue; // 参照整合性が壊れている場合はスキップ

    const cars: StopPatternCarDTO[] = carRows
      .filter((c) => c.trainStopPatternId === pattern.id)
      .map((c) => {
        const key = `${pattern.trainId}:${c.carNumber}`;
        const equipments = equipmentsByTrainCar.get(key);
        return {
          carNumber: c.carNumber,
          startMeters: Number(c.startMeters),
          endMeters: Number(c.endMeters),
          doorCount: doorCountByTrainCar.get(key) ?? 4,
          freeSpaceDoors: equipments?.free ?? [],
          prioritySeatDoors: equipments?.prio ?? [],
        };
      });

    dtos.push({
      patternId: pattern.id,
      trainId: train.id,
      trainLabel: train.name,
      carCount: train.carCount,
      cars,
    });
  }

  return dtos.sort((a, b) => a.carCount - b.carCount || a.trainLabel.localeCompare(b.trainLabel) || a.patternId.localeCompare(b.patternId));
}

export const dbStationLayoutPageQuery: StationLayoutPageQuery = {
  async getContext(stationId, selection) {
    const [stationRow] = await db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId));
    if (!stationRow) return null;

    const platformList = await db
      .select({
        id: platforms.id,
        platformNumber: platforms.platformNumber,
        lineId: platforms.lineId,
        inboundDirectionId: platforms.inboundDirectionId,
        outboundDirectionId: platforms.outboundDirectionId,
        physicalLength: platforms.physicalLength,
        platformSide: platforms.platformSide,
        notes: platforms.notes,
      })
      .from(platforms)
      .where(eq(platforms.stationId, stationId))
      .orderBy(asc(platforms.platformNumber));

    if (platformList.length === 0) {
      return { stationName: stationRow.name, platforms: [], platform: null };
    }

    const lineIds = [...new Set(platformList.map((p) => p.lineId))];
    const directionIds = [
      ...new Set(platformList.flatMap((p) => [p.inboundDirectionId, p.outboundDirectionId]).filter((id): id is string => id !== null)),
    ];

    // 路線数ぶんクエリを往復しない（旧 facilities/page.tsx の N+1 を踏まない）
    const [lineList, directionList] = await Promise.all([
      db.select().from(lines).where(inArray(lines.id, lineIds)),
      directionIds.length > 0 ? db.select().from(lineDirections).where(inArray(lineDirections.id, directionIds)) : Promise.resolve([]),
    ]);
    const lineMap = new Map(lineList.map((l) => [l.id, l]));
    const directionMap = new Map(directionList.map((d) => [d.id, d]));

    const platformTabs: LayoutPlatformDTO[] = platformList.map((p) => {
      const line = lineMap.get(p.lineId);
      const inboundName = p.inboundDirectionId ? directionMap.get(p.inboundDirectionId)?.displayName : undefined;
      const outboundName = p.outboundDirectionId ? directionMap.get(p.outboundDirectionId)?.displayName : undefined;
      return {
        id: p.id,
        platformNumber: p.platformNumber,
        lineName: line?.name ?? '',
        lineColor: line?.color ?? null,
        directionLabel: [inboundName, outboundName].filter(Boolean).join(' / '),
      };
    });

    // 選択中ホームを決定: platformId が当該駅のホームに属せば採用、さもなくば先頭
    // （UUID形式のバリデーション自体はページ側の parseUuidParam が担う。ここでは
    // 所属検証のみ行う。design.md「エラーハンドリング」: 500にせず先頭にフォールバック）。
    // platformList.length === 0 は上で早期returnしているため、先頭要素は必ず存在する
    const selected = platformList.find((p) => p.id === selection.platformId) ?? platformList[0]!;

    const [stopPatterns, concourses] = await Promise.all([getStopPatterns(selected.id), getConcourses(selected.id)]);

    // 選択中パターンを決定: patternId が当該ホームのパターンに属せば採用、さもなくば先頭
    const selectedPattern = stopPatterns.find((p) => p.patternId === selection.patternId) ?? stopPatterns[0];

    const line = lineMap.get(selected.lineId);
    const inboundDirection = selected.inboundDirectionId ? directionMap.get(selected.inboundDirectionId) : undefined;
    const outboundDirection = selected.outboundDirectionId ? directionMap.get(selected.outboundDirectionId) : undefined;
    const platformSide = selected.platformSide === 'top' || selected.platformSide === 'bottom' ? selected.platformSide : null;

    return {
      stationName: stationRow.name,
      platforms: platformTabs,
      platform: {
        id: selected.id,
        platformNumber: selected.platformNumber,
        lineId: selected.lineId,
        lineName: line?.name ?? '',
        lineColor: line?.color ?? null,
        inboundDirectionId: selected.inboundDirectionId,
        inboundDirectionName: inboundDirection?.displayName ?? null,
        outboundDirectionId: selected.outboundDirectionId,
        outboundDirectionName: outboundDirection?.displayName ?? null,
        platformSide,
        notes: selected.notes,
        physicalLength: Number(selected.physicalLength),
        stopPatterns,
        concourses,
        selectedPatternId: selectedPattern?.patternId ?? null,
      },
    };
  },
};
