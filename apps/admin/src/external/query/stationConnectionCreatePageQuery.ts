import { db } from '@furatora/database/client';
import { stations, lines, stationLines, operators } from '@furatora/database/schema';
import { and, asc, eq, ne } from 'drizzle-orm';
import type {
  StationConnectionCreatePageQuery, StationConnectionCreateContext, ConnectionCandidateStation,
} from '@/features/station-connection/ports';

// 接続の追加ページの候補駅を、事業者 → 路線で段階的に絞って返す（#88）。
// 全10,625駅を一度に読むクエリは発行しない。#94 の URL 状態方式に揃える。
export const dbStationConnectionCreatePageQuery: StationConnectionCreatePageQuery = {
  async getCreateContext(stationId, scope) {
    const [station] = await db
      .select({ name: stations.name })
      .from(stations)
      .where(eq(stations.id, stationId))
      .limit(1);
    if (!station) return null;

    const operatorOptions = await db
      .select({ id: operators.id, name: operators.name })
      .from(operators)
      .orderBy(asc(operators.name));

    const lineOptions = scope.operatorId
      ? await db
          .select({ id: lines.id, name: lines.name })
          .from(lines)
          .where(eq(lines.operatorId, scope.operatorId))
          .orderBy(asc(lines.displayOrder))
      : [];

    const candidates: ConnectionCandidateStation[] = scope.lineId
      ? await db
          .select({
            id: stations.id,
            name: stations.name,
            code: stations.code,
            lineName: lines.name,
          })
          .from(stationLines)
          .innerJoin(stations, eq(stationLines.stationId, stations.id))
          .innerJoin(lines, eq(stationLines.lineId, lines.id))
          .where(and(eq(stationLines.lineId, scope.lineId), ne(stations.id, stationId)))
          .orderBy(asc(stationLines.stationOrder))
      : [];

    const context: StationConnectionCreateContext = {
      stationName: station.name,
      operators: operatorOptions,
      lines: lineOptions,
      candidates,
    };
    return context;
  },
};
