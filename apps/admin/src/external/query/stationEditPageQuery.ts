import { db } from '@furatora/database/client';
import { operators, stations, stationConnections, stationLines, lines } from '@furatora/database/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import type {
  StationEditPageQuery, StationEditContext, ConnectionRow,
} from '@/features/station/ports';

// admin 全体の Query Service 化は #48。ここは #49 で先行導入したもの。
// 従来 stations/[stationId]/edit/page.tsx が組み立てていた connections の
// 解決ロジックをそのまま移設し、事業者一覧（従来はフォームが fetch）を足した。

export const dbStationEditPageQuery: StationEditPageQuery = {
  async getEditContext(stationId) {
    const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
    if (!station) return null;

    const [operatorOptions, connectionRows] = await Promise.all([
      db.select({ id: operators.id, name: operators.name }).from(operators).orderBy(asc(operators.name)),
      db
        .select({
          id: stationConnections.id,
          connectedStationId: stationConnections.connectedStationId,
          strollerDifficulty: stationConnections.strollerDifficulty,
          wheelchairDifficulty: stationConnections.wheelchairDifficulty,
          notesAboutStroller: stationConnections.notesAboutStroller,
          notesAboutWheelchair: stationConnections.notesAboutWheelchair,
        })
        .from(stationConnections)
        .where(eq(stationConnections.stationId, stationId)),
    ]);

    const connectedStationIds = connectionRows
      .map((c) => c.connectedStationId)
      .filter((id): id is string => id !== null);

    // connectedRailwayId 列は廃止済み（ADR-0007 決定3）。路線名は stationLines 経由で解決する。
    const [connectedStationList, connectedLineRows] = await Promise.all([
      connectedStationIds.length > 0
        ? db.select({ id: stations.id, name: stations.name }).from(stations).where(inArray(stations.id, connectedStationIds))
        : Promise.resolve([]),
      connectedStationIds.length > 0
        ? db
            .select({ stationId: stationLines.stationId, lineName: lines.name })
            .from(stationLines)
            .innerJoin(lines, eq(lines.id, stationLines.lineId))
            .where(inArray(stationLines.stationId, connectedStationIds))
        : Promise.resolve([]),
    ]);

    const stationNameMap = new Map(connectedStationList.map((s) => [s.id, s.name]));
    const lineNameByStationId = new Map<string, string>();
    for (const row of connectedLineRows) {
      if (!lineNameByStationId.has(row.stationId)) {
        lineNameByStationId.set(row.stationId, row.lineName);
      }
    }

    const connections: ConnectionRow[] = connectionRows.map((c) => ({
      id: c.id,
      connectedStationName: c.connectedStationId ? (stationNameMap.get(c.connectedStationId) ?? null) : null,
      connectedLineName: c.connectedStationId ? (lineNameByStationId.get(c.connectedStationId) ?? null) : null,
      strollerDifficulty: c.strollerDifficulty,
      wheelchairDifficulty: c.wheelchairDifficulty,
      notesAboutStroller: c.notesAboutStroller,
      notesAboutWheelchair: c.notesAboutWheelchair,
    }));

    const context: StationEditContext = {
      station: {
        name: station.name,
        nameKana: station.nameKana,
        nameEn: station.nameEn,
        odptStationId: station.odptStationId,
        slug: station.slug,
        code: station.code,
        lat: station.lat,
        lon: station.lon,
        operatorId: station.operatorId,
        notes: station.notes,
      },
      operators: operatorOptions,
      connections,
    };
    return context;
  },
};
