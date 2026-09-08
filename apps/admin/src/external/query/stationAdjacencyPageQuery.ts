import { db } from '@furatora/database/client';
import { lines, stations, stationLines, stationAdjacencies } from '@furatora/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { asc, eq } from 'drizzle-orm';
import type { StationAdjacencyPageQuery } from '@/features/station-adjacency/ports';

// 隣接管理ページ（#88）。路線名 + その路線の駅一覧（stationOrder 順） + 既存の隣接行。
export const dbStationAdjacencyPageQuery: StationAdjacencyPageQuery = {
  async getPageContext(lineId) {
    const stationA = alias(stations, 'station_a');
    const stationB = alias(stations, 'station_b');

    // 一覧からの遷移なので lineId はほぼ必ず存在する。存在チェックだけ先に直列で投げず、
    // 3クエリを1度に投げてから line を判定する（不在の稀ケースで2クエリを捨てるだけ）。
    const [line, lineStations, adjacencies] = await Promise.all([
      db.select({ name: lines.name }).from(lines).where(eq(lines.id, lineId)).limit(1),
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

    if (!line[0]) return null;

    return {
      lineName: line[0].name,
      stations: lineStations,
      adjacencies,
    };
  },
};
