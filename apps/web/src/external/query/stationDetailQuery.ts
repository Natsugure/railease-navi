import { db } from '@furatora/database/client';
import {
  stations,
  stationLines,
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
} from '@furatora/database/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { publishedStation } from './visibility';
import type { StationDetailQuery } from '@/features/station/ports';
import type { StationDetailDTO, TransferConnectionDTO } from '@/features/station/domain/types';
import type {
  ConcourseDTO,
  PlatformDTO,
  StopPatternCarDTO,
  TrainStopPatternDTO,
} from '@furatora/platform-diagram/domain';

// apps/admin/src/external/query/stopPatternPageQuery.ts のスタイルを踏襲する。
// decimal → number の変換はすべてここで完結させる（DTOより上に string を渡さない）。

// connectedRailwayId 列は廃止済み（ODPT 同期専用の列であり、以後 ODPT 同期は行わない。
// ADR-0007 決定3 / Issue #56）。路線名は connectedStationId → stationLines → lines の
// join で解決する。駅マスタは路線ごとに駅を割るモデルのため、接続先の駅が決まれば
// 路線がほぼ一意に定まる（複数路線を持つ駅はごく少数。lineName で重複除去して吸収する）。
// 詳細: docs/domain/station-master-model.md「乗換接続（stationConnections）」。
//
// 接続先の駅にも publishedStation() を通す。未公開駅への乗換リンクを詳細ページに出すと、
// そこから未公開ページへ到達できてしまう（docs/domain/station-visibility.md
// 「乗換接続からの到達」。要件の再検討は Issue #77 で進行中）。
async function getStationConnectionRows(stationId: string) {
  return db
    .select({
      connectedStationId: stationConnections.connectedStationId,
      lineName: lines.name,
      lineColor: lines.color,
      strollerDifficulty: stationConnections.strollerDifficulty,
      wheelchairDifficulty: stationConnections.wheelchairDifficulty,
      notesAboutStroller: stationConnections.notesAboutStroller,
      notesAboutWheelchair: stationConnections.notesAboutWheelchair,
    })
    .from(stationConnections)
    .innerJoin(stations, eq(stations.id, stationConnections.connectedStationId))
    .innerJoin(stationLines, eq(stationLines.stationId, stationConnections.connectedStationId))
    .innerJoin(lines, eq(lines.id, stationLines.lineId))
    .where(and(eq(stationConnections.stationId, stationId), publishedStation()));
}

function buildTransferConnections(
  rows: Awaited<ReturnType<typeof getStationConnectionRows>>,
): TransferConnectionDTO[] {
  // 2路線を持つ駅（実測5件）は connectedStationId ごとに複数行になるため、
  // 同一路線の重複を除いてから DTO 化する
  const seen = new Set<string>();
  const result: TransferConnectionDTO[] = [];
  for (const r of rows) {
    if (r.strollerDifficulty === null && r.wheelchairDifficulty === null) continue;
    const key = `${r.connectedStationId}:${r.lineName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      lineName: r.lineName,
      lineColor: r.lineColor,
      strollerDifficulty: r.strollerDifficulty,
      wheelchairDifficulty: r.wheelchairDifficulty,
      notesAboutStroller: r.notesAboutStroller,
      notesAboutWheelchair: r.notesAboutWheelchair,
    });
  }
  return result;
}

// connectedStationId ごとの乗換路線名・色（facilityConnections のラベル付けに使う）
function buildLinesByStation(rows: Awaited<ReturnType<typeof getStationConnectionRows>>) {
  const map = new Map<string, { names: string[]; colors: (string | null)[] }>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.connectedStationId) continue;
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

export const dbStationDetailQuery: StationDetailQuery = {
  async getBySlug(slug) {
    // 未公開駅は 404（該当なし）にする。CHECK 制約 published_requires_slug により
    // 公開駅は必ず slug を持つため、この条件を足しても公開駅の到達性は変わらない
    // （docs/domain/station-visibility.md）。
    const [stationRow] = await db
      .select()
      .from(stations)
      .where(and(eq(stations.slug, slug), publishedStation()))
      .limit(1);
    if (!stationRow) return null;

    const [headerLineRows, platformList, stationConnectionRows] = await Promise.all([
      db
        .select({ color: lines.color })
        .from(stationLines)
        .innerJoin(lines, eq(stationLines.lineId, lines.id))
        .where(eq(stationLines.stationId, stationRow.id))
        .limit(1),
      db
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
        .where(eq(platforms.stationId, stationRow.id)),
      getStationConnectionRows(stationRow.id),
    ]);

    const baseDTO: Omit<StationDetailDTO, 'platforms'> = {
      station: {
        id: stationRow.id,
        name: stationRow.name,
        nameEn: stationRow.nameEn,
        code: stationRow.code,
        notes: stationRow.notes,
      },
      headerLineColor: headerLineRows[0]?.color ?? null,
      transferConnections: buildTransferConnections(stationConnectionRows),
    };

    if (platformList.length === 0) {
      return { ...baseDTO, platforms: [] };
    }

    const platformIds = platformList.map((p) => p.id);
    const lineIds = [...new Set(platformList.map((p) => p.lineId))];
    const directionIds = [
      ...new Set(
        platformList
          .flatMap((p) => [p.inboundDirectionId, p.outboundDirectionId])
          .filter((id): id is string => id !== null),
      ),
    ];

    const [lineList, directionList, facilityTypeList] = await Promise.all([
      db.select().from(lines).where(inArray(lines.id, lineIds)),
      directionIds.length > 0
        ? db.select().from(lineDirections).where(inArray(lineDirections.id, directionIds))
        : Promise.resolve([]),
      db.select().from(facilityTypes),
    ]);

    const lineMap = new Map(lineList.map((l) => [l.id, l]));
    const directionMap = new Map(directionList.map((d) => [d.id, d]));
    const facilityTypeMap = Object.fromEntries(facilityTypeList.map((t) => [t.code, t.name]));

    // 列車の表示判定は「そのホーム・列車の組み合わせに停車位置パターンが登録されているか」のみ
    // （docs/domain/train-stop-patterns.md「列車の表示判定」）
    const patternRows = await db
      .select({
        id: trainStopPatterns.id,
        platformId: trainStopPatterns.platformId,
        trainId: trainStopPatterns.trainId,
      })
      .from(trainStopPatterns)
      .where(inArray(trainStopPatterns.platformId, platformIds));

    const patternIds = patternRows.map((p) => p.id);
    const trainIds = [...new Set(patternRows.map((p) => p.trainId))];

    const [trainRows, carRows, carStructureRows, equipmentRows] = await Promise.all([
      trainIds.length > 0
        ? db.select({ id: trains.id, name: trains.name, carCount: trains.carCount })
            .from(trains).where(inArray(trains.id, trainIds))
        : Promise.resolve([]),
      patternIds.length > 0
        ? db
            .select({
              trainStopPatternId: trainStopPatternCars.trainStopPatternId,
              carNumber: trainStopPatternCars.carNumber,
              startMeters: trainStopPatternCars.startMeters,
              endMeters: trainStopPatternCars.endMeters,
            })
            .from(trainStopPatternCars)
            .where(inArray(trainStopPatternCars.trainStopPatternId, patternIds))
            .orderBy(asc(trainStopPatternCars.carNumber))
        : Promise.resolve([]),
      trainIds.length > 0
        ? db
            .select({
              trainId: trainCarStructures.trainId,
              carNumber: trainCarStructures.carNumber,
              doorCount: trainCarStructures.doorCount,
            })
            .from(trainCarStructures)
            .where(inArray(trainCarStructures.trainId, trainIds))
        : Promise.resolve([]),
      trainIds.length > 0
        ? db.select().from(trainEquipments).where(inArray(trainEquipments.trainId, trainIds))
        : Promise.resolve([]),
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

    const stopPatternsByPlatformId = new Map<string, TrainStopPatternDTO[]>();
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

      const dto: TrainStopPatternDTO = {
        trainId: train.id,
        trainLabel: train.name,
        carCount: train.carCount,
        cars,
      };

      const existing = stopPatternsByPlatformId.get(pattern.platformId) ?? [];
      stopPatternsByPlatformId.set(pattern.platformId, [...existing, dto]);
    }

    // コンコース（platformLocations → platformLocationCells → stationFacilities / facilityConnections）
    const locationList = await db
      .select()
      .from(platformLocations)
      .where(inArray(platformLocations.platformId, platformIds));

    const locationIds = locationList.map((l) => l.id);

    const [cellList, connectionRows] = locationIds.length > 0
      ? await Promise.all([
          db.select().from(platformLocationCells).where(inArray(platformLocationCells.platformLocationId, locationIds)),
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
        ])
      : [[], []];

    const cellIds = cellList.map((c) => c.id);
    const facilityList = cellIds.length > 0
      ? await db.select().from(stationFacilities).where(inArray(stationFacilities.platformLocationCellId, cellIds))
      : [];

    const linesByStation = buildLinesByStation(stationConnectionRows);

    const facilitiesByCell = new Map(cellIds.map((id) => [id, facilityList.filter((f) => f.platformLocationCellId === id)]));
    const cellsByLocation = new Map(locationIds.map((id) => [id, cellList.filter((c) => c.platformLocationId === id)]));
    const connectionsByLocation = new Map<string, typeof connectionRows>();
    for (const row of connectionRows) {
      const existing = connectionsByLocation.get(row.platformLocationId) ?? [];
      connectionsByLocation.set(row.platformLocationId, [...existing, row]);
    }

    const concoursesByPlatformId = new Map<string, ConcourseDTO[]>();
    for (const loc of locationList) {
      const dto: ConcourseDTO = {
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
      };
      const existing = concoursesByPlatformId.get(loc.platformId) ?? [];
      concoursesByPlatformId.set(loc.platformId, [...existing, dto]);
    }

    const platformDTOs: PlatformDTO[] = platformList.map((p) => {
      const line = lineMap.get(p.lineId);
      const inboundDirection = p.inboundDirectionId ? directionMap.get(p.inboundDirectionId) : undefined;
      const outboundDirection = p.outboundDirectionId ? directionMap.get(p.outboundDirectionId) : undefined;
      const platformSide = p.platformSide === 'top' || p.platformSide === 'bottom' ? p.platformSide : null;

      return {
        id: p.id,
        platformNumber: p.platformNumber,
        lineId: p.lineId,
        lineName: line?.name ?? '',
        lineColor: line?.color ?? null,
        inboundDirectionId: p.inboundDirectionId,
        inboundDirectionName: inboundDirection?.displayName ?? null,
        outboundDirectionId: p.outboundDirectionId,
        outboundDirectionName: outboundDirection?.displayName ?? null,
        platformSide,
        notes: p.notes,
        physicalLength: Number(p.physicalLength),
        stopPatterns: stopPatternsByPlatformId.get(p.id) ?? [],
        concourses: concoursesByPlatformId.get(p.id) ?? [],
      };
    });

    return { ...baseDTO, platforms: platformDTOs };
  },
};
