import { db } from '@furatora/database/client';
import { lines, stations, stationLines, stationAdjacencies } from '@furatora/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { asc, eq } from 'drizzle-orm';
import type {
  StationAdjacencyPageQuery, StationAdjacencyPageContext, AdjacencyRow,
} from '@/features/station-adjacency/ports';

// 隣接管理ページ（#88）。路線名 + その路線の駅一覧（stationOrder 順） + 既存の隣接行。
export const dbStationAdjacencyPageQuery: StationAdjacencyPageQuery = {
  async getPageContext(lineId) {
    const [line] = await db
      .select({ name: lines.name })
      .from(lines)
      .where(eq(lines.id, lineId))
      .limit(1);
    if (!line) return null;

    const stationA = alias(stations, 'station_a');
    const stationB = alias(stations, 'station_b');

    const [lineStations, adjacencyRows] = await Promise.all([
      db
        .select({
          id: stations.id,
          name: stations.name,
          stationOrder: stationLines.stationOrder,
        })
        .from(stationLines)
        .innerJoin(stations, eq(stationLines.stationId, stations.id))
        .where(eq(stationLines.lineId, lineId))
        .orderBy(asc(stationLines.stationOrder)),
      db
        .select({
          id: stationAdjacencies.id,
          stationAId: stationAdjacencies.stationAId,
          stationAName: stationA.name,
          stationBId: stationAdjacencies.stationBId,
          stationBName: stationB.name,
        })
        .from(stationAdjacencies)
        .innerJoin(stationA, eq(stationAdjacencies.stationAId, stationA.id))
        .innerJoin(stationB, eq(stationAdjacencies.stationBId, stationB.id))
        .where(eq(stationAdjacencies.lineId, lineId)),
    ]);

    const adjacencies: AdjacencyRow[] = adjacencyRows.map((r) => ({
      id: r.id,
      stationAId: r.stationAId,
      stationAName: r.stationAName,
      stationBId: r.stationBId,
      stationBName: r.stationBName,
    }));

    const context: StationAdjacencyPageContext = {
      lineName: line.name,
      stations: lineStations,
      adjacencies,
    };
    return context;
  },
};
