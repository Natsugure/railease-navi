import { db } from '@furatora/database/client';
import {
  stations, platforms, lines, stationLines, stationConnections, lineDirections,
  platformLocations, platformLocationCells, stationFacilities, facilityConnections,
  facilityTypes,
} from '@furatora/database/schema';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import type {
  FacilityEditPageQuery, FacilityEditContext, ConnectedStationOption, FacilityLocationDTO,
} from '@/features/facility/ports';

// admin 全体の Query Service 化は #48。ここは #49 で先行導入したもの。
//
// 従来 FacilityForm は接続候補駅ごとに /api/stations/{id}/platforms と
// /api/stations/{id}/directions を1本ずつ投げていた（N+1、しかも失敗が握り潰されていた）。
// ここでは接続候補駅の集合に対して platforms / lineDirections を inArray で1本ずつ引き、
// アプリ側で駅ごとに畳む。

async function getStationPlatformOptions(stationId: string) {
  return db
    .select({
      id: platforms.id,
      platformNumber: platforms.platformNumber,
      physicalLength: platforms.physicalLength,
    })
    .from(platforms)
    .where(eq(platforms.stationId, stationId))
    .orderBy(asc(platforms.platformNumber));
}

async function getFacilityTypeOptions() {
  return db.select({ code: facilityTypes.code, name: facilityTypes.name }).from(facilityTypes);
}

async function getConnectedStationOptions(stationId: string): Promise<ConnectedStationOption[]> {
  // 現行 GET /api/stations?connectedFrom= と同じ JOIN。
  const stationRows = await db
    .select({
      id: stations.id,
      name: stations.name,
      code: stations.code,
      lineId: lines.id,
      lineName: lines.name,
    })
    .from(stationConnections)
    .innerJoin(stations, eq(stationConnections.connectedStationId, stations.id))
    .leftJoin(stationLines, eq(stationLines.stationId, stations.id))
    .leftJoin(lines, eq(lines.id, stationLines.lineId))
    .where(and(
      eq(stationConnections.stationId, stationId),
      isNotNull(stationConnections.connectedStationId),
    ))
    .orderBy(asc(lines.name));

  if (stationRows.length === 0) return [];

  const connectedStationIds = [...new Set(stationRows.map((s) => s.id))];

  // 接続候補駅すべてのホームを1本で取得（駅ごとの往復をしない）
  const platformRows = await db
    .select({
      id: platforms.id,
      stationId: platforms.stationId,
      platformNumber: platforms.platformNumber,
      inboundDirectionId: platforms.inboundDirectionId,
      outboundDirectionId: platforms.outboundDirectionId,
    })
    .from(platforms)
    .where(inArray(platforms.stationId, connectedStationIds))
    .orderBy(asc(platforms.platformNumber));

  // 各駅のホームが参照する方面 ID を集め、方面の表示名を1本で解決する
  // （現行 GET /api/stations/{id}/directions のロジックと同じ）
  const directionIdsByStation = new Map<string, Set<string>>();
  for (const p of platformRows) {
    const set = directionIdsByStation.get(p.stationId) ?? new Set<string>();
    if (p.inboundDirectionId) set.add(p.inboundDirectionId);
    if (p.outboundDirectionId) set.add(p.outboundDirectionId);
    directionIdsByStation.set(p.stationId, set);
  }
  const allDirectionIds = [...new Set([...directionIdsByStation.values()].flatMap((s) => [...s]))];

  const directionRows = allDirectionIds.length > 0
    ? await db
        .select({ id: lineDirections.id, displayName: lineDirections.displayName })
        .from(lineDirections)
        .where(inArray(lineDirections.id, allDirectionIds))
    : [];
  const directionNameById = new Map(directionRows.map((d) => [d.id, d.displayName]));

  // 駅 ID で畳む。JOIN の結果は「駅×路線」の粒度なので、複数路線を持つ駅は
  // 同じ駅が複数行になる（stationConnections 側に同一 connectedStationId が
  // 複数あった場合も同様）。行のまま返すと接続候補リストに同じ駅が並び、
  // 両方チェックすると facility_connections の
  // unique(platformLocationId, connectedStationId) で保存に失敗する。
  // 出現順（lines.name 昇順）は保持する。
  const byStationId = new Map<string, ConnectedStationOption>();
  for (const row of stationRows) {
    let option = byStationId.get(row.id);
    if (!option) {
      option = {
        id: row.id,
        name: row.name,
        code: row.code,
        lines: [],
        platforms: platformRows
          .filter((p) => p.stationId === row.id)
          .map((p) => ({ id: p.id, platformNumber: p.platformNumber })),
        directions: [...(directionIdsByStation.get(row.id) ?? [])]
          .map((id) => ({ id, displayName: directionNameById.get(id) ?? '(不明な方面)' })),
      };
      byStationId.set(row.id, option);
    }
    // leftJoin なので路線を持たない駅では lineId が null になる
    if (row.lineId !== null && row.lineName !== null
        && !option.lines.some((l) => l.id === row.lineId)) {
      option.lines.push({ id: row.lineId, name: row.lineName });
    }
  }

  return [...byStationId.values()];
}

async function getLocationDTO(stationId: string, locationId: string): Promise<FacilityLocationDTO | null> {
  // 場所が当該駅のホームに属することを検証する（現行 edit ページの所有権チェック）
  const stationPlatforms = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.stationId, stationId));
  const platformIds = stationPlatforms.map((p) => p.id);
  if (platformIds.length === 0) return null;

  const [location] = await db
    .select()
    .from(platformLocations)
    .where(eq(platformLocations.id, locationId));
  if (!location || !platformIds.includes(location.platformId)) return null;

  // cells と connections は互いに独立。facilities は cells の ID が要るので直列のまま
  const [cells, connections] = await Promise.all([
    db
      .select()
      .from(platformLocationCells)
      .where(eq(platformLocationCells.platformLocationId, locationId)),
    db
      .select()
      .from(facilityConnections)
      .where(eq(facilityConnections.platformLocationId, locationId)),
  ]);

  const facilities = cells.length > 0
    ? await db
        .select()
        .from(stationFacilities)
        .where(inArray(stationFacilities.platformLocationCellId, cells.map((c) => c.id)))
    : [];

  return {
    id: location.id,
    platformId: location.platformId,
    exits: location.exits ?? '',
    notes: location.notes ?? '',
    cells: cells.map((cell) => ({
      xPositionMeters: cell.xPositionMeters != null ? Number(cell.xPositionMeters) : null,
      facilities: facilities
        .filter((f) => f.platformLocationCellId === cell.id)
        .map((f) => ({
          typeCode: f.typeCode,
          isWheelchairAccessible: f.isWheelchairAccessible ?? true,
          isStrollerAccessible: f.isStrollerAccessible ?? true,
          notes: f.notes ?? '',
        })),
    })),
    connections: connections.map((c) => ({
      stationId: c.connectedStationId,
      connectedPlatformId: c.connectedPlatformId,
      directionId: c.directionId,
      exitLabel: c.exitLabel ?? '',
      xRangeStart: c.xRangeStart != null ? Number(c.xRangeStart) : null,
      xRangeEnd: c.xRangeEnd != null ? Number(c.xRangeEnd) : null,
    })),
  };
}

export const dbFacilityEditPageQuery: FacilityEditPageQuery = {
  async getCreateContext(stationId) {
    const [station] = await db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId));
    if (!station) return null;

    const [platformOptions, facilityTypeOptions, connectedStations] = await Promise.all([
      getStationPlatformOptions(stationId),
      getFacilityTypeOptions(),
      getConnectedStationOptions(stationId),
    ]);

    return {
      stationName: station.name,
      platforms: platformOptions,
      facilityTypes: facilityTypeOptions,
      connectedStations,
    };
  },

  async getEditContext(stationId, locationId) {
    const [station] = await db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId));
    if (!station) return null;

    const [platformOptions, facilityTypeOptions, connectedStations, location] = await Promise.all([
      getStationPlatformOptions(stationId),
      getFacilityTypeOptions(),
      getConnectedStationOptions(stationId),
      getLocationDTO(stationId, locationId),
    ]);

    if (!location) return null;

    const context: FacilityEditContext = {
      stationName: station.name,
      platforms: platformOptions,
      facilityTypes: facilityTypeOptions,
      connectedStations,
      location,
    };
    return context;
  },
};
